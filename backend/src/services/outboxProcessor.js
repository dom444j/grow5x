/**
 * Outbox Event Processor
 * Processes events from the outbox table and publishes them reliably
 * Implements retry logic and error handling for event publishing
 */

const OutboxEvent = require('../models/OutboxEvent');
const logger = require('../config/logger');
const realtimeSyncService = require('./realtimeSyncService');
const { invalidateCachePattern } = require('../middleware/redisCache');
const EventEmitter = require('events');

class OutboxProcessor extends EventEmitter {
  constructor() {
    super();
    this.isProcessing = false;
    this.processingInterval = null;
    this.batchSize = 50;
    this.processingIntervalMs = 5000; // 5 seconds
  }

  /**
   * Start the outbox processor
   */
  start() {
    if (this.processingInterval) {
      logger.warn('Outbox processor already running');
      return;
    }

    logger.info('Starting outbox event processor');
    this.processingInterval = setInterval(() => {
      this.processEvents().catch(error => {
        logger.error('Error in outbox processor:', error);
      });
    }, this.processingIntervalMs);

    // Process immediately on start
    this.processEvents().catch(error => {
      logger.error('Error in initial outbox processing:', error);
    });
  }

  /**
   * Stop the outbox processor
   */
  stop() {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
      logger.info('Outbox event processor stopped');
    }
  }

  /**
   * Process pending events from outbox
   */
  async processEvents() {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;

    try {
      const pendingEvents = await OutboxEvent.getPendingEvents(this.batchSize);
      
      if (pendingEvents.length === 0) {
        return;
      }

      logger.info(`Processing ${pendingEvents.length} outbox events`);

      for (const event of pendingEvents) {
        await this.processEvent(event);
      }

      // Emit processing stats
      this.emit('batch:processed', {
        count: pendingEvents.length,
        timestamp: new Date()
      });

    } catch (error) {
      logger.error('Error processing outbox events:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Process a single event
   * @param {OutboxEvent} event - Event to process
   */
  async processEvent(event) {
    try {
      await event.markAsProcessing();

      // Route event to appropriate handler
      await this.routeEvent(event);

      // Mark as published
      await event.markAsPublished();

      logger.debug('Event published successfully', {
        eventId: event.eventId,
        eventType: event.eventType
      });

      this.emit('event:published', {
        eventId: event.eventId,
        eventType: event.eventType,
        aggregateId: event.aggregateId
      });

    } catch (error) {
      logger.error('Error processing event:', {
        eventId: event.eventId,
        error: error.message
      });

      await event.markAsFailed(error.message);

      this.emit('event:failed', {
        eventId: event.eventId,
        eventType: event.eventType,
        error: error.message
      });
    }
  }

  /**
   * Route event to appropriate handler based on event type
   * @param {OutboxEvent} event - Event to route
   */
  async routeEvent(event) {
    switch (event.eventType) {
      case 'PURCHASE_CONFIRMED':
        await this.handlePurchaseConfirmed(event);
        break;
      
      case 'PURCHASE_REJECTED':
        await this.handlePurchaseRejected(event);
        break;
      
      case 'WITHDRAWAL_REQUESTED':
      case 'WITHDRAWAL_APPROVED':
      case 'WITHDRAWAL_COMPLETED':
      case 'WITHDRAWAL_REJECTED':
        await this.handleWithdrawalEvent(event);
        break;
      
      case 'BENEFIT_PROCESSED':
        await this.handleBenefitProcessed(event);
        break;
      
      case 'COMMISSION_UNLOCKED':
        await this.handleCommissionUnlocked(event);
        break;
      
      case 'LICENSE_PAUSED':
      case 'LICENSE_RESUMED':
      case 'LICENSE_COMPLETED':
        await this.handleLicenseEvent(event);
        break;
      
      case 'USER_BALANCE_UPDATED':
        await this.handleBalanceUpdated(event);
        break;
      
      case 'ADMIN_ACTION_PERFORMED':
        await this.handleAdminAction(event);
        break;
      
      default:
        throw new Error(`Unknown event type: ${event.eventType}`);
    }
  }

  /**
   * Handle purchase confirmed event
   */
  async handlePurchaseConfirmed(event) {
    const { purchase, user } = event.eventData;
    
    // Invalidate user cache patterns
    try {
      await invalidateCachePattern(`user:${event.userId}:*`);
      await invalidateCachePattern(`purchases:${event.userId}:*`);
      await invalidateCachePattern(`dashboard:${event.userId}:*`);
      await invalidateCachePattern(`me:${event.userId}:*`);
      
      logger.debug('Cache invalidated for purchase confirmed', {
        userId: event.userId,
        purchaseId: purchase.purchaseId
      });
    } catch (cacheError) {
      logger.warn('Failed to invalidate cache for purchase confirmed', {
        userId: event.userId,
        error: cacheError.message
      });
    }
    
    // Send real-time update to user
    realtimeSyncService.sendUserUpdate(event.userId.toString(), {
      type: 'PURCHASE_CONFIRMED',
      data: {
        purchaseId: purchase.purchaseId,
        status: purchase.status,
        activatedAt: purchase.activatedAt
      }
    });

    // Send admin notification
    realtimeSyncService.sendAdminUpdate({
      type: 'PURCHASE_CONFIRMED',
      data: {
        purchaseId: purchase.purchaseId,
        userEmail: user.email,
        amount: purchase.totalAmount
      }
    });
  }

  /**
   * Handle purchase rejected event
   */
  async handlePurchaseRejected(event) {
    const { purchase, reason } = event.eventData;
    
    realtimeSyncService.sendUserUpdate(event.userId.toString(), {
      type: 'PURCHASE_REJECTED',
      data: {
        purchaseId: purchase.purchaseId,
        reason: reason
      }
    });
  }

  /**
   * Handle withdrawal events
   */
  async handleWithdrawalEvent(event) {
    const { withdrawal } = event.eventData;
    
    realtimeSyncService.sendUserUpdate(event.userId.toString(), {
      type: event.eventType,
      data: {
        withdrawalId: withdrawal.withdrawalId,
        status: withdrawal.status,
        amount: withdrawal.amount
      }
    });

    // Send admin update for status changes
    realtimeSyncService.sendAdminUpdate({
      type: event.eventType,
      data: {
        withdrawalId: withdrawal.withdrawalId,
        userEmail: withdrawal.user?.email,
        amount: withdrawal.amount,
        status: withdrawal.status
      }
    });
  }

  /**
   * Handle benefit processed event
   */
  async handleBenefitProcessed(event) {
    const { benefit, newBalance } = event.eventData;
    
    // Invalidate user cache patterns
    try {
      await invalidateCachePattern(`user:${event.userId}:*`);
      await invalidateCachePattern(`dashboard:${event.userId}:*`);
      await invalidateCachePattern(`me:${event.userId}:*`);
      await invalidateCachePattern(`balances:${event.userId}:*`);
      
      logger.debug('Cache invalidated for benefit processed', {
        userId: event.userId,
        benefitAmount: benefit.amount
      });
    } catch (cacheError) {
      logger.warn('Failed to invalidate cache for benefit processed', {
        userId: event.userId,
        error: cacheError.message
      });
    }
    
    realtimeSyncService.sendUserUpdate(event.userId.toString(), {
      type: 'BENEFIT_PROCESSED',
      data: {
        amount: benefit.amount,
        newBalance: newBalance,
        date: benefit.processedAt
      }
    });
  }

  /**
   * Handle commission unlocked event
   */
  async handleCommissionUnlocked(event) {
    const { commission, newBalance } = event.eventData;
    
    // Invalidate user cache patterns
    try {
      await invalidateCachePattern(`user:${event.userId}:*`);
      await invalidateCachePattern(`dashboard:${event.userId}:*`);
      await invalidateCachePattern(`me:${event.userId}:*`);
      await invalidateCachePattern(`balances:${event.userId}:*`);
      await invalidateCachePattern(`commissions:${event.userId}:*`);
      
      logger.debug('Cache invalidated for commission unlocked', {
        userId: event.userId,
        commissionAmount: commission.amount,
        level: commission.level
      });
    } catch (cacheError) {
      logger.warn('Failed to invalidate cache for commission unlocked', {
        userId: event.userId,
        error: cacheError.message
      });
    }
    
    realtimeSyncService.sendUserUpdate(event.userId.toString(), {
      type: 'COMMISSION_UNLOCKED',
      data: {
        amount: commission.amount,
        level: commission.level,
        newBalance: newBalance
      }
    });
  }

  /**
   * Handle license events
   */
  async handleLicenseEvent(event) {
    const { license, reason } = event.eventData;
    
    realtimeSyncService.sendUserUpdate(event.userId.toString(), {
      type: event.eventType,
      data: {
        licenseId: license._id,
        status: license.status,
        reason: reason
      }
    });

    // Send admin update
    realtimeSyncService.sendAdminUpdate({
      type: event.eventType,
      data: {
        licenseId: license._id,
        userEmail: license.user?.email,
        action: event.eventType.split('_')[1].toLowerCase(),
        reason: reason
      }
    });
  }

  /**
   * Handle balance updated event
   */
  async handleBalanceUpdated(event) {
    const { oldBalance, newBalance, reason } = event.eventData;
    
    realtimeSyncService.sendUserUpdate(event.userId.toString(), {
      type: 'BALANCE_UPDATED',
      data: {
        oldBalance: oldBalance,
        newBalance: newBalance,
        reason: reason
      }
    });
  }

  /**
   * Handle admin action event
   */
  async handleAdminAction(event) {
    const { action, target, adminEmail } = event.eventData;
    
    realtimeSyncService.sendAdminUpdate({
      type: 'ADMIN_ACTION_PERFORMED',
      data: {
        action: action,
        target: target,
        adminEmail: adminEmail,
        timestamp: event.createdAt
      }
    });
  }

  /**
   * Get processor statistics
   */
  async getStats() {
    const [pending, processing, failed, published] = await Promise.all([
      OutboxEvent.countDocuments({ status: 'PENDING' }),
      OutboxEvent.countDocuments({ status: 'PROCESSING' }),
      OutboxEvent.countDocuments({ status: 'FAILED' }),
      OutboxEvent.countDocuments({ status: 'PUBLISHED' })
    ]);

    return {
      pending,
      processing,
      failed,
      published,
      isProcessing: this.isProcessing,
      batchSize: this.batchSize,
      processingIntervalMs: this.processingIntervalMs
    };
  }

  /**
   * Cleanup old events
   */
  async cleanup() {
    try {
      const result = await OutboxEvent.cleanupOldEvents();
      logger.info(`Cleaned up ${result.deletedCount} old outbox events`);
      return result;
    } catch (error) {
      logger.error('Error cleaning up outbox events:', error);
      throw error;
    }
  }
}

module.exports = new OutboxProcessor();