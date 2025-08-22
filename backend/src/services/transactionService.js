/**
 * Transaction Service
 * Handles transactional integrity for critical operations
 * Ensures data consistency across purchases, withdrawals, and benefits
 */

const mongoose = require('mongoose');
const { Purchase, Withdrawal, Ledger, User } = require('../models');
const BenefitLedger = require('../models/BenefitLedger');
const OutboxEvent = require('../models/OutboxEvent');
const { DecimalCalc } = require('../utils/decimal');
const logger = require('../config/logger');
const EventEmitter = require('events');
const CacheInvalidationService = require('./cacheInvalidationService');
const licenseService = require('./licenseService');

class TransactionService extends EventEmitter {
  constructor() {
    super();
    this.activeTransactions = new Map();
  }

  /**
   * Execute a transactional operation with rollback capability
   * @param {Function} operation - The operation to execute
   * @param {Object} context - Transaction context
   * @returns {Promise<any>} - Operation result
   */
  async executeTransaction(operation, context = {}) {
    const session = await mongoose.startSession();
    const transactionId = `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      this.activeTransactions.set(transactionId, {
        startTime: new Date(),
        context,
        status: 'ACTIVE'
      });

      session.startTransaction();
      
      const result = await operation(session, transactionId);
      
      await session.commitTransaction();
      
      this.activeTransactions.set(transactionId, {
        ...this.activeTransactions.get(transactionId),
        status: 'COMMITTED',
        endTime: new Date()
      });

      // Emit success event for real-time sync
      this.emit('transaction:success', {
        transactionId,
        type: context.type,
        userId: context.userId,
        result
      });

      return result;
    } catch (error) {
      await session.abortTransaction();
      
      this.activeTransactions.set(transactionId, {
        ...this.activeTransactions.get(transactionId),
        status: 'ABORTED',
        error: error.message,
        endTime: new Date()
      });

      logger.error('Transaction failed:', {
        transactionId,
        error: error.message,
        context
      });

      // Emit error event for real-time sync
      this.emit('transaction:error', {
        transactionId,
        type: context.type,
        userId: context.userId,
        error: error.message
      });

      throw error;
    } finally {
      await session.endSession();
      
      // Clean up old transactions after 1 hour
      setTimeout(() => {
        this.activeTransactions.delete(transactionId);
      }, 60 * 60 * 1000);
    }
  }

  /**
   * Process purchase confirmation with full transactional integrity
   * @param {string} purchaseId - Purchase ID
   * @param {string} txHash - Transaction hash
   * @param {string} adminId - Admin ID confirming
   * @returns {Promise<Object>} - Updated purchase and ledger entries
   */
  async confirmPurchase(purchaseId, txHash, adminId) {
    const events = [];
    
    return this.executeTransactionWithEvents(async (session, transactionId) => {
      // 1. Find and validate purchase
      const purchase = await Purchase.findOne({ purchaseId })
        .session(session)
        .populate('userId');
      
      if (!purchase) {
        throw new Error('Purchase not found');
      }
      
      if (purchase.status !== 'CONFIRMING') {
        throw new Error(`Invalid purchase status: ${purchase.status}`);
      }

      // 2. Update purchase status
      purchase.status = 'ACTIVE';
      purchase.txHash = txHash;
      purchase.paymentConfirmedAt = new Date();
      purchase.activatedAt = new Date();
      await purchase.save({ session });

      // Add purchase confirmed event
      events.push({
        eventType: 'PURCHASE_CONFIRMED',
        aggregateId: purchase._id.toString(),
        aggregateType: 'Purchase',
        eventData: {
          purchaseId: purchase.purchaseId,
          userId: purchase.userId._id,
          amount: parseFloat(purchase.totalAmount.toString()),
          currency: purchase.currency,
          txHash: txHash,
          confirmedAt: purchase.paymentConfirmedAt
        },
        context: {
          userId: purchase.userId._id,
          adminId: adminId
        }
      });

      // 3. Create ledger entries
      const ledgerEntries = [];
      
      // Payment received entry
      const paymentEntry = new Ledger({
        userId: purchase.userId._id,
        type: 'PAYMENT_RECEIVED',
        amount: parseFloat(purchase.totalAmount.toString()),
        currency: purchase.currency,
        description: `Payment confirmed for purchase ${purchaseId}`,
        references: { purchaseId: purchase._id },
        idempotencyKey: `payment_${purchaseId}`,
        transactionDate: new Date(),
        status: 'confirmed'
      });
      
      ledgerEntries.push(paymentEntry);

      // 4. Process referral commissions if applicable
      const user = purchase.userId;
      if (user.referredBy) {
        const referrer = await User.findOne({ userId: user.referredBy }).session(session);
        if (referrer) {
          const commissionAmount = DecimalCalc.multiply(
            parseFloat(purchase.totalAmount.toString()),
            0.10 // 10% commission
          );

          // Create commission ledger entry
          const commissionEntry = new Ledger({
            userId: referrer._id,
            type: 'REFERRAL_DIRECT',
            amount: commissionAmount,
            currency: purchase.currency,
            description: `Direct referral commission from ${user.userId}`,
            references: {
              purchaseId: purchase._id,
              referralUserId: user._id
            },
            idempotencyKey: `referral_${purchaseId}_${referrer.userId}`,
            transactionDate: new Date(),
            status: 'confirmed'
          });
          
          ledgerEntries.push(commissionEntry);

          // Update referrer balance
          const currentBalance = parseFloat(referrer.availableBalance?.toString() || '0');
          const newBalance = DecimalCalc.add(currentBalance, commissionAmount);
          referrer.availableBalance = mongoose.Types.Decimal128.fromString(newBalance.toString());
          await referrer.save({ session });

          // Add commission earned event
          events.push({
            eventType: 'COMMISSION_EARNED',
            aggregateId: commissionEntry._id.toString(),
            aggregateType: 'Commission',
            eventData: {
              commissionId: commissionEntry._id,
              userId: referrer._id,
              amount: commissionAmount,
              currency: purchase.currency,
              referredUserId: user._id,
              referredUserEmail: user.userId,
              purchaseId: purchase._id
            },
            context: {
              userId: referrer._id
            }
          });
        }
      }

      // 5. Save all ledger entries
      for (const entry of ledgerEntries) {
        await entry.save({ session });
      }

      // 6. Create license automatically after purchase confirmation
      let license = null;
      try {
        // Create license from the confirmed purchase
        license = await licenseService.createLicenseFromPurchase(purchase._id);
        
        // Add license creation event
        events.push({
          eventType: 'LICENSE_CREATED',
          aggregateId: license._id.toString(),
          aggregateType: 'License',
          eventData: {
            licenseId: license.licenseId,
            purchaseId: purchase.purchaseId,
            userId: purchase.userId._id,
            principalAmount: parseFloat(license.principalAmount.toString()),
            status: license.status,
            activatedAt: license.activatedAt,
            totalCycles: license.totalCycles,
            benefitDays: license.benefitDays
          },
          context: {
            userId: purchase.userId._id,
            adminId: adminId
          }
        });
        
        logger.info(`License created automatically for purchase ${purchaseId}`, {
          licenseId: license.licenseId,
          userId: purchase.userId._id,
          principalAmount: license.principalAmount
        });
        
      } catch (licenseError) {
        logger.error(`Failed to create license for purchase ${purchaseId}:`, {
          error: licenseError.message,
          stack: licenseError.stack
        });
        // Don't fail the entire transaction for license creation errors
        // The purchase confirmation worker will retry later
      }

      return {
        purchase,
        ledgerEntries,
        license,
        transactionId
      };
    }, {
      type: 'PURCHASE_CONFIRMATION',
      userId: purchaseId,
      adminId
    }, events);
  }

  /**
   * Process withdrawal request with balance validation
   * @param {string} userId - User ID
   * @param {number} amount - Withdrawal amount
   * @param {string} destinationAddress - Destination address
   * @param {string} network - Network type
   * @returns {Promise<Object>} - Created withdrawal and updated balance
   */
  async processWithdrawal(userId, amount, destinationAddress, network = 'BEP20') {
    return this.executeTransaction(async (session, transactionId) => {
      // 1. Find user and validate balance
      const user = await User.findById(userId).session(session);
      if (!user) {
        throw new Error('User not found');
      }

      const currentBalance = parseFloat(user.availableBalance?.toString() || '0');
      const networkFee = 1; // 1 USDT fee
      const totalRequired = DecimalCalc.add(amount, networkFee);

      if (currentBalance < totalRequired) {
        throw new Error(`Insufficient balance. Required: ${totalRequired}, Available: ${currentBalance}`);
      }

      // 2. Check for pending withdrawals
      const pendingWithdrawals = await Withdrawal.countDocuments({
        userId: user._id,
        status: { $in: ['pending', 'approved', 'processing'] }
      }).session(session);

      if (pendingWithdrawals > 0) {
        throw new Error('You have pending withdrawals. Please wait for them to complete.');
      }

      // 3. Create withdrawal record
      const withdrawal = new Withdrawal({
        userId: user._id,
        amount: mongoose.Types.Decimal128.fromString(amount.toString()),
        currency: 'USDT',
        destinationAddress,
        network,
        networkFee: mongoose.Types.Decimal128.fromString(networkFee.toString()),
        totalFees: mongoose.Types.Decimal128.fromString(networkFee.toString()),
        netAmount: mongoose.Types.Decimal128.fromString(amount.toString()),
        status: 'pending',
        requestedAt: new Date()
      });

      await withdrawal.save({ session });

      // 4. Create ledger entry for withdrawal request
      const ledgerEntry = new Ledger({
        userId: user._id,
        type: 'WITHDRAWAL',
        amount: -totalRequired, // Negative for debit
        currency: 'USDT',
        description: `Withdrawal request ${withdrawal.withdrawalId}`,
        references: { withdrawalId: withdrawal._id },
        idempotencyKey: `withdrawal_${withdrawal.withdrawalId}`,
        transactionDate: new Date(),
        status: 'pending'
      });

      await ledgerEntry.save({ session });

      // 5. Reserve balance (don't deduct yet, wait for admin approval)
      user.reservedBalance = DecimalCalc.add(user.reservedBalance || 0, totalRequired);
      await user.save({ session });

      // Invalidate user cache after withdrawal processing
      CacheInvalidationService.invalidateWithdrawalCache(userId);

      return {
        withdrawal,
        ledgerEntry,
        transactionId,
        reservedAmount: totalRequired
      };
    }, {
      type: 'WITHDRAWAL_REQUEST',
      userId
    });
  }

  /**
   * Process daily benefit accrual
   * @param {string} purchaseId - Purchase ID
   * @param {number} day - Benefit day
   * @param {number} amount - Benefit amount
   * @returns {Promise<Object>} - Benefit ledger entry
   */
  async processBenefitAccrual(purchaseId, day, amount) {
    return this.executeTransaction(async (session, transactionId) => {
      // 1. Find purchase and validate
      const purchase = await Purchase.findOne({ purchaseId })
        .session(session)
        .populate('userId');
      
      if (!purchase) {
        throw new Error('Purchase not found');
      }
      
      if (purchase.status !== 'ACTIVE') {
        throw new Error(`Purchase not active: ${purchase.status}`);
      }

      // 2. Check for duplicate benefit
      const existingBenefit = await BenefitLedger.findOne({
        benefitIdempotencyKey: `benefit_${purchaseId}_${day}`
      }).session(session);

      if (existingBenefit) {
        throw new Error(`Benefit already processed for day ${day}`);
      }

      // 3. Create benefit ledger entry
      const benefitEntry = new BenefitLedger({
        userId: purchase.userId._id,
        type: 'DAILY_BENEFIT',
        amount: amount,
        currency: 'USDT',
        description: `Daily benefit day ${day} for purchase ${purchaseId}`,
        references: { purchaseId: purchase._id },
        benefitIdempotencyKey: `benefit_${purchaseId}_${day}`,
        scheduledAt: new Date(),
        status: 'paid',
        paidAt: new Date()
      });

      await benefitEntry.save({ session });

      // 4. Update user balance
      const user = purchase.userId;
      const currentBalance = parseFloat(user.availableBalance?.toString() || '0');
      const newBalance = DecimalCalc.add(currentBalance, amount);
      user.availableBalance = mongoose.Types.Decimal128.fromString(newBalance.toString());
      await user.save({ session });

      // 5. Update purchase benefit tracking
      purchase.currentDay = day;
      purchase.totalBenefitsPaid = mongoose.Types.Decimal128.fromString(
        DecimalCalc.add(
          parseFloat(purchase.totalBenefitsPaid?.toString() || '0'),
          amount
        ).toString()
      );
      await purchase.save({ session });

      return {
        benefitEntry,
        transactionId,
        newBalance: parseFloat(user.availableBalance?.toString() || '0')
      };
    }, {
      type: 'BENEFIT_ACCRUAL',
      userId: purchaseId
    });
  }

  /**
   * Create outbox event within transaction
   * @param {mongoose.Session} session - Database session
   * @param {string} eventType - Event type
   * @param {string} aggregateId - Aggregate ID
   * @param {string} aggregateType - Aggregate type
   * @param {Object} eventData - Event data
   * @param {Object} context - Event context
   */
  async createOutboxEvent(session, eventType, aggregateId, aggregateType, eventData, context = {}) {
    const event = OutboxEvent.createEvent(
      eventType,
      aggregateId,
      aggregateType,
      eventData,
      context
    );
    
    await event.save({ session });
    return event;
  }

  /**
   * Execute transaction with outbox events
   * @param {Function} operation - The operation to execute
   * @param {Object} context - Transaction context
   * @param {Array} events - Events to create in outbox
   * @returns {Promise<any>} - Operation result
   */
  async executeTransactionWithEvents(operation, context = {}, events = []) {
    return this.executeTransaction(async (session, transactionId) => {
      // Execute the main operation
      const result = await operation(session, transactionId);
      
      // Create outbox events within the same transaction
      const createdEvents = [];
      for (const eventConfig of events) {
        const event = await this.createOutboxEvent(
          session,
          eventConfig.eventType,
          eventConfig.aggregateId,
          eventConfig.aggregateType,
          eventConfig.eventData,
          {
            ...eventConfig.context,
            transactionId,
            userId: context.userId,
            adminId: context.adminId
          }
        );
        createdEvents.push(event);
      }
      
      return {
        ...result,
        outboxEvents: createdEvents
      };
    }, context);
  }

  /**
   * Get transaction status
   * @param {string} transactionId - Transaction ID
   * @returns {Object|null} - Transaction status
   */
  getTransactionStatus(transactionId) {
    return this.activeTransactions.get(transactionId) || null;
  }

  /**
   * Get all active transactions
   * @returns {Array} - Active transactions
   */
  getActiveTransactions() {
    return Array.from(this.activeTransactions.entries()).map(([id, data]) => ({
      transactionId: id,
      ...data
    }));
  }
}

module.exports = new TransactionService();