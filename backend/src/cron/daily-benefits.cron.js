/**
 * Daily Benefits CRON Processor
 * Processes daily benefits for active purchases (12.5% daily for 8 days, 5 cycles)
 * Runs at 03:00 UTC daily
 */

const cron = require('node-cron');
const { Purchase, BenefitLedger, Transaction, User, BenefitSchedule } = require('../models');
const JobState = require('../models/JobState');
const logger = require('../config/logger');
const { DecimalCalc } = require('../utils/decimal');

/**
 * Process daily benefits for all eligible purchases
 */
async function processDailyBenefits() {
  const startTime = Date.now();
  logger.info('Starting daily benefits processing');
  
  try {
    // Find all purchases that need benefit processing (only ACTIVE status)
    const activePurchases = await Purchase.find({
      status: 'ACTIVE',
      activatedAt: { $exists: true }
    }).populate('userId').populate('packageId');
    
    // Find purchases with REJECTED/CANCELLED status to mark as SKIPPED
    const rejectedCancelledPurchases = await Purchase.find({
      status: { $in: ['REJECTED', 'CANCELLED'] },
      activatedAt: { $exists: true }
    }).populate('userId');
    
    logger.info(`Found ${rejectedCancelledPurchases.length} REJECTED/CANCELLED purchases to mark as SKIPPED`);
    
    // Mark REJECTED/CANCELLED purchases as SKIPPED in results
    for (const purchase of rejectedCancelledPurchases) {
      results.skipped.push({
        purchaseId: purchase.purchaseId,
        userId: purchase.userId?.userId,
        reason: `Purchase status is ${purchase.status} - marked as SKIPPED`
      });
    }
    
    logger.info(`Found ${activePurchases.length} active purchases to process`);
    
    let processedCount = 0;
    let errorCount = 0;
    const results = {
      processed: [],
      errors: [],
      skipped: []
    };
    
    for (const purchase of activePurchases) {
      try {
        const result = await processPurchaseBenefits(purchase);
        
        if (result.processed) {
          processedCount++;
          results.processed.push({
            purchaseId: purchase.purchaseId,
            userId: purchase.userId.userId,
            benefitsCreated: result.benefitsCreated,
            totalAmount: result.totalAmount
          });
        } else {
          results.skipped.push({
            purchaseId: purchase.purchaseId,
            reason: result.reason
          });
        }
        
      } catch (error) {
        errorCount++;
        results.errors.push({
          purchaseId: purchase.purchaseId,
          userId: purchase.userId?.userId,
          error: error.message
        });
        
        logger.error('Error processing purchase benefits:', {
          purchaseId: purchase.purchaseId,
          userId: purchase.userId?.userId,
          error: error.message,
          stack: error.stack
        });
      }
    }
    
    const duration = Date.now() - startTime;
    
    // Calculate total amount processed
    const totalAmount = results.processed.reduce((sum, item) => sum + (item.totalAmount || 0), 0);
    
    // Persist metrics to JobState
    try {
      await JobState.updateJobState('benefits', {
        processed: processedCount,
        errors: errorCount,
        totalAmount,
        durationMs: duration,
        status: errorCount > 0 ? 'error' : 'success',
        errorMessage: errorCount > 0 ? `${errorCount} purchases failed processing` : null
      });
    } catch (jobStateError) {
      logger.error('Failed to update JobState for benefits:', jobStateError.message);
    }
    
    // Process commissions (REFERRER and PARENT)
    const commissionResults = await processCommissions();
    
    logger.info('Daily benefits processing completed', {
      totalPurchases: activePurchases.length,
      processedCount,
      errorCount,
      skippedCount: results.skipped.length,
      duration: `${duration}ms`,
      totalAmount,
      commissions: commissionResults,
      results
    });

    return {
      success: true,
      totalPurchases: activePurchases.length,
      processedCount,
      errorCount,
      duration,
      totalAmount,
      commissions: commissionResults,
      results
    };
    
  } catch (error) {
    const duration = Date.now() - startTime;
    
    // Persist error state to JobState
    try {
      await JobState.updateJobState('benefits', {
        processed: 0,
        errors: 1,
        totalAmount: 0,
        durationMs: duration,
        status: 'error',
        errorMessage: error.message
      });
    } catch (jobStateError) {
      logger.error('Failed to update JobState for benefits error:', jobStateError.message);
    }
    
    logger.error('Fatal error in daily benefits processing:', {
      error: error.message,
      stack: error.stack,
      duration: `${duration}ms`
    });
    
    throw error;
  }
}

/**
 * Process commissions (REFERRER and PARENT) for today
 */
async function processCommissions() {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  
  logger.info('Starting commission processing for today');
  
  const results = {
    referrer: { processed: 0, errors: 0, totalAmount: 0 },
    parent: { processed: 0, errors: 0, totalAmount: 0 }
  };
  
  try {
    // Process REFERRER commissions (day 8)
    const referrerSchedules = await BenefitSchedule.findReadyForProcessing(today, 'REFERRER');
    logger.info(`Found ${referrerSchedules.length} REFERRER commissions to process`);
    
    for (const schedule of referrerSchedules) {
      try {
        await processCommissionSchedule(schedule, 'REFERRER');
        results.referrer.processed++;
        results.referrer.totalAmount += schedule.dailyBenefitAmount;
      } catch (error) {
        results.referrer.errors++;
        logger.error('Error processing REFERRER commission:', {
          scheduleId: schedule._id,
          userId: schedule.userId._id,
          error: error.message
        });
      }
    }
    
    // Process PARENT commissions (day 17)
    const parentSchedules = await BenefitSchedule.findReadyForProcessing(today, 'PARENT');
    logger.info(`Found ${parentSchedules.length} PARENT commissions to process`);
    
    for (const schedule of parentSchedules) {
      try {
        await processCommissionSchedule(schedule, 'PARENT');
        results.parent.processed++;
        results.parent.totalAmount += schedule.dailyBenefitAmount;
      } catch (error) {
        results.parent.errors++;
        logger.error('Error processing PARENT commission:', {
          scheduleId: schedule._id,
          userId: schedule.userId._id,
          error: error.message
        });
      }
    }
    
    logger.info('Commission processing completed', results);
    return results;
    
  } catch (error) {
    logger.error('Fatal error in commission processing:', {
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
}

/**
 * Process a single commission schedule
 */
async function processCommissionSchedule(schedule, type) {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  
  // Validate purchase status - only process commissions for ACTIVE purchases
  if (schedule.purchaseId.status !== 'ACTIVE') {
    logger.warn(`Skipping ${type} commission for purchase ${schedule.purchaseId.purchaseId} - status is ${schedule.purchaseId.status}, not ACTIVE`);
    throw new Error(`Purchase status is ${schedule.purchaseId.status} - only ACTIVE purchases can generate commissions`);
  }
  
  // Check if already processed
  if (schedule.statusByDay && schedule.statusByDay.length > 0) {
    const todayStatus = schedule.statusByDay.find(day => 
      new Date(day.scheduledDate).getTime() === today.getTime()
    );
    
    if (todayStatus && todayStatus.status === 'released') {
      logger.info(`${type} commission already processed`, {
        scheduleId: schedule._id,
        userId: schedule.userId._id
      });
      return;
    }
  }
  
  // Create benefit ledger entry for commission
  const benefitEntry = await BenefitLedger.createBenefitEntry(
    schedule.purchaseId._id,
    schedule.userId._id,
    schedule.purchaseId.packageId,
    schedule.dailyBenefitAmount,
    schedule.purchaseId.currency || 'USDT',
    1, // Commission cycle
    schedule.dayIndex, // Day 8 or 17
    schedule.dailyRate,
    schedule.purchaseAmount,
    today,
    type // Pass commission type
  );
  
  // Process the commission (mark as processed and create transaction)
  await benefitEntry.markAsProcessed();
  
  // Update user balance with safe decimal calculation
  await User.findByIdAndUpdate(
    schedule.userId._id,
    {
      $inc: {
        [`balances.${schedule.purchaseId.currency || 'USDT'}.available`]: schedule.dailyBenefitAmount,
        [`balances.${schedule.purchaseId.currency || 'USDT'}.total`]: schedule.dailyBenefitAmount
      }
    }
  );
  
  // Create transaction record
  const description = type === 'REFERRER' 
    ? `Comisión de referido directo - Día ${schedule.dayIndex}`
    : `Comisión padre - Día ${schedule.dayIndex}`;
    
  await Transaction.createBenefitTransaction(
    schedule.userId._id,
    schedule.dailyBenefitAmount,
    schedule.purchaseId.currency || 'USDT',
    schedule.purchaseId._id,
    description
  );
  
  // Mark day as released in schedule
  await schedule.markDayAsReleased(schedule.dayIndex, benefitEntry._id);
  
  logger.info(`${type} commission processed successfully`, {
    scheduleId: schedule._id,
    userId: schedule.userId._id,
    benefitId: benefitEntry.benefitId,
    amount: schedule.dailyBenefitAmount,
    dayIndex: schedule.dayIndex
  });
}

/**
 * Process benefits for a single purchase
 */
async function processPurchaseBenefits(purchase) {
  // Validate purchase status - only process ACTIVE purchases
  if (purchase.status !== 'ACTIVE') {
    logger.warn(`Skipping purchase ${purchase.purchaseId} - status is ${purchase.status}, not ACTIVE`);
    return {
      processed: false,
      reason: `Purchase status is ${purchase.status} - only ACTIVE purchases can be processed`
    };
  }
  
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  
  // Calculate days since activation
  const activationDate = new Date(purchase.activatedAt);
  activationDate.setUTCHours(0, 0, 0, 0);
  
  const daysSinceActivation = Math.floor((today - activationDate) / (1000 * 60 * 60 * 24));
  
  // Check if we should process benefits today
  if (daysSinceActivation < 0) {
    return {
      processed: false,
      reason: 'Purchase not yet activated for today'
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
  
  // Check if benefit already exists for today
  const existingBenefit = await BenefitLedger.findOne({
    purchase: purchase._id,
    cycle: currentCycle,
    day: dayInCycle,
    scheduledDate: today
  });
  
  if (existingBenefit) {
    return {
      processed: false,
      reason: 'Benefit already processed for today'
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
    today
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
    `Beneficio diario - Ciclo ${currentCycle}, Día ${dayInCycle}`
  );
  
  logger.info('Daily benefit processed successfully', {
    purchaseId: purchase.purchaseId,
    userId: purchase.userId.userId,
    benefitId: benefitEntry.benefitId,
    amount: benefitAmount,
    currency: purchase.currency,
    cycle: currentCycle,
    day: dayInCycle,
    scheduledDate: today
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
 * Manual trigger for daily benefits processing (for testing/admin use)
 */
async function triggerManualProcessing() {
  logger.info('Manual daily benefits processing triggered');
  return await processDailyBenefits();
}

/**
 * Get processing statistics
 */
async function getProcessingStats() {
  try {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    
    const [todayStats, totalStats] = await Promise.all([
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
      ])
    ]);
    
    return {
      today: todayStats[0] || { totalBenefits: 0, totalAmount: 0, avgAmount: 0 },
      overall: totalStats.reduce((acc, stat) => {
        acc[stat._id] = {
          count: stat.count,
          totalAmount: stat.totalAmount
        };
        return acc;
      }, {})
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
const cronJob = cron.schedule('0 3 * * *', async () => {
  try {
    await processDailyBenefits();
  } catch (error) {
    logger.error('CRON job failed:', {
      job: 'daily-benefits',
      error: error.message,
      stack: error.stack
    });
  }
}, {
  scheduled: false, // Don't start automatically
  timezone: 'America/Bogota'
});

/**
 * Start the CRON job
 */
function startCronJob() {
  cronJob.start();
  logger.info('Daily benefits CRON job started - runs daily at 03:00 America/Bogota (UTC-5)');
}

/**
 * Stop the CRON job
 */
function stopCronJob() {
  cronJob.stop();
  logger.info('Daily benefits CRON job stopped');
}

/**
 * Get CRON job status
 */
function getCronStatus() {
  return {
    running: cronJob.running,
    scheduled: cronJob.scheduled,
    timezone: 'America/Bogota',
    schedule: '0 3 * * *', // Daily at 03:00 America/Bogota (UTC-5)
    nextRun: cronJob.nextDate ? cronJob.nextDate() : null
  };
}

module.exports = {
  processDailyBenefits,
  triggerManualProcessing,
  getProcessingStats,
  startCronJob,
  stopCronJob,
  getCronStatus
};