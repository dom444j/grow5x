/**
 * Cache Administration Routes
 * Provides endpoints for cache monitoring and management
 */

const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/rbac');
const CacheInvalidationService = require('../services/cacheInvalidationService');
const logger = require('../config/logger');
const { middleware: responseStandardizer } = require('../middleware/responseStandardizer');

const router = express.Router();

/**
 * GET /api/admin/cache/stats
 * Get cache statistics for monitoring
 */
router.get('/stats', authenticateToken, requireAdmin, responseStandardizer, async (req, res) => {
  try {
    const stats = CacheInvalidationService.getCacheStats();
    
    res.json({
      success: true,
      data: stats,
      message: 'Cache statistics retrieved successfully'
    });
    
  } catch (error) {
    logger.error('Error getting cache stats:', {
      adminId: req.user?.userId,
      error: error.message,
      stack: error.stack
    });
    
    res.status(500).json({
      success: false,
      error: 'Error retrieving cache statistics',
      code: 'CACHE_STATS_ERROR'
    });
  }
});

/**
 * POST /api/admin/cache/clear
 * Clear all caches (nuclear option)
 */
router.post('/clear', authenticateToken, requireAdmin, responseStandardizer, async (req, res) => {
  try {
    CacheInvalidationService.clearAllCaches();
    
    logger.info('All caches cleared by admin:', {
      adminId: req.user.userId,
      ip: req.ip
    });
    
    res.json({
      success: true,
      message: 'All caches cleared successfully'
    });
    
  } catch (error) {
    logger.error('Error clearing all caches:', {
      adminId: req.user?.userId,
      error: error.message,
      stack: error.stack
    });
    
    res.status(500).json({
      success: false,
      error: 'Error clearing caches',
      code: 'CACHE_CLEAR_ERROR'
    });
  }
});

/**
 * POST /api/admin/cache/clear/user/:userId
 * Clear cache for a specific user
 */
router.post('/clear/user/:userId', authenticateToken, requireAdmin, responseStandardizer, async (req, res) => {
  try {
    const { userId } = req.params;
    
    CacheInvalidationService.invalidateUserCache(userId);
    
    logger.info('User cache cleared by admin:', {
      adminId: req.user.userId,
      targetUserId: userId,
      ip: req.ip
    });
    
    res.json({
      success: true,
      message: `Cache cleared for user ${userId}`
    });
    
  } catch (error) {
    logger.error('Error clearing user cache:', {
      adminId: req.user?.userId,
      targetUserId: req.params.userId,
      error: error.message,
      stack: error.stack
    });
    
    res.status(500).json({
      success: false,
      error: 'Error clearing user cache',
      code: 'USER_CACHE_CLEAR_ERROR'
    });
  }
});

/**
 * POST /api/admin/cache/clear/admin
 * Clear all admin caches
 */
router.post('/clear/admin', authenticateToken, requireAdmin, responseStandardizer, async (req, res) => {
  try {
    CacheInvalidationService.invalidateAllAdminCaches();
    
    logger.info('All admin caches cleared by admin:', {
      adminId: req.user.userId,
      ip: req.ip
    });
    
    res.json({
      success: true,
      message: 'All admin caches cleared successfully'
    });
    
  } catch (error) {
    logger.error('Error clearing admin caches:', {
      adminId: req.user?.userId,
      error: error.message,
      stack: error.stack
    });
    
    res.status(500).json({
      success: false,
      error: 'Error clearing admin caches',
      code: 'ADMIN_CACHE_CLEAR_ERROR'
    });
  }
});

/**
 * POST /api/admin/cache/clear/users
 * Clear all user caches
 */
router.post('/clear/users', authenticateToken, requireAdmin, responseStandardizer, async (req, res) => {
  try {
    CacheInvalidationService.invalidateAllUserCaches();
    
    logger.info('All user caches cleared by admin:', {
      adminId: req.user.userId,
      ip: req.ip
    });
    
    res.json({
      success: true,
      message: 'All user caches cleared successfully'
    });
    
  } catch (error) {
    logger.error('Error clearing user caches:', {
      adminId: req.user?.userId,
      error: error.message,
      stack: error.stack
    });
    
    res.status(500).json({
      success: false,
      error: 'Error clearing user caches',
      code: 'USER_CACHES_CLEAR_ERROR'
    });
  }
});

module.exports = router;