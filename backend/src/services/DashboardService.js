const { User, Purchase, Commission, Withdrawal, BenefitSchedule } = require('../models');
const { toApiNumber } = require('../utils/decimal');
const { logInfo, logError, logWarn } = require('../utils/logger');
const redis = require('../config/redis');

class DashboardService {
  /**
   * Get optimized user dashboard data with caching
   * @param {ObjectId} userId - User MongoDB ObjectId
   * @param {string} userIdString - User custom userId string
   * @returns {Object} Dashboard data
   */
  static async getUserDashboard(userId, userIdString) {
    const cacheKey = `dashboard:user:${userId}`;
    const cacheTTL = 300; // 5 minutes

    logInfo(`Getting dashboard for user ${userId} (${userIdString})`);

    try {
      // Try to get cached data
      try {
        const cached = await redis.get(cacheKey);
        if (cached) {
          logInfo(`Cache hit for user ${userId}`);
          return JSON.parse(cached);
        }
      } catch (cacheError) {
        logWarn('Redis cache read error:', cacheError.message);
      }

      // Get user data
      logInfo(`Fetching user data for ${userId}`);
      const user = await User.findById(userId)
        .select('referralCode availableBalance totalInvested totalEarnings totalWithdrawn')
        .lean();

      if (!user) {
        logError(`User not found: ${userId}`);
        throw new Error('Usuario no encontrado');
      }
      logInfo(`User data fetched successfully for ${userId}`);

      // Optimized parallel aggregations with individual error tracking
      logInfo(`Starting parallel aggregations for user ${userId}`);
      
      const aggregationPromises = [
        this.getPurchaseStats(userIdString).catch(err => {
          logError(`getPurchaseStats failed for user ${userId}:`, err);
          throw err;
        }),
        this.getWithdrawalStats(userId).catch(err => {
          logError(`getWithdrawalStats failed for user ${userId}:`, err);
          throw err;
        }),
        this.getReferralStats(userId).catch(err => {
          logError(`getReferralStats failed for user ${userId}:`, err);
          throw err;
        }),
        this.getCommissionStats(userId).catch(err => {
          logError(`getCommissionStats failed for user ${userId}:`, err);
          throw err;
        }),
        this.getActiveLicenses(userId).catch(err => {
          logError(`getActiveLicenses failed for user ${userId}:`, err);
          throw err;
        })
      ];
      
      const [purchaseStats, withdrawalStats, referralStats, commissionStats, activeLicenses] = await Promise.all(aggregationPromises);
       logInfo(`Parallel aggregations completed for user ${userId}`);

      // Build dashboard data
      const dashboardData = {
        balance: {
          available: toApiNumber(Math.max(0, parseFloat(user.availableBalance?.toString() || '0'))),
          invested: toApiNumber(purchaseStats.totalInvested || 0), // Use calculated value from purchases
          withdrawn: toApiNumber(user.totalWithdrawn || 0),
          lockedCommissions: toApiNumber(commissionStats.lockedAmount || 0)
        },
        licenses: {
          active: purchaseStats.active || 0,
          completed: purchaseStats.completed || 0,
          total: purchaseStats.total || 0,
          details: activeLicenses || []
        },
        withdrawals: {
          pending: withdrawalStats.pending || 0,
          completed: withdrawalStats.completed || 0,
          totalAmount: toApiNumber(withdrawalStats.totalAmount || 0)
        },
        referral: {
          code: user.referralCode,
          total: referralStats.total || 0,
          active: referralStats.active || 0,
          totalCommissions: toApiNumber(commissionStats.totalEarned || 0)
        },
        stats: {
          totalInvested: toApiNumber(purchaseStats.totalInvested || 0), // Use calculated value from purchases
          totalWithdrawn: toApiNumber(user.totalWithdrawn || 0),
          totalEarnings: toApiNumber(user.totalEarnings || 0),
          pendingCommissions: toApiNumber(commissionStats.pendingAmount || 0)
        }
      };

      // Cache the result
      try {
        await redis.set(cacheKey, JSON.stringify(dashboardData), cacheTTL);
        logInfo(`Cache set for user ${userId}, TTL: ${cacheTTL}s`);
      } catch (cacheError) {
        logWarn('Redis cache write error:', cacheError.message);
      }

      return dashboardData;

    } catch (error) {
      logError('DashboardService.getUserDashboard error:', {
        error: error.message,
        userId,
        userIdString
      });
      throw error;
    }
  }

  /**
   * Get purchase statistics for user
   * @param {string} userIdString - User custom userId
   * @returns {Object} Purchase stats
   */
  static async getPurchaseStats(userIdString) {
    try {
      const stats = await Purchase.aggregate([
        {
          $match: { userId: userIdString }
        },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            totalAmount: { $sum: '$totalAmount' }
          }
        }
      ]);

      const result = {
        active: 0,
        completed: 0,
        total: 0,
        totalInvested: 0
      };

      stats.forEach(stat => {
        if (stat._id === 'ACTIVE') {
          result.active = stat.count;
        } else if (stat._id === 'COMPLETED') {
          result.completed = stat.count;
        }
        result.total += stat.count;
        result.totalInvested += stat.totalAmount || 0;
      });

      return result;
    } catch (error) {
      logger.error('DashboardService.getPurchaseStats error:', error);
      return { active: 0, completed: 0, total: 0, totalInvested: 0 };
    }
  }

  /**
   * Get withdrawal statistics for user
   * @param {ObjectId} userId - User MongoDB ObjectId
   * @returns {Object} Withdrawal stats
   */
  static async getWithdrawalStats(userId) {
    try {
      const stats = await Withdrawal.aggregate([
        {
          $match: { userId }
        },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            totalAmount: { $sum: { $toDouble: '$amount' } }
          }
        }
      ]);

      const result = {
        pending: 0,
        completed: 0,
        totalAmount: 0
      };

      stats.forEach(stat => {
        if (stat._id === 'PENDING') {
          result.pending = stat.count;
        } else if (stat._id === 'COMPLETED') {
          result.completed = stat.count;
          result.totalAmount += stat.totalAmount || 0;
        }
      });

      return result;
    } catch (error) {
      logger.error('DashboardService.getWithdrawalStats error:', error);
      return { pending: 0, completed: 0, totalAmount: 0 };
    }
  }

  /**
   * Get referral statistics for user
   * @param {ObjectId} userId - User MongoDB ObjectId
   * @returns {Object} Referral stats
   */
  static async getReferralStats(userId) {
    try {
      const stats = await User.aggregate([
        {
          $match: { referredBy: userId }
        },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]);

      const result = {
        total: 0,
        active: 0
      };

      stats.forEach(stat => {
        result.total += stat.count;
        if (stat._id === 'ACTIVE') {
          result.active = stat.count;
        }
      });

      return result;
    } catch (error) {
      logger.error('DashboardService.getReferralStats error:', error);
      return { total: 0, active: 0 };
    }
  }

  /**
   * Get commission statistics for user
   * @param {ObjectId} userId - User MongoDB ObjectId
   * @returns {Object} Commission stats
   */
  static async getCommissionStats(userId) {
    try {
      const stats = await Commission.aggregate([
        {
          $match: { recipientUserId: userId }
        },
        {
          $group: {
            _id: null,
            totalEarned: { $sum: '$commissionAmount' },
            locked: { $sum: { $cond: [{ $eq: ['$status', 'locked'] }, '$commissionAmount', 0] } },
            pending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, '$commissionAmount', 0] } },
            unlocked: { $sum: { $cond: [{ $eq: ['$status', 'unlocked'] }, '$commissionAmount', 0] } }
          }
        }
      ]);

      const result = stats[0] || {
        totalEarned: 0,
        locked: 0,
        pending: 0,
        unlocked: 0
      };

      return {
        totalEarned: result.totalEarned || 0,
        lockedAmount: result.locked || 0,
        pendingAmount: result.pending || 0,
        unlockedAmount: result.unlocked || 0
      };
    } catch (error) {
      logger.error('DashboardService.getCommissionStats error:', error);
      return { totalEarned: 0, lockedAmount: 0, pendingAmount: 0, unlockedAmount: 0 };
    }
  }

  /**
   * Get active licenses with detailed information
   * @param {ObjectId} userId - User MongoDB ObjectId
   * @returns {Array} Active licenses with details
   */
  static async getActiveLicenses(userId) {
    try {
      const activeLicenses = await BenefitSchedule.find({
        userId,
        type: 'BENEFIT',
        scheduleStatus: 'active'
      })
      .populate({
        path: 'purchaseId',
        select: 'packageId totalAmount paymentHash assignedWallet confirmedAt',
        populate: {
          path: 'packageId',
          select: 'name price'
        }
      })
      .select('purchaseAmount dailyBenefitAmount dailyRate days daysReleased totalReleased scheduleStatus startAt statusByDay')
      .lean();

      return activeLicenses.map(license => {
        const remainingDays = Math.max(0, license.days - license.daysReleased);
        const progressPercent = license.days > 0 ? (license.daysReleased / license.days) * 100 : 0;
        const remainingAmount = license.purchaseAmount - license.totalReleased;
        
        return {
          _id: license._id,
          purchaseId: license.purchaseId?._id,
          packageName: license.purchaseId?.packageId?.name || 'N/A',
          principalAmount: toApiNumber(license.purchaseAmount),
          dailyBenefitAmount: toApiNumber(license.dailyBenefitAmount),
          dailyRate: license.dailyRate,
          totalDays: license.days,
          daysReleased: license.daysReleased,
          remainingDays,
          totalReleased: toApiNumber(license.totalReleased),
          remainingAmount: toApiNumber(remainingAmount),
          progressPercent: Math.round(progressPercent * 100) / 100,
          status: license.scheduleStatus,
          startDate: license.startAt,
          paymentHash: license.purchaseId?.paymentHash,
          walletAddress: license.purchaseId?.assignedWallet?.address
        };
      });
    } catch (error) {
      logger.error('DashboardService.getActiveLicenses error:', error);
      return [];
    }
  }

  /**
   * Clear user dashboard cache
   * @param {ObjectId} userId - User MongoDB ObjectId
   */
  static async clearUserCache(userId) {
    try {
      const cacheKey = `dashboard:user:${userId}`;
      await redis.del(cacheKey);
    } catch (error) {
      logger.error('DashboardService.clearUserCache error:', error);
    }
  }

  /**
   * Get admin dashboard metrics with caching
   * @returns {Object} Admin dashboard metrics
   */
  static async getAdminDashboard() {
    const cacheKey = 'dashboard:admin:metrics';
    const cacheTTL = 900; // 15 minutes

    try {
      // Try to get from cache first
      const cached = await redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      // Get admin metrics with parallel aggregations
      const [userMetrics, purchaseMetrics, commissionMetrics, withdrawalMetrics] = await Promise.all([
        this.getAdminUserMetrics(),
        this.getAdminPurchaseMetrics(),
        this.getAdminCommissionMetrics(),
        this.getAdminWithdrawalMetrics()
      ]);

      const adminData = {
        users: userMetrics,
        purchases: purchaseMetrics,
        commissions: commissionMetrics,
        withdrawals: withdrawalMetrics,
        timestamp: new Date()
      };

      // Cache the result
      await redis.setex(cacheKey, cacheTTL, JSON.stringify(adminData));

      return adminData;

    } catch (error) {
      logger.error('DashboardService.getAdminDashboard error:', error);
      throw error;
    }
  }

  /**
   * Get admin user metrics
   * @returns {Object} User metrics
   */
  static async getAdminUserMetrics() {
    try {
      const metrics = await User.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            totalBalance: { $sum: '$availableBalance' },
            totalInvested: { $sum: '$totalInvested' }
          }
        }
      ]);

      const result = {
        total: 0,
        active: 0,
        totalBalance: 0,
        totalInvested: 0
      };

      metrics.forEach(metric => {
        result.total += metric.count;
        result.totalBalance += metric.totalBalance || 0;
        result.totalInvested += metric.totalInvested || 0;
        
        if (metric._id === 'ACTIVE') {
          result.active = metric.count;
        }
      });

      return result;
    } catch (error) {
      logger.error('DashboardService.getAdminUserMetrics error:', error);
      return { total: 0, active: 0, totalBalance: 0, totalInvested: 0 };
    }
  }

  /**
   * Get admin purchase metrics
   * @returns {Object} Purchase metrics
   */
  static async getAdminPurchaseMetrics() {
    try {
      const metrics = await Purchase.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            totalAmount: { $sum: '$totalAmount' }
          }
        }
      ]);

      const result = {
        total: 0,
        active: 0,
        completed: 0,
        totalRevenue: 0
      };

      metrics.forEach(metric => {
        result.total += metric.count;
        result.totalRevenue += metric.totalAmount || 0;
        
        if (metric._id === 'ACTIVE') {
          result.active = metric.count;
        } else if (metric._id === 'COMPLETED') {
          result.completed = metric.count;
        }
      });

      return result;
    } catch (error) {
      logger.error('DashboardService.getAdminPurchaseMetrics error:', error);
      return { total: 0, active: 0, completed: 0, totalRevenue: 0 };
    }
  }

  /**
   * Get admin commission metrics
   * @returns {Object} Commission metrics
   */
  static async getAdminCommissionMetrics() {
    try {
      const metrics = await Commission.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            totalAmount: { $sum: '$commissionAmount' }
          }
        }
      ]);

      const result = {
        total: 0,
        locked: 0,
        unlocked: 0,
        totalAmount: 0,
        lockedAmount: 0,
        unlockedAmount: 0
      };

      metrics.forEach(metric => {
        result.total += metric.count;
        result.totalAmount += metric.totalAmount || 0;
        
        if (metric._id === 'locked') {
          result.locked = metric.count;
          result.lockedAmount = metric.totalAmount || 0;
        } else if (metric._id === 'unlocked') {
          result.unlocked = metric.count;
          result.unlockedAmount = metric.totalAmount || 0;
        }
      });

      return result;
    } catch (error) {
      logger.error('DashboardService.getAdminCommissionMetrics error:', error);
      return { total: 0, locked: 0, unlocked: 0, totalAmount: 0, lockedAmount: 0, unlockedAmount: 0 };
    }
  }

  /**
   * Get admin withdrawal metrics
   * @returns {Object} Withdrawal metrics
   */
  static async getAdminWithdrawalMetrics() {
    try {
      const metrics = await Withdrawal.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            totalAmount: { $sum: '$amount' }
          }
        }
      ]);

      const result = {
        total: 0,
        pending: 0,
        completed: 0,
        totalAmount: 0,
        pendingAmount: 0,
        completedAmount: 0
      };

      metrics.forEach(metric => {
        result.total += metric.count;
        result.totalAmount += metric.totalAmount || 0;
        
        if (metric._id === 'PENDING') {
          result.pending = metric.count;
          result.pendingAmount = metric.totalAmount || 0;
        } else if (metric._id === 'COMPLETED') {
          result.completed = metric.count;
          result.completedAmount = metric.totalAmount || 0;
        }
      });

      return result;
    } catch (error) {
      logger.error('DashboardService.getAdminWithdrawalMetrics error:', error);
      return { total: 0, pending: 0, completed: 0, totalAmount: 0, pendingAmount: 0, completedAmount: 0 };
    }
  }
}

module.exports = DashboardService;