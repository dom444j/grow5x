// Benefits Accrual Cron Job
// Processes daily benefit releases for confirmed purchases
// Runs daily and respects ENABLE_BENEFITS_RELEASE flag

const cron = require('node-cron');
const BenefitSchedule = require('../models/BenefitSchedule');
const Ledger = require('../models/Ledger');
const Purchase = require('../models/Purchase');
const { logInfo, logError, logWarn } = require('../config/logger');
const { sendTelegramAlert } = require('../utils/telegram');

class BenefitsAccrualCron {
  constructor() {
    this.isRunning = false;
    this.lastRun = null;
    this.stats = {
      totalProcessed: 0,
      totalReleased: 0,
      totalErrors: 0,
      lastRunDuration: 0
    };
  }

  // Main processing function
  async processBenefitAccruals(targetDate = new Date()) {
    const startTime = Date.now();
    
    try {
      // Check if benefits release is enabled
      if (process.env.ENABLE_BENEFITS_RELEASE !== 'true') {
        logWarn('Benefits accrual skipped - ENABLE_BENEFITS_RELEASE is not enabled');
        return {
          success: true,
          message: 'Benefits release disabled',
          processed: 0,
          released: 0
        };
      }

      if (this.isRunning) {
        logWarn('Benefits accrual already running, skipping this execution');
        return {
          success: false,
          message: 'Already running',
          processed: 0,
          released: 0
        };
      }

      this.isRunning = true;
      logInfo(`Starting benefits accrual processing for ${targetDate.toISOString().split('T')[0]}`);

      // Find all active benefit schedules
      const schedules = await BenefitSchedule.findReadyForProcessing(targetDate);
      logInfo(`Found ${schedules.length} benefit schedules to process`);

      let processedCount = 0;
      let releasedCount = 0;
      let errorCount = 0;
      const errors = [];

      // Process each schedule
      for (const schedule of schedules) {
        try {
          const result = await this.processSingleSchedule(schedule, targetDate);
          processedCount++;
          
          if (result.released > 0) {
            releasedCount += result.released;
            logInfo(`Released ${result.released} benefits for user ${schedule.userId} (purchase ${schedule.purchaseId})`);
          }
          
        } catch (error) {
          errorCount++;
          const errorMsg = `Failed to process schedule ${schedule._id}: ${error.message}`;
          logError(errorMsg, error);
          errors.push(errorMsg);
          
          // Continue processing other schedules
          continue;
        }
      }

      const duration = Date.now() - startTime;
      this.stats = {
        totalProcessed: processedCount,
        totalReleased: releasedCount,
        totalErrors: errorCount,
        lastRunDuration: duration
      };
      this.lastRun = new Date();

      const summary = {
        success: true,
        processed: processedCount,
        released: releasedCount,
        errors: errorCount,
        duration: duration
      };

      logInfo(`Benefits accrual completed: ${JSON.stringify(summary)}`);

      // Send alert if there were significant errors
      if (errorCount > 0) {
        await this.sendErrorAlert(errorCount, errors.slice(0, 5)); // Send first 5 errors
      }

      // Send daily summary if benefits were released
      if (releasedCount > 0) {
        await this.sendDailySummary(summary);
      }

      return summary;

    } catch (error) {
      const duration = Date.now() - startTime;
      logError('Benefits accrual processing failed', error);
      
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

  // Process a single benefit schedule
  async processSingleSchedule(schedule, targetDate) {
    const pendingBenefits = schedule.getPendingBenefitsForDate(targetDate);
    
    if (pendingBenefits.length === 0) {
      return { released: 0, message: 'No pending benefits' };
    }

    let releasedCount = 0;

    // Process each pending benefit day
    for (const benefit of pendingBenefits) {
      try {
        // Create ledger entry for benefit accrual
        const ledgerEntry = await Ledger.createBenefitAccrual({
          userId: schedule.userId,
          amount: benefit.amount,
          purchaseId: schedule.purchaseId,
          benefitScheduleId: schedule._id,
          day: benefit.day,
          description: `Daily benefit accrual - Day ${benefit.day + 1} of 8`
        });

        // Mark day as released in schedule
        schedule.markDayAsReleased(benefit.day, ledgerEntry._id);
        releasedCount++;

        logInfo(`Released benefit day ${benefit.day} for schedule ${schedule._id}: $${benefit.amount}`);

      } catch (error) {
        // Mark day as failed
        schedule.markDayAsFailed(benefit.day, error.message);
        logError(`Failed to release benefit day ${benefit.day} for schedule ${schedule._id}`, error);
        
        // Continue with other days
        continue;
      }
    }

    // Save updated schedule
    await schedule.save();

    return { 
      released: releasedCount, 
      message: `Released ${releasedCount} of ${pendingBenefits.length} pending benefits` 
    };
  }

  // Send error alert
  async sendErrorAlert(errorCount, errorSamples) {
    try {
      const message = `🚨 Benefits Accrual Errors\n\n` +
        `❌ ${errorCount} errors occurred during benefits processing\n\n` +
        `Sample errors:\n${errorSamples.map(err => `• ${err}`).join('\n')}\n\n` +
        `Time: ${new Date().toISOString()}`;

      await sendTelegramAlert(message);
    } catch (error) {
      logError('Failed to send benefits error alert', error);
    }
  }

  // Send critical system alert
  async sendCriticalAlert(error) {
    try {
      const message = `🔥 CRITICAL: Benefits Accrual System Failure\n\n` +
        `❌ Benefits processing completely failed\n` +
        `Error: ${error.message}\n\n` +
        `Time: ${new Date().toISOString()}\n` +
        `Action Required: Immediate investigation needed`;

      await sendTelegramAlert(message);
    } catch (alertError) {
      logError('Failed to send critical benefits alert', alertError);
    }
  }

  // Send daily summary
  async sendDailySummary(summary) {
    try {
      if (process.env.ENABLE_DAILY_BENEFITS_SUMMARY !== 'true') {
        return;
      }

      const message = `📊 Daily Benefits Summary\n\n` +
        `✅ Processed: ${summary.processed} schedules\n` +
        `💰 Released: ${summary.released} benefit payments\n` +
        `⚠️ Errors: ${summary.errors}\n` +
        `⏱️ Duration: ${summary.duration}ms\n\n` +
        `Date: ${new Date().toISOString().split('T')[0]}`;

      await sendTelegramAlert(message);
    } catch (error) {
      logError('Failed to send daily benefits summary', error);
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
    // Cron runs daily at 02:00 UTC
    const now = new Date();
    const nextRun = new Date(now);
    nextRun.setUTCHours(2, 0, 0, 0);
    
    // If it's already past 02:00 today, schedule for tomorrow
    if (nextRun <= now) {
      nextRun.setUTCDate(nextRun.getUTCDate() + 1);
    }
    
    return nextRun;
  }

  // Manual trigger for testing/admin
  async triggerManual(targetDate) {
    logInfo('Manual benefits accrual trigger initiated');
    return await this.processBenefitAccruals(targetDate);
  }

  // Start the cron job
  start() {
    // Run daily at 02:00 UTC (avoid peak hours)
    const cronExpression = '0 2 * * *';
    
    logInfo(`Starting benefits accrual cron with expression: ${cronExpression}`);
    
    this.cronJob = cron.schedule(cronExpression, async () => {
      await this.processBenefitAccruals();
    }, {
      scheduled: true,
      timezone: 'UTC'
    });

    logInfo('Benefits accrual cron started successfully');
  }

  // Stop the cron job
  stop() {
    if (this.cronJob) {
      this.cronJob.stop();
      logInfo('Benefits accrual cron stopped');
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
const benefitsAccrualCron = new BenefitsAccrualCron();

// Export for use in other modules
module.exports = {
  benefitsAccrualCron,
  BenefitsAccrualCron
};

// Auto-start if not in test environment
if (process.env.NODE_ENV !== 'test' && process.env.ENABLE_CRONS === 'true') {
  benefitsAccrualCron.start();
  logInfo('Benefits accrual cron auto-started');
}