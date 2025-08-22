// Referral Direct Commission Cron Job
// Processes direct referral commissions (10%) on D+9 after purchase confirmation
// Runs daily and respects ENABLE_COMMISSIONS_RELEASE flag

const cron = require('node-cron');
const Purchase = require('../models/Purchase');
const User = require('../models/User');
const Ledger = require('../models/Ledger');
const ReferralService = require('../services/referralService');
const { logInfo, logError, logWarn } = require('../config/logger');
const { sendTelegramAlert } = require('../utils/telegram');

class ReferralDirectCron {
  constructor() {
    this.isRunning = false;
    this.lastRun = null;
    this.stats = {
      totalProcessed: 0,
      totalCommissions: 0,
      totalAmount: 0,
      totalErrors: 0,
      lastRunDuration: 0
    };
  }

  // Main processing function
  async processReferralCommissions(targetDate = new Date()) {
    const startTime = Date.now();
    
    try {
      // Check if commissions release is enabled
      if (process.env.ENABLE_COMMISSIONS_RELEASE !== 'true') {
        logWarn('Referral commissions skipped - ENABLE_COMMISSIONS_RELEASE is not enabled');
        return {
          success: true,
          message: 'Commissions release disabled',
          processed: 0,
          commissions: 0
        };
      }

      if (this.isRunning) {
        logWarn('Referral commission processing already running, skipping this execution');
        return {
          success: false,
          message: 'Already running',
          processed: 0,
          commissions: 0
        };
      }

      this.isRunning = true;
      logInfo(`Starting referral commission processing for ${targetDate.toISOString().split('T')[0]}`);

      // Find purchases that are eligible for referral commission (D+9)
      const eligiblePurchases = await this.findEligiblePurchases(targetDate);
      logInfo(`Found ${eligiblePurchases.length} purchases eligible for referral commission`);

      let processedCount = 0;
      let commissionCount = 0;
      let totalAmount = 0;
      let errorCount = 0;
      const errors = [];

      // Process each eligible purchase
      for (const purchase of eligiblePurchases) {
        try {
          const result = await this.processPurchaseReferral(purchase);
          processedCount++;
          
          if (result.commissionPaid) {
            commissionCount++;
            totalAmount += result.amount;
            logInfo(`Paid referral commission $${result.amount} to user ${result.referrerId} for purchase ${purchase._id}`);
          }
          
        } catch (error) {
          errorCount++;
          const errorMsg = `Failed to process referral for purchase ${purchase._id}: ${error.message}`;
          logError(errorMsg, error);
          errors.push(errorMsg);
          
          // Continue processing other purchases
          continue;
        }
      }

      const duration = Date.now() - startTime;
      this.stats = {
        totalProcessed: processedCount,
        totalCommissions: commissionCount,
        totalAmount: totalAmount,
        totalErrors: errorCount,
        lastRunDuration: duration
      };
      this.lastRun = new Date();

      const summary = {
        success: true,
        processed: processedCount,
        commissions: commissionCount,
        totalAmount: totalAmount,
        errors: errorCount,
        duration: duration
      };

      logInfo(`Referral commission processing completed: ${JSON.stringify(summary)}`);

      // Send alert if there were significant errors
      if (errorCount > 0) {
        await this.sendErrorAlert(errorCount, errors.slice(0, 5)); // Send first 5 errors
      }

      // Send daily summary if commissions were paid
      if (commissionCount > 0) {
        await this.sendDailySummary(summary);
      }

      return summary;

    } catch (error) {
      const duration = Date.now() - startTime;
      logError('Referral commission processing failed', error);
      
      await this.sendCriticalAlert(error);
      
      return {
        success: false,
        error: error.message,
        duration: duration
      };
    } finally {
      this.isRunning = false;
    }
  }

  // Find purchases eligible for referral commission (D+9)
  async findEligiblePurchases(targetDate) {
    // Calculate the date 9 days ago from target date
    const eligibleDate = new Date(targetDate);
    eligibleDate.setDate(eligibleDate.getDate() - 9);
    
    // Set time range for the eligible date (full day)
    const startOfDay = new Date(eligibleDate);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(eligibleDate);
    endOfDay.setHours(23, 59, 59, 999);

    logInfo(`Looking for purchases confirmed between ${startOfDay.toISOString()} and ${endOfDay.toISOString()}`);

    // Find confirmed purchases from D-9 that have referrers
    const purchases = await Purchase.find({
      status: 'confirmed',
      confirmedAt: {
        $gte: startOfDay,
        $lte: endOfDay
      }
    }).populate('userId', 'referredBy username email');

    // Filter purchases that have referrers and haven't been processed yet
    const eligiblePurchases = [];
    
    for (const purchase of purchases) {
      // Check if user has a referrer
      if (!purchase.userId || !purchase.userId.referredBy) {
        continue;
      }

      // Check if commission has already been paid
      const existingCommission = await Ledger.findOne({
        referralIdempotencyKey: Ledger.generateReferralIdempotencyKey(purchase._id, purchase.userId.referredBy)
      });

      if (!existingCommission) {
        eligiblePurchases.push(purchase);
      }
    }

    return eligiblePurchases;
  }

  // Process referral commission for a single purchase using cohort-based rules
  async processPurchaseReferral(purchase) {
    try {
      // Use the new ReferralService to process the entire referral chain
      const result = await ReferralService.processReferralChain(purchase);
      
      // Log detailed results
      if (result.directReferral?.commissionPaid) {
        logInfo(`Direct referral commission processed: $${result.directReferral.amount} (${result.directReferral.percentage}%) to user ${result.directReferral.referrerId} for purchase ${purchase._id}`);
      }
      
      if (result.parentBonus?.commissionPaid) {
        logInfo(`Parent bonus commission processed: $${result.parentBonus.amount} (${result.parentBonus.percentage}%) to user ${result.parentBonus.parentReferrerId} for purchase ${purchase._id}, release date: ${result.parentBonus.releaseDate}`);
      }
      
      if (result.errors.length > 0) {
        logWarn(`Referral processing had ${result.errors.length} errors for purchase ${purchase._id}:`, result.errors);
      }
      
      // Return compatible format for existing cron logic
      if (result.directReferral?.commissionPaid) {
        return {
          commissionPaid: true,
          amount: result.directReferral.amount,
          referrerId: result.directReferral.referrerId,
          ledgerEntryId: result.directReferral.ledgerEntryId,
          totalCommissions: result.totalCommissions,
          parentBonus: result.parentBonus,
          cohortBased: true
        };
      } else {
        return {
          commissionPaid: false,
          message: result.directReferral?.message || 'No direct referral commission processed',
          errors: result.errors
        };
      }
      
    } catch (error) {
      logError(`Error processing referral chain for purchase ${purchase._id}:`, error);
      
      // Fallback to legacy processing if cohort-based fails
      logWarn(`Falling back to legacy referral processing for purchase ${purchase._id}`);
      return await this.processPurchaseReferralLegacy(purchase);
    }
  }
  
  // Legacy referral processing as fallback
  async processPurchaseReferralLegacy(purchase) {
    const referrerId = purchase.userId.referredBy;
    
    if (!referrerId) {
      return { commissionPaid: false, message: 'No referrer found' };
    }

    // Verify referrer exists and is active
    const referrer = await User.findById(referrerId);
    if (!referrer) {
      logWarn(`Referrer ${referrerId} not found for purchase ${purchase._id}`);
      return { commissionPaid: false, message: 'Referrer not found' };
    }

    if (referrer.status !== 'active') {
      logWarn(`Referrer ${referrerId} is not active for purchase ${purchase._id}`);
      return { commissionPaid: false, message: 'Referrer not active' };
    }

    // Calculate commission (10% of purchase amount) - legacy fallback
    const commissionRate = 0.10; // 10%
    const commissionAmount = purchase.priceUSDT * commissionRate;

    // Create ledger entry for referral commission
    const ledgerEntry = await Ledger.createReferralCommission({
      userId: referrerId,
      amount: commissionAmount,
      purchaseId: purchase._id,
      referralUserId: purchase.userId._id,
      level: 1, // Direct referral
      description: `Direct referral commission (10% - legacy) from ${purchase.userId.username || purchase.userId.email}`
    });

    logInfo(`Created legacy referral commission ledger entry ${ledgerEntry._id} for $${commissionAmount}`);

    return {
      commissionPaid: true,
      amount: commissionAmount,
      referrerId: referrerId,
      ledgerEntryId: ledgerEntry._id,
      legacy: true
    };
  }

  // Send error alert
  async sendErrorAlert(errorCount, errorSamples) {
    try {
      const message = `🚨 Referral Commission Errors\n\n` +
        `❌ ${errorCount} errors occurred during commission processing\n\n` +
        `Sample errors:\n${errorSamples.map(err => `• ${err}`).join('\n')}\n\n` +
        `Time: ${new Date().toISOString()}`;

      await sendTelegramAlert(message);
    } catch (error) {
      logError('Failed to send referral error alert', error);
    }
  }

  // Send critical system alert
  async sendCriticalAlert(error) {
    try {
      const message = `🔥 CRITICAL: Referral Commission System Failure\n\n` +
        `❌ Commission processing completely failed\n` +
        `Error: ${error.message}\n\n` +
        `Time: ${new Date().toISOString()}\n` +
        `Action Required: Immediate investigation needed`;

      await sendTelegramAlert(message);
    } catch (alertError) {
      logError('Failed to send critical referral alert', alertError);
    }
  }

  // Send daily summary
  async sendDailySummary(summary) {
    try {
      if (process.env.ENABLE_DAILY_REFERRAL_SUMMARY !== 'true') {
        return;
      }

      const message = `💰 Daily Referral Commissions Summary\n\n` +
        `✅ Processed: ${summary.processed} purchases\n` +
        `💵 Commissions Paid: ${summary.commissions}\n` +
        `💲 Total Amount: $${summary.totalAmount.toFixed(2)}\n` +
        `⚠️ Errors: ${summary.errors}\n` +
        `⏱️ Duration: ${summary.duration}ms\n\n` +
        `Date: ${new Date().toISOString().split('T')[0]}`;

      await sendTelegramAlert(message);
    } catch (error) {
      logError('Failed to send daily referral summary', error);
    }
  }

  // Get current stats
  getStats() {
    return {
      ...this.stats,
      isRunning: this.isRunning,
      lastRun: this.lastRun,
      nextRun: this.getNextRunTime()
    };
  }

  // Get next scheduled run time
  getNextRunTime() {
    // Cron runs daily at 03:00 UTC (after benefits cron)
    const now = new Date();
    const nextRun = new Date(now);
    nextRun.setUTCHours(3, 0, 0, 0);
    
    // If it's already past 03:00 today, schedule for tomorrow
    if (nextRun <= now) {
      nextRun.setUTCDate(nextRun.getUTCDate() + 1);
    }
    
    return nextRun;
  }

  // Manual trigger for testing/admin
  async triggerManual(targetDate) {
    logInfo('Manual referral commission trigger initiated');
    return await this.processReferralCommissions(targetDate);
  }

  // Start the cron job
  start() {
    // Run daily at 03:00 UTC (after benefits cron at 02:00)
    const cronExpression = '0 3 * * *';
    
    logInfo(`Starting referral commission cron with expression: ${cronExpression}`);
    
    this.cronJob = cron.schedule(cronExpression, async () => {
      await this.processReferralCommissions();
    }, {
      scheduled: true,
      timezone: 'UTC'
    });

    logInfo('Referral commission cron started successfully');
  }

  // Stop the cron job
  stop() {
    if (this.cronJob) {
      this.cronJob.stop();
      logInfo('Referral commission cron stopped');
    }
  }

  // Health check
  healthCheck() {
    const now = new Date();
    const lastRunThreshold = 25 * 60 * 60 * 1000; // 25 hours
    
    return {
      status: 'healthy',
      isRunning: this.isRunning,
      lastRun: this.lastRun,
      timeSinceLastRun: this.lastRun ? now - this.lastRun : null,
      isOverdue: this.lastRun ? (now - this.lastRun) > lastRunThreshold : false,
      stats: this.stats
    };
  }
}

// Create singleton instance
const referralDirectCron = new ReferralDirectCron();

// Export for use in other modules
module.exports = {
  referralDirectCron,
  ReferralDirectCron
};

// Auto-start if not in test environment
if (process.env.NODE_ENV !== 'test' && process.env.ENABLE_CRONS === 'true') {
  referralDirectCron.start();
  logInfo('Referral direct commission cron auto-started');
}