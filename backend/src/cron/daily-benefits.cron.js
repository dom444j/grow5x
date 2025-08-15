/**
 * Daily Benefits CRON Processor
 * Processes daily benefits for active purchases (12.5% daily for 8 days, 5 cycles)
 * Runs at 03:00 UTC daily
 */

const cron = require('node-cron');
const { Purchase, BenefitLedger, Transaction, User } = require('../models');
const logger = require('../config/logger');

/**
 * Process daily benefits for all eligible purchases
 */
async function processDailyBenefits() {
  const startTime = Date.now();
  logger.info('Starting daily benefits processing');
  
  try {
    // Find all active purchases that need benefit processing
    const activePurchases = await Purchase.find({
      status: 'active',
      activatedAt: { $exists: true }
    }).populate('user').populate('package');
    
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
            userId: purchase.user.userId,
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
          userId: purchase.user?.userId,
          error: error.message
        });
        
        logger.error('Error processing purchase benefits:', {
          purchaseId: purchase.purchaseId,
          userId: purchase.user?.userId,
          error: error.message,
          stack: error.stack
        });
      }
    }
    
    const duration = Date.now() - startTime;
    
    logger.info('Daily benefits processing completed', {
      totalPurchases: activePurchases.length,
      processedCount,
      errorCount,
      skippedCount: results.skipped.length,
      duration: `${duration}ms`,
      results
    });
    
    return {
      success: true,
      totalPurchases: activePurchases.length,
      processedCount,
      errorCount,
      duration,
      results
    };
    
  } catch (error) {
    logger.error('Fatal error in daily benefits processing:', {
      error: error.message,
      stack: error.stack,
      duration: Date.now() - startTime
    });
    
    throw error;
  }
}

/**
 * Process benefits for a single purchase
 */
async function processPurchaseBenefits(purchase) {
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
    if (purchase.status === 'active') {
      purchase.status = 'completed';
      purchase.completedAt = new Date();
      await purchase.save();
      
      logger.info('Purchase completed all benefit cycles', {
        purchaseId: purchase.purchaseId,
        userId: purchase.user.userId,
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
  
  // Calculate benefit amount (12.5% of purchase amount)
  const dailyRate = 0.125; // 12.5%
  const benefitAmount = purchase.totalAmount * dailyRate;
  
  // Create benefit ledger entry
  const benefitEntry = await BenefitLedger.createBenefitEntry(
    purchase._id,
    purchase.user._id,
    purchase.package._id,
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
  
  // Update user balance
  await User.findByIdAndUpdate(
    purchase.user._id,
    {
      $inc: {
        [`balances.${purchase.currency}.available`]: benefitAmount,
        [`balances.${purchase.currency}.total`]: benefitAmount
      }
    }
  );
  
  // Create transaction record
  await Transaction.createBenefitTransaction(
    purchase.user._id,
    benefitAmount,
    purchase.currency,
    purchase._id,
    `Beneficio diario - Ciclo ${currentCycle}, Día ${dayInCycle}`
  );
  
  logger.info('Daily benefit processed successfully', {
    purchaseId: purchase.purchaseId,
    userId: purchase.user.userId,
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

// Schedule CRON job to run daily at 03:00 UTC
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
  timezone: 'UTC'
});

/**
 * Start the CRON job
 */
function startCronJob() {
  cronJob.start();
  logger.info('Daily benefits CRON job started - runs daily at 03:00 UTC');
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
    timezone: 'UTC',
    schedule: '0 3 * * *', // Daily at 03:00 UTC
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