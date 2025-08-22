const { clearCache } = require('../middleware/cache');
const { clearRoleCache } = require('../middleware/rbac');
const { invalidateCache: invalidateCommissionsCache } = require('../config/commissions');
const cohortService = require('./cohortService');
const logger = require('../config/logger');

/**
 * Service for managing cache invalidation across the application
 * Ensures data consistency by clearing relevant caches when data changes
 */
class CacheInvalidationService {
  /**
   * Invalidate user-specific caches
   * @param {string} userId - User ID to invalidate caches for
   */
  static invalidateUserCache(userId) {
    try {
      // Clear user dashboard cache
      clearCache(`user:dashboard:${userId}`);
      
      // Clear user role cache
      clearRoleCache(userId);
      
      logger.info('User cache invalidated', { userId });
    } catch (error) {
      logger.error('Error invalidating user cache', { userId, error: error.message });
    }
  }

  /**
   * Invalidate admin-specific caches
   * @param {string} adminId - Admin ID to invalidate caches for
   */
  static invalidateAdminCache(adminId) {
    try {
      // Clear admin overview cache
      clearCache(`admin:overview:${adminId}`);
      
      // Clear admin role cache
      clearRoleCache(adminId);
      
      logger.info('Admin cache invalidated', { adminId });
    } catch (error) {
      logger.error('Error invalidating admin cache', { adminId, error: error.message });
    }
  }

  /**
   * Invalidate all admin caches (for system-wide changes)
   */
  static invalidateAllAdminCaches() {
    try {
      clearCache(/^admin:/);
      logger.info('All admin caches invalidated');
    } catch (error) {
      logger.error('Error invalidating all admin caches', { error: error.message });
    }
  }

  /**
   * Invalidate all user caches (for system-wide changes)
   */
  static invalidateAllUserCaches() {
    try {
      clearCache(/^user:/);
      logger.info('All user caches invalidated');
    } catch (error) {
      logger.error('Error invalidating all user caches', { error: error.message });
    }
  }

  /**
   * Invalidate purchase-related caches
   * @param {string} userId - User ID whose purchase data changed
   */
  static invalidatePurchaseCache(userId) {
    try {
      // Invalidate user dashboard (shows purchase stats)
      this.invalidateUserCache(userId);
      
      // Invalidate admin overview (shows system-wide purchase stats)
      this.invalidateAllAdminCaches();
      
      logger.info('Purchase cache invalidated', { userId });
    } catch (error) {
      logger.error('Error invalidating purchase cache', { userId, error: error.message });
    }
  }

  /**
   * Invalidate withdrawal-related caches
   * @param {string} userId - User ID whose withdrawal data changed
   */
  static invalidateWithdrawalCache(userId) {
    try {
      // Invalidate user dashboard (shows withdrawal stats)
      this.invalidateUserCache(userId);
      
      // Invalidate admin overview (shows system-wide withdrawal stats)
      this.invalidateAllAdminCaches();
      
      logger.info('Withdrawal cache invalidated', { userId });
    } catch (error) {
      logger.error('Error invalidating withdrawal cache', { userId, error: error.message });
    }
  }

  /**
   * Invalidate balance-related caches
   * @param {string} userId - User ID whose balance changed
   */
  static invalidateBalanceCache(userId) {
    try {
      // Invalidate user dashboard and profile (shows balance)
      this.invalidateUserCache(userId);
      
      logger.info('Balance cache invalidated', { userId });
    } catch (error) {
      logger.error('Error invalidating balance cache', { userId, error: error.message });
    }
  }

  /**
   * Invalidate commission-related caches
   */
  static invalidateCommissionCache() {
    try {
      // Invalidate commissions config cache
      invalidateCommissionsCache();
      
      // Invalidate all admin caches (commission changes affect admin views)
      this.invalidateAllAdminCaches();
      
      logger.info('Commission cache invalidated');
    } catch (error) {
      logger.error('Error invalidating commission cache', { error: error.message });
    }
  }

  /**
   * Invalidate cohort-related caches
   * @param {string} batchId - Batch ID to invalidate cohort cache for
   */
  static invalidateCohortCache(batchId) {
    try {
      if (batchId) {
        cohortService.invalidateCohortCache(batchId);
      } else {
        cohortService.clearAllCache();
      }
      
      // Invalidate admin caches (cohort changes affect admin views)
      this.invalidateAllAdminCaches();
      
      logger.info('Cohort cache invalidated', { batchId });
    } catch (error) {
      logger.error('Error invalidating cohort cache', { batchId, error: error.message });
    }
  }

  /**
   * Invalidate role-related caches
   * @param {string} userId - User ID whose role changed
   */
  static invalidateRoleCache(userId) {
    try {
      // Clear role cache
      clearRoleCache(userId);
      
      // Invalidate user cache (role affects permissions)
      this.invalidateUserCache(userId);
      
      logger.info('Role cache invalidated', { userId });
    } catch (error) {
      logger.error('Error invalidating role cache', { userId, error: error.message });
    }
  }

  /**
   * Clear all caches (nuclear option for major system changes)
   */
  static clearAllCaches() {
    try {
      clearCache(); // Clear all HTTP response cache
      clearRoleCache(); // Clear all role cache
      invalidateCommissionsCache(); // Clear commissions cache
      cohortService.clearAllCache(); // Clear cohort cache
      
      logger.info('All caches cleared');
    } catch (error) {
      logger.error('Error clearing all caches', { error: error.message });
    }
  }

  /**
   * Get cache statistics for monitoring
   * @returns {Object} Cache statistics
   */
  static getCacheStats() {
    try {
      const { getCacheStats } = require('../middleware/cache');
      const httpCache = getCacheStats();
      const cohortStats = cohortService.getCacheStats();
      
      return {
        httpCache,
        cohortCache: cohortStats,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Error getting cache stats', { error: error.message });
      return { error: error.message };
    }
  }
}

module.exports = CacheInvalidationService;