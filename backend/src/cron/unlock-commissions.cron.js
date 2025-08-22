/**
 * Unlock Commissions CRON Processor
 * Unlocks pending commissions to available status on D+9 and D+18
 * Runs at 03:00 UTC daily
 */

const cron = require('node-cron');
const { Commission, Transaction, User } = require('../models');
const JobState = require('../models/JobState');
const logger = require('../config/logger');
const realtimeSyncService = require('../services/realtimeSyncService');
const { invalidateCachePattern } = require('../middleware/redisCache');

/**
 * Process commission unlocks for all eligible commissions
 */
async function processCommissionUnlocks() {
  const startTime = Date.now();
  logger.info('Starting commission unlock processing');
  
  try {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    
    // Find all pending commissions that are ready to be unlocked
    const pendingCommissions = await Commission.find({
      status: 'pending',
      unlockDate: { $lte: today }
    }).populate('recipientUserId').populate('sourceUserId').populate('purchaseId');
    
    logger.info(`Found ${pendingCommissions.length} commissions ready to unlock`);
    
    let unlockedCount = 0;
    let errorCount = 0;
    const results = {
      unlocked: [],
      errors: []
    };
    
    for (const commission of pendingCommissions) {
      try {
        const result = await unlockCommission(commission);
        
        if (result.success) {
          unlockedCount++;
          results.unlocked.push({
            commissionId: commission.commissionId,
            earnerId: commission.recipientUserId.userId,
            amount: commission.commissionAmount,
            currency: commission.currency,
            level: commission.level,
            unlockDate: commission.unlockDate
          });
        }
        
      } catch (error) {
        errorCount++;
        results.errors.push({
          commissionId: commission.commissionId,
          earnerId: commission.recipientUserId?.userId,
          error: error.message
        });
        
        logger.error('Error unlocking commission:', {
          commissionId: commission.commissionId,
          earnerId: commission.recipientUserId?.userId,
          error: error.message,
          stack: error.stack
        });
      }
    }
    
    const duration = Date.now() - startTime;
    
    // Calculate total amount unlocked
    const totalAmount = results.unlocked.reduce((sum, item) => sum + (item.amount || 0), 0);
    
    // Persist metrics to JobState
    try {
      await JobState.updateJobState('commissions', {
        processed: unlockedCount,
        errors: errorCount,
        totalAmount,
        durationMs: duration,
        status: errorCount > 0 ? 'error' : 'success',
        errorMessage: errorCount > 0 ? `${errorCount} commissions failed to unlock` : null
      });
    } catch (jobStateError) {
      logger.error('Failed to update JobState for commissions:', jobStateError.message);
    }
    
    logger.info('Commission unlock processing completed', {
      totalCommissions: pendingCommissions.length,
      unlockedCount,
      errorCount,
      duration: `${duration}ms`,
      totalAmount,
      results
    });
    
    return {
      success: true,
      totalCommissions: pendingCommissions.length,
      unlockedCount,
      errorCount,
      duration,
      totalAmount,
      results
    };
    
  } catch (error) {
    const duration = Date.now() - startTime;
    
    // Persist error state to JobState
    try {
      await JobState.updateJobState('commissions', {
        processed: 0,
        errors: 1,
        totalAmount: 0,
        durationMs: duration,
        status: 'error',
        errorMessage: error.message
      });
    } catch (jobStateError) {
      logger.error('Failed to update JobState for commissions error:', jobStateError.message);
    }
    
    logger.error('Fatal error in commission unlock processing:', {
      error: error.message,
      stack: error.stack,
      duration: `${duration}ms`
    });
    
    throw error;
  }
}

/**
 * Unlock a single commission
 */
async function unlockCommission(commission) {
  const session = await Commission.startSession();
  
  try {
    await session.withTransaction(async () => {
      // Update commission status to available
      commission.status = 'available';
      commission.unlockedAt = new Date();
      await commission.save({ session });
      
      // Update user balance
      await User.findByIdAndUpdate(
        commission.recipientUserId._id,
        {
          $inc: {
            [`balances.${commission.currency}.available`]: commission.commissionAmount,
            [`balances.${commission.currency}.total`]: commission.commissionAmount
          }
        },
        { session }
      );
      
      // Create transaction record
      await Transaction.createCommissionTransaction(
        commission.recipientUserId._id,
        commission.commissionAmount,
        commission.currency,
        commission._id,
        `Comisión desbloqueada - Nivel ${commission.level} de ${commission.sourceUserId.userId}`,
        session
      );
      
      // Invalidate user cache patterns
      try {
        const userId = commission.recipientUserId._id.toString();
        await invalidateCachePattern(`user:${userId}:*`);
        await invalidateCachePattern(`dashboard:${userId}:*`);
        await invalidateCachePattern(`me:${userId}:*`);
        await invalidateCachePattern(`balances:${userId}:*`);
        await invalidateCachePattern(`commissions:${userId}:*`);
        
        logger.debug('Cache invalidated for commission earned (cron)', {
          userId: userId,
          commissionId: commission.commissionId
        });
      } catch (cacheError) {
        logger.warn('Failed to invalidate cache for commission earned (cron)', {
          userId: commission.recipientUserId._id.toString(),
          error: cacheError.message
        });
      }
      
      // Emit SSE event for commission earned
      realtimeSyncService.sendUserUpdate(commission.recipientUserId._id.toString(), {
        type: 'commissionEarned',
        commission: {
          commissionId: commission.commissionId,
          amount: commission.commissionAmount,
          currency: commission.currency,
          level: commission.level,
          referredUser: {
            userId: commission.sourceUserId.userId,
            email: commission.sourceUserId.email
          },
          unlockedAt: commission.unlockedAt
        }
      });
      
      logger.info('Commission unlocked successfully', {
        commissionId: commission.commissionId,
        earnerId: commission.recipientUserId.userId,
        amount: commission.commissionAmount,
        currency: commission.currency,
        level: commission.level,
        unlockDate: commission.unlockDate,
        unlockedAt: commission.unlockedAt
      });
    });
    
    return { success: true };
    
  } catch (error) {
    logger.error('Error in commission unlock transaction:', {
      commissionId: commission.commissionId,
      error: error.message,
      stack: error.stack
    });
    throw error;
  } finally {
    await session.endSession();
  }
}

/**
 * Manual trigger for commission unlock processing (for testing/admin use)
 */
async function triggerManualUnlocking() {
  logger.info('Manual commission unlock processing triggered');
  return await processCommissionUnlocks();
}

/**
 * Get unlock statistics
 */
async function getUnlockStats() {
  try {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    
    const [todayStats, pendingStats, totalStats] = await Promise.all([
      // Today's unlock stats
      Commission.aggregate([
        {
          $match: {
            unlockedAt: {
              $gte: today,
              $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000)
            }
          }
        },
        {
          $group: {
            _id: null,
            totalUnlocked: { $sum: 1 },
            totalAmount: { $sum: '$commissionAmount' },
            avgAmount: { $avg: '$commissionAmount' }
          }
        }
      ]),
      
      // Pending commissions ready to unlock
      Commission.aggregate([
        {
          $match: {
            status: 'pending',
            unlockDate: { $lte: today }
          }
        },
        {
          $group: {
            _id: null,
            totalPending: { $sum: 1 },
            totalAmount: { $sum: '$commissionAmount' }
          }
        }
      ]),
      
      // Overall commission stats by status
      Commission.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            totalAmount: { $sum: '$commissionAmount' }
          }
        }
      ])
    ]);
    
    return {
      today: todayStats[0] || { totalUnlocked: 0, totalAmount: 0, avgAmount: 0 },
      readyToUnlock: pendingStats[0] || { totalPending: 0, totalAmount: 0 },
      overall: totalStats.reduce((acc, stat) => {
        acc[stat._id] = {
          count: stat.count,
          totalAmount: stat.totalAmount
        };
        return acc;
      }, {})
    };
    
  } catch (error) {
    logger.error('Error getting unlock stats:', {
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
}

/**
 * Get commissions that will unlock in the next N days
 */
async function getUpcomingUnlocks(days = 7) {
  try {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    
    const futureDate = new Date(today);
    futureDate.setDate(futureDate.getDate() + days);
    
    const upcomingCommissions = await Commission.find({
      status: 'pending',
      unlockDate: {
        $gt: today,
        $lte: futureDate
      }
    })
    .populate('recipientUserId', 'userId email firstName lastName')
    .populate('sourceUserId', 'userId email firstName lastName')
    .sort({ unlockDate: 1 });
    
    // Group by unlock date
    const groupedByDate = upcomingCommissions.reduce((acc, commission) => {
      const dateKey = commission.unlockDate.toISOString().split('T')[0];
      
      if (!acc[dateKey]) {
        acc[dateKey] = {
          date: commission.unlockDate,
          commissions: [],
          totalAmount: 0,
          count: 0
        };
      }
      
      acc[dateKey].commissions.push({
        commissionId: commission.commissionId,
        earner: {
          userId: commission.recipientUserId.userId,
          email: commission.recipientUserId.email,
          fullName: `${commission.recipientUserId.firstName} ${commission.recipientUserId.lastName}`
        },
        amount: commission.commissionAmount,
        currency: commission.currency,
        level: commission.level
      });
      
      acc[dateKey].totalAmount += commission.commissionAmount;
      acc[dateKey].count++;
      
      return acc;
    }, {});
    
    return {
      totalCommissions: upcomingCommissions.length,
      totalAmount: upcomingCommissions.reduce((sum, c) => sum + c.commissionAmount, 0),
      byDate: groupedByDate
    };
    
  } catch (error) {
    logger.error('Error getting upcoming unlocks:', {
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
}

// Schedule CRON job to run daily at 03:00 UTC
const cronJob = cron.schedule('0 3 * * *', async () => {
  try {
    await processCommissionUnlocks();
  } catch (error) {
    logger.error('CRON job failed:', {
      job: 'unlock-commissions',
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
  logger.info('Commission unlock CRON job started - runs daily at 03:00 UTC');
}

/**
 * Stop the CRON job
 */
function stopCronJob() {
  cronJob.stop();
  logger.info('Commission unlock CRON job stopped');
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
  processCommissionUnlocks,
  triggerManualUnlocking,
  getUnlockStats,
  getUpcomingUnlocks,
  startCronJob,
  stopCronJob,
  getCronStatus
};