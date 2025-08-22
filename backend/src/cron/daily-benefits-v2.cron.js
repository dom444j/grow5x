/**
 * Daily Benefits CRON Processor V2 - Idempotent with Timezone and Catch-up
 * Processes daily benefits for active purchases (12.5% daily for 8 days, 5 cycles)
 * Runs at 03:00 America/Bogota (UTC-5) daily with catch-up mechanism
 * 
 * Features:
 * - Idempotent processing (safe to run multiple times)
 * - Fixed timezone (America/Bogota)
 * - Catch-up mechanism for missed days
 * - Comprehensive logging and error handling
 * - Job state tracking with metrics
 */

const cron = require('node-cron');
const { Purchase, BenefitLedger, Transaction, User, BenefitSchedule } = require('../models');
const JobState = require('../models/JobState');
const DailyProcessingState = require('../models/DailyProcessingState');
const logger = require('../config/logger');
const { DecimalCalc } = require('../utils/decimal');

// Fixed timezone for consistent processing
const TIMEZONE = 'America/Bogota';
const CRON_SCHEDULE = '0 3 * * *'; // Daily at 03:00 America/Bogota
const MAX_CATCHUP_DAYS = 7; // Maximum days to catch up

/**
 * Get current date in fixed timezone (America/Bogota)
 */
function getCurrentDateInTimezone() {
  const now = new Date();
  // Convert to America/Bogota timezone
  const bogotaTime = new Date(now.toLocaleString("en-US", {timeZone: TIMEZONE}));
  bogotaTime.setHours(0, 0, 0, 0);
  return bogotaTime;
}

/**
 * Check if job is already running to prevent concurrent execution
 */
async function isJobRunning() {
  try {
    const jobState = await JobState.findOne({ job: 'benefits' });
    return jobState && jobState.status === 'running';
  } catch (error) {
    logger.error('Error checking job state:', error.message);
    return false;
  }
}

/**
 * Mark job as running
 */
async function markJobAsRunning() {
  try {
    await JobState.updateJobState('benefits', {
      status: 'running',
      processed: 0,
      errors: 0,
      totalAmount: 0,
      durationMs: 0,
      errorMessage: null
    });
  } catch (error) {
    logger.error('Error marking job as running:', error.message);
  }
}

/**
 * Get dates that need processing (including catch-up)
 */
async function getDatesToProcess() {
  const today = getCurrentDateInTimezone();
  const dates = [];
  
  try {
    // Get last successful run date
    const lastJobState = await JobState.findOne({ job: 'benefits' });
    let lastProcessedDate = null;
    
    if (lastJobState && lastJobState.status === 'success' && lastJobState.lastRun) {
      lastProcessedDate = new Date(lastJobState.lastRun);
      lastProcessedDate.setHours(0, 0, 0, 0);
    }
    
    // If no previous run or last run was more than MAX_CATCHUP_DAYS ago
    if (!lastProcessedDate) {
      // First run - only process today
      dates.push(new Date(today));
    } else {
      // Calculate days between last processed and today
      const daysDiff = Math.floor((today - lastProcessedDate) / (1000 * 60 * 60 * 24));
      
      if (daysDiff <= 0) {
        // Already processed today
        logger.info('Benefits already processed for today');
        return [];
      }
      
      // Limit catch-up to MAX_CATCHUP_DAYS
      const daysToProcess = Math.min(daysDiff, MAX_CATCHUP_DAYS);
      
      // Add dates to process (from oldest to newest)
      for (let i = daysToProcess; i >= 1; i--) {
        const dateToProcess = new Date(today);
        dateToProcess.setDate(today.getDate() - i + 1);
        dates.push(dateToProcess);
      }
      
      if (daysDiff > MAX_CATCHUP_DAYS) {
        logger.warn(`Skipping ${daysDiff - MAX_CATCHUP_DAYS} days due to MAX_CATCHUP_DAYS limit`, {
          daysDiff,
          maxCatchupDays: MAX_CATCHUP_DAYS,
          lastProcessedDate: lastProcessedDate.toISOString(),
          today: today.toISOString()
        });
      }
    }
    
    logger.info('Dates to process:', {
      dates: dates.map(d => d.toISOString().split('T')[0]),
      totalDays: dates.length,
      lastProcessedDate: lastProcessedDate ? lastProcessedDate.toISOString().split('T')[0] : 'none'
    });
    
    return dates;
    
  } catch (error) {
    logger.error('Error determining dates to process:', error.message);
    // Fallback to today only
    return [new Date(today)];
  }
}

/**
 * Process daily benefits for a specific date (idempotent)
 */
async function processDailyBenefitsForDate(targetDate) {
  const startTime = Date.now();
  const dateStr = targetDate.toISOString().split('T')[0];
  
  logger.info('Processing daily benefits for date:', {
    targetDate: dateStr
  });
  
  // Check if already processed
  const existingState = await DailyProcessingState.getProcessingState(dateStr);
  if (existingState && existingState.status === 'completed') {
    logger.info(`Benefits for date ${dateStr} already processed`, {
      completedAt: existingState.completedAt,
      stats: existingState.stats
    });
    return existingState.stats;
  }
  
  // Mark processing as started
  const processingState = await DailyProcessingState.markProcessingStarted(dateStr, {
    timezone: TIMEZONE,
    cronVersion: 'v2',
    manualTrigger: false
  });
  
  const results = {
    processed: [],
    errors: [],
    skipped: []
  };
  
  try {
    // Find all purchases that need benefit processing (only ACTIVE status)
    const activePurchases = await Purchase.find({
      status: 'ACTIVE',
      activatedAt: { $exists: true, $lte: targetDate }
    }).populate('userId').populate('packageId');
    
    logger.info(`Found ${activePurchases.length} active purchases for date ${targetDate.toISOString().split('T')[0]}`);
    
    for (const purchase of activePurchases) {
      try {
        const result = await processPurchaseBenefitsForDate(purchase, targetDate);
        
        if (result.processed) {
          results.processed.push({
            purchaseId: purchase.purchaseId,
            userId: purchase.userId.userId,
            benefitsCreated: result.benefitsCreated,
            totalAmount: result.totalAmount,
            cycle: result.cycle,
            day: result.day
          });
        } else {
          results.skipped.push({
            purchaseId: purchase.purchaseId,
            userId: purchase.userId?.userId,
            reason: result.reason
          });
        }
        
      } catch (error) {
        results.errors.push({
          purchaseId: purchase.purchaseId,
          userId: purchase.userId?.userId,
          error: error.message
        });
        
        logger.error('Error processing purchase benefits:', {
          purchaseId: purchase.purchaseId,
          userId: purchase.userId?.userId,
          targetDate: targetDate.toISOString().split('T')[0],
          error: error.message,
          stack: error.stack
        });
      }
    }
    
    const duration = Date.now() - startTime;
    const totalAmount = results.processed.reduce((sum, item) => sum + (item.totalAmount || 0), 0);
    
    const finalStats = {
      success: true,
      targetDate,
      totalPurchases: activePurchases.length,
      processedCount: results.processed.length,
      errorCount: results.errors.length,
      skippedCount: results.skipped.length,
      duration,
      totalAmount,
      results
    };
    
    // Mark processing as completed
    await DailyProcessingState.markProcessingCompleted(dateStr, finalStats);
    
    logger.info('Daily benefits processing completed for date:', {
      targetDate: dateStr,
      totalPurchases: activePurchases.length,
      processedCount: results.processed.length,
      errorCount: results.errors.length,
      skippedCount: results.skipped.length,
      duration: `${duration}ms`,
      totalAmount
    });
    
    return finalStats;
    
  } catch (error) {
    const duration = Date.now() - startTime;
    
    // Mark processing as failed
    await DailyProcessingState.markProcessingFailed(dateStr, error.message, {
      duration,
      partialResults: results
    });
    
    logger.error('Fatal error in daily benefits processing for date:', {
      targetDate: dateStr,
      error: error.message,
      stack: error.stack,
      duration: `${duration}ms`
    });
    
    throw error;
  }
}

/**
 * Process benefits for a single purchase on a specific date (idempotent)
 */
async function processPurchaseBenefitsForDate(purchase, targetDate) {
  // Validate purchase status - only process ACTIVE purchases
  if (purchase.status !== 'ACTIVE') {
    return {
      processed: false,
      reason: `Purchase status is ${purchase.status} - only ACTIVE purchases can be processed`
    };
  }
  
  // Calculate days since activation
  const activationDate = new Date(purchase.activatedAt);
  activationDate.setUTCHours(0, 0, 0, 0);
  
  const daysSinceActivation = Math.floor((targetDate - activationDate) / (1000 * 60 * 60 * 24));
  
  // Check if we should process benefits for this date
  if (daysSinceActivation < 0) {
    return {
      processed: false,
      reason: 'Purchase not yet activated for this date'
    };
  }
  
  // Calculate current cycle and day within cycle
  const currentCycle = Math.floor(daysSinceActivation / 8) + 1;
  const dayInCycle = (daysSinceActivation % 8) + 1;
  
  // Check if we've completed all 5 cycles
  if (currentCycle > 5) {
    // Mark purchase as completed if not already
    if (purchase.status === 'ACTIVE') {
      purchase.completedAt = new Date();
      await purchase.save();
      
      logger.info('Purchase completed all benefit cycles', {
        purchaseId: purchase.purchaseId,
        userId: purchase.userId.userId,
        totalCycles: 5,
        completedAt: purchase.completedAt
      });
    }
    
    return {
      processed: false,
      reason: 'All 5 cycles completed'
    };
  }
  
  // Check if benefit already exists for this date (IDEMPOTENT CHECK)
  const dateStr = targetDate.toISOString().split('T')[0];
  const existingBenefit = await BenefitLedger.findOne({
    purchase: purchase._id,
    cycle: currentCycle,
    day: dayInCycle,
    scheduledDate: targetDate
  });
  
  if (existingBenefit) {
    logger.debug(`Benefit already exists for purchase ${purchase.purchaseId} on ${dateStr}`, {
      existingBenefitId: existingBenefit.benefitId,
      amount: existingBenefit.benefitAmount,
      cycle: currentCycle,
      day: dayInCycle
    });
    return {
      processed: false,
      reason: `Benefit already processed for date ${dateStr} (idempotent)`,
      existingAmount: existingBenefit.benefitAmount
    };
  }
  
  // Calculate benefit amount (12.5% of purchase amount) with safe decimal calculation
  const dailyRate = 0.125; // 12.5%
  const benefitAmount = DecimalCalc.calculateDailyBenefit(purchase.totalAmount, dailyRate);
  
  // Create benefit ledger entry
  const benefitEntry = await BenefitLedger.createBenefitEntry(
    purchase._id,
    purchase.userId._id,
    purchase.packageId._id,
    benefitAmount,
    purchase.currency,
    currentCycle,
    dayInCycle,
    dailyRate,
    purchase.totalAmount,
    targetDate
  );
  
  // Process the benefit (mark as processed and create transaction)
  await benefitEntry.markAsProcessed();
  
  // Update user balance with safe decimal calculation
  await User.findByIdAndUpdate(
    purchase.userId._id,
    {
      $inc: {
        [`balances.${purchase.currency}.available`]: benefitAmount,
        [`balances.${purchase.currency}.total`]: benefitAmount
      }
    }
  );
  
  // Create transaction record
  await Transaction.createBenefitTransaction(
    purchase.userId._id,
    benefitAmount,
    purchase.currency,
    purchase._id,
    `Beneficio diario - Ciclo ${currentCycle}, Día ${dayInCycle} (${targetDate.toISOString().split('T')[0]})`
  );
  
  logger.info('Daily benefit processed successfully', {
    purchaseId: purchase.purchaseId,
    userId: purchase.userId.userId,
    benefitId: benefitEntry.benefitId,
    amount: benefitAmount,
    currency: purchase.currency,
    cycle: currentCycle,
    day: dayInCycle,
    targetDate: targetDate.toISOString().split('T')[0]
  });
  
  return {
    processed: true,
    benefitsCreated: 1,
    totalAmount: benefitAmount,
    cycle: currentCycle,
    day: dayInCycle
  };
}

/**
 * Main processing function with idempotency and catch-up
 */
async function processDailyBenefitsIdempotent() {
  const overallStartTime = Date.now();
  
  // Check if job is already running
  if (await isJobRunning()) {
    logger.warn('Daily benefits job is already running, skipping execution');
    return {
      success: false,
      reason: 'Job already running'
    };
  }
  
  // Mark job as running
  await markJobAsRunning();
  
  try {
    logger.info('Starting idempotent daily benefits processing with catch-up');
    
    // Get dates that need processing
    const datesToProcess = await getDatesToProcess();
    
    if (datesToProcess.length === 0) {
      await JobState.updateJobState('benefits', {
        processed: 0,
        errors: 0,
        totalAmount: 0,
        durationMs: Date.now() - overallStartTime,
        status: 'success',
        errorMessage: null
      });
      
      return {
        success: true,
        reason: 'No dates to process',
        datesProcessed: 0
      };
    }
    
    // Process each date
    const allResults = [];
    let totalProcessed = 0;
    let totalErrors = 0;
    let totalAmount = 0;
    
    for (const date of datesToProcess) {
      try {
        const result = await processDailyBenefitsForDate(date);
        allResults.push(result);
        totalProcessed += result.processedCount;
        totalErrors += result.errorCount;
        totalAmount += result.totalAmount;
      } catch (error) {
        totalErrors++;
        logger.error('Error processing date:', {
          date: date.toISOString().split('T')[0],
          error: error.message
        });
      }
    }
    
    const overallDuration = Date.now() - overallStartTime;
    
    // Update job state with final results
    await JobState.updateJobState('benefits', {
      processed: totalProcessed,
      errors: totalErrors,
      totalAmount,
      durationMs: overallDuration,
      status: totalErrors > 0 ? 'error' : 'success',
      errorMessage: totalErrors > 0 ? `${totalErrors} errors occurred during processing` : null
    });
    
    logger.info('Idempotent daily benefits processing completed', {
      datesProcessed: datesToProcess.length,
      totalProcessed,
      totalErrors,
      totalAmount,
      duration: `${overallDuration}ms`,
      dates: datesToProcess.map(d => d.toISOString().split('T')[0])
    });
    
    return {
      success: true,
      datesProcessed: datesToProcess.length,
      totalProcessed,
      totalErrors,
      totalAmount,
      duration: overallDuration,
      results: allResults
    };
    
  } catch (error) {
    const overallDuration = Date.now() - overallStartTime;
    
    // Update job state with error
    await JobState.updateJobState('benefits', {
      processed: 0,
      errors: 1,
      totalAmount: 0,
      durationMs: overallDuration,
      status: 'error',
      errorMessage: error.message
    });
    
    logger.error('Fatal error in idempotent daily benefits processing:', {
      error: error.message,
      stack: error.stack,
      duration: `${overallDuration}ms`
    });
    
    throw error;
  }
}

/**
 * Manual trigger for daily benefits processing (for testing/admin use)
 */
async function triggerManualProcessing() {
  logger.info('Manual idempotent daily benefits processing triggered');
  return await processDailyBenefitsIdempotent();
}

/**
 * Manual trigger for processing a specific date
 * @param {string} dateStr - Date in YYYY-MM-DD format
 * @param {boolean} force - Whether to force reprocessing
 * @returns {Promise<Object>} Processing results
 */
async function triggerManualProcessingForDate(dateStr, force = false) {
  logger.info('Manual daily benefits processing triggered for specific date', {
    date: dateStr,
    force
  });
  
  try {
    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(dateStr)) {
      throw new Error('Invalid date format. Use YYYY-MM-DD');
    }
    
    // Convert to Date object
    const targetDate = new Date(dateStr + 'T00:00:00.000Z');
    
    // If force is true, remove existing processing state
    if (force) {
      const existingState = await DailyProcessingState.getProcessingState(dateStr);
      if (existingState) {
        await DailyProcessingState.deleteOne({ processDate: dateStr });
        logger.info(`Removed existing processing state for ${dateStr} (force mode)`);
      }
    }
    
    const result = await processDailyBenefitsForDate(targetDate);
    
    logger.info('Manual daily benefits processing completed for date', {
      date: dateStr,
      result
    });
    
    return result;
    
  } catch (error) {
    logger.error('Error in manual daily benefits processing for date:', {
      date: dateStr,
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
}

/**
 * Get processing statistics
 */
async function getProcessingStats() {
  try {
    const today = getCurrentDateInTimezone();
    
    const [todayStats, totalStats, jobState] = await Promise.all([
      // Today's processing stats
      BenefitLedger.aggregate([
        {
          $match: {
            scheduledDate: today,
            status: 'processed'
          }
        },
        {
          $group: {
            _id: null,
            totalBenefits: { $sum: 1 },
            totalAmount: { $sum: '$benefitAmount' },
            avgAmount: { $avg: '$benefitAmount' }
          }
        }
      ]),
      
      // Overall stats
      BenefitLedger.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            totalAmount: { $sum: '$benefitAmount' }
          }
        }
      ]),
      
      // Job state
      JobState.findOne({ job: 'benefits' })
    ]);
    
    return {
      today: todayStats[0] || { totalBenefits: 0, totalAmount: 0, avgAmount: 0 },
      overall: totalStats.reduce((acc, stat) => {
        acc[stat._id] = {
          count: stat.count,
          totalAmount: stat.totalAmount
        };
        return acc;
      }, {}),
      jobState: jobState ? {
        lastRun: jobState.lastRun,
        status: jobState.status,
        processed: jobState.processed,
        errors: jobState.errors,
        totalAmount: jobState.totalAmount,
        durationMs: jobState.durationMs,
        errorMessage: jobState.errorMessage
      } : null,
      timezone: TIMEZONE,
      currentTime: getCurrentDateInTimezone().toISOString()
    };
    
  } catch (error) {
    logger.error('Error getting processing stats:', {
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
}

// Schedule CRON job to run daily at 03:00 America/Bogota (UTC-5)
const cronJob = cron.schedule(CRON_SCHEDULE, async () => {
  try {
    await processDailyBenefitsIdempotent();
  } catch (error) {
    logger.error('CRON job failed:', {
      job: 'daily-benefits-v2',
      error: error.message,
      stack: error.stack,
      timezone: TIMEZONE
    });
  }
}, {
  scheduled: false, // Don't start automatically
  timezone: TIMEZONE
});

/**
 * Start the CRON job
 */
function startCronJob() {
  cronJob.start();
  logger.info(`Daily benefits CRON job V2 started - runs daily at ${CRON_SCHEDULE} ${TIMEZONE} with idempotency and catch-up`);
}

/**
 * Stop the CRON job
 */
function stopCronJob() {
  cronJob.stop();
  logger.info('Daily benefits CRON job V2 stopped');
}

/**
 * Get CRON job status
 */
function getCronStatus() {
  return {
    running: cronJob.running,
    scheduled: cronJob.scheduled,
    timezone: TIMEZONE,
    schedule: CRON_SCHEDULE,
    nextRun: cronJob.nextDate ? cronJob.nextDate() : null,
    features: {
      idempotent: true,
      catchUp: true,
      maxCatchupDays: MAX_CATCHUP_DAYS,
      fixedTimezone: true
    }
  };
}

module.exports = {
  processDailyBenefitsIdempotent,
  processDailyBenefitsForDate,
  triggerManualProcessing,
  triggerManualProcessingForDate,
  getProcessingStats,
  startCronJob,
  stopCronJob,
  getCronStatus,
  getCurrentDateInTimezone,
  getDatesToProcess
};