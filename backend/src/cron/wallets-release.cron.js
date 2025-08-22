/**
 * Wallets Release Cron Job
 * Releases wallets from cooldown and expired assignments
 * Runs every 5 minutes to ensure timely wallet availability
 */

const cron = require('node-cron');
const { Wallet, Purchase } = require('../models');
const logger = require('../config/logger');

/**
 * Release wallets from cooldown when cooldown period expires
 */
async function releaseWalletsFromCooldown() {
  try {
    const now = new Date();
    
    // Find wallets in cooldown that should be released
    const result = await Wallet.updateMany(
      {
        status: 'cooldown',
        cooldownUntil: { $lte: now }
      },
      {
        $set: { status: 'available' },
        $unset: { cooldownUntil: 1 }
      }
    );
    
    if (result.modifiedCount > 0) {
      logger.info(`Released ${result.modifiedCount} wallets from cooldown`, {
        releasedAt: now,
        modifiedCount: result.modifiedCount
      });
    }
    
    return result.modifiedCount;
  } catch (error) {
    logger.error('Error releasing wallets from cooldown:', error);
    throw error;
  }
}

/**
 * Release wallets from expired purchase assignments
 */
async function releaseExpiredAssignments() {
  try {
    const now = new Date();
    
    // Find wallets with expired assignments
    const expiredWallets = await Wallet.find({
      status: 'assigned',
      'currentAssignment.expiresAt': { $lt: now }
    });
    
    if (expiredWallets.length === 0) {
      return 0;
    }
    
    // Process each expired wallet
    let releasedCount = 0;
    for (const wallet of expiredWallets) {
      try {
        // Mark associated purchase as expired if still pending
        if (wallet.currentAssignment && wallet.currentAssignment.purchaseId) {
          await Purchase.updateOne(
            {
              _id: wallet.currentAssignment.purchaseId,
              status: 'pending'
            },
            {
              $set: {
                status: 'expired',
                expiredAt: now
              }
            }
          );
        }
        
        // Release wallet with cooldown
        await wallet.releaseOnExpiration();
        releasedCount++;
        
        logger.info('Released expired wallet assignment', {
          walletId: wallet._id,
          walletAddress: wallet.address,
          purchaseId: wallet.currentAssignment?.purchaseId,
          expiredAt: wallet.currentAssignment?.expiresAt,
          releasedAt: now
        });
        
      } catch (error) {
        logger.error('Error releasing individual wallet assignment:', {
          walletId: wallet._id,
          error: error.message
        });
      }
    }
    
    if (releasedCount > 0) {
      logger.info(`Released ${releasedCount} expired wallet assignments`);
    }
    
    return releasedCount;
  } catch (error) {
    logger.error('Error releasing expired assignments:', error);
    throw error;
  }
}

/**
 * Main wallet maintenance function
 */
async function maintainWalletPool() {
  try {
    logger.debug('Starting wallet pool maintenance...');
    
    const [cooldownReleased, expiredReleased] = await Promise.all([
      releaseWalletsFromCooldown(),
      releaseExpiredAssignments()
    ]);
    
    // Log summary statistics
    const stats = await Wallet.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);
    
    const statusCounts = stats.reduce((acc, stat) => {
      acc[stat._id] = stat.count;
      return acc;
    }, {});
    
    logger.info('Wallet pool maintenance completed', {
      cooldownReleased,
      expiredReleased,
      currentStats: statusCounts,
      timestamp: new Date()
    });
    
  } catch (error) {
    logger.error('Wallet pool maintenance failed:', error);
  }
}

/**
 * Schedule the cron job
 * Runs every 5 minutes
 */
const scheduleWalletMaintenance = () => {
  // Every 5 minutes
  cron.schedule('*/5 * * * *', maintainWalletPool, {
    scheduled: true,
    timezone: 'UTC'
  });
  
  logger.info('Wallet maintenance cron job scheduled (every 5 minutes)');
};

/**
 * Manual trigger for testing/admin purposes
 */
const triggerWalletMaintenance = async () => {
  logger.info('Manual wallet maintenance triggered');
  await maintainWalletPool();
};

module.exports = {
  scheduleWalletMaintenance,
  triggerWalletMaintenance,
  maintainWalletPool,
  releaseWalletsFromCooldown,
  releaseExpiredAssignments
};