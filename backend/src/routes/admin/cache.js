const express = require('express');
const router = express.Router();
const { z } = require('zod');
const rateLimit = require('express-rate-limit');
const { 
  getCacheStats, 
  flushCache, 
  deleteFromCache, 
  invalidateCachePattern 
} = require('../../middleware/redisCache');
const { sessionService } = require('../../services/redisSessionService');
const { authenticateToken, requireRole } = require('../../middleware/auth');
const logger = require('../../config/logger');

// Rate limiting para operaciones administrativas
const adminCacheLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 50, // máximo 50 requests por ventana
  message: {
    error: 'Demasiadas operaciones de cache. Intenta de nuevo en 15 minutos.',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Esquemas de validación
const cacheKeySchema = z.object({
  key: z.string().min(1).max(200),
  pattern: z.boolean().optional().default(false)
});

const cacheKeysSchema = z.object({
  keys: z.array(z.string().min(1).max(200)).min(1).max(50)
});

const cachePatternSchema = z.object({
  pattern: z.string().min(1).max(200)
});

/**
 * @route GET /api/admin/cache/stats
 * @desc Obtener estadísticas del cache Redis
 * @access Admin
 */
router.get('/stats', 
  adminCacheLimit,
  authenticateToken, 
  requireRole(['admin']), 
  async (req, res) => {
    try {
      // Obtener estadísticas del cache
      const cacheStats = await getCacheStats();
      
      // Obtener estadísticas de sesiones
      const sessionStats = await sessionService.getSessionStats();
      
      const stats = {
        cache: cacheStats,
        sessions: sessionStats,
        timestamp: new Date().toISOString()
      };
      
      logger.info('Cache stats retrieved', {
        adminId: req.user.userId,
        stats
      });
      
      res.json({
        success: true,
        data: stats
      });
      
    } catch (error) {
      logger.error('Error getting cache stats', {
        adminId: req.user.userId,
        error: error.message
      });
      
      res.status(500).json({
        success: false,
        error: 'Error interno del servidor',
        code: 'CACHE_STATS_ERROR'
      });
    }
  }
);

/**
 * @route POST /api/admin/cache/flush
 * @desc Limpiar todo el cache Redis
 * @access Admin
 */
router.post('/flush', 
  adminCacheLimit,
  authenticateToken, 
  requireRole(['admin']), 
  async (req, res) => {
    try {
      const success = await flushCache();
      
      if (success) {
        logger.warn('Cache flushed by admin', {
          adminId: req.user.userId,
          timestamp: new Date().toISOString()
        });
        
        res.json({
          success: true,
          message: 'Cache limpiado exitosamente'
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Error al limpiar el cache',
          code: 'CACHE_FLUSH_ERROR'
        });
      }
      
    } catch (error) {
      logger.error('Error flushing cache', {
        adminId: req.user.userId,
        error: error.message
      });
      
      res.status(500).json({
        success: false,
        error: 'Error interno del servidor',
        code: 'CACHE_FLUSH_ERROR'
      });
    }
  }
);

/**
 * @route DELETE /api/admin/cache/key
 * @desc Eliminar una clave específica del cache
 * @access Admin
 */
router.delete('/key', 
  adminCacheLimit,
  authenticateToken, 
  requireRole(['admin']), 
  async (req, res) => {
    try {
      const validation = cacheKeySchema.safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: 'Datos de entrada inválidos',
          details: validation.error.errors,
          code: 'VALIDATION_ERROR'
        });
      }
      
      const { key, pattern } = validation.data;
      
      let deletedCount = 0;
      
      if (pattern) {
        // Eliminar por patrón
        await invalidateCachePattern(key);
        deletedCount = 1; // Aproximado
      } else {
        // Eliminar clave específica
        deletedCount = await deleteFromCache(key);
      }
      
      logger.info('Cache key deleted by admin', {
        adminId: req.user.userId,
        key,
        pattern,
        deletedCount
      });
      
      res.json({
        success: true,
        message: `${deletedCount} clave(s) eliminada(s)`,
        deletedCount
      });
      
    } catch (error) {
      logger.error('Error deleting cache key', {
        adminId: req.user.userId,
        error: error.message
      });
      
      res.status(500).json({
        success: false,
        error: 'Error interno del servidor',
        code: 'CACHE_DELETE_ERROR'
      });
    }
  }
);

/**
 * @route DELETE /api/admin/cache/keys
 * @desc Eliminar múltiples claves del cache
 * @access Admin
 */
router.delete('/keys', 
  adminCacheLimit,
  authenticateToken, 
  requireRole(['admin']), 
  async (req, res) => {
    try {
      const validation = cacheKeysSchema.safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: 'Datos de entrada inválidos',
          details: validation.error.errors,
          code: 'VALIDATION_ERROR'
        });
      }
      
      const { keys } = validation.data;
      
      const deletedCount = await deleteFromCache(keys);
      
      logger.info('Multiple cache keys deleted by admin', {
        adminId: req.user.userId,
        keys,
        deletedCount
      });
      
      res.json({
        success: true,
        message: `${deletedCount} clave(s) eliminada(s)`,
        deletedCount
      });
      
    } catch (error) {
      logger.error('Error deleting cache keys', {
        adminId: req.user.userId,
        error: error.message
      });
      
      res.status(500).json({
        success: false,
        error: 'Error interno del servidor',
        code: 'CACHE_DELETE_ERROR'
      });
    }
  }
);

/**
 * @route POST /api/admin/cache/invalidate
 * @desc Invalidar cache por patrón
 * @access Admin
 */
router.post('/invalidate', 
  adminCacheLimit,
  authenticateToken, 
  requireRole(['admin']), 
  async (req, res) => {
    try {
      const validation = cachePatternSchema.safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: 'Datos de entrada inválidos',
          details: validation.error.errors,
          code: 'VALIDATION_ERROR'
        });
      }
      
      const { pattern } = validation.data;
      
      await invalidateCachePattern(pattern);
      
      logger.info('Cache invalidated by pattern', {
        adminId: req.user.userId,
        pattern
      });
      
      res.json({
        success: true,
        message: 'Cache invalidado exitosamente',
        pattern
      });
      
    } catch (error) {
      logger.error('Error invalidating cache', {
        adminId: req.user.userId,
        error: error.message
      });
      
      res.status(500).json({
        success: false,
        error: 'Error interno del servidor',
        code: 'CACHE_INVALIDATE_ERROR'
      });
    }
  }
);

/**
 * @route GET /api/admin/cache/sessions
 * @desc Obtener estadísticas detalladas de sesiones
 * @access Admin
 */
router.get('/sessions', 
  adminCacheLimit,
  authenticateToken, 
  requireRole(['admin']), 
  async (req, res) => {
    try {
      const stats = await sessionService.getSessionStats();
      
      logger.info('Session stats retrieved', {
        adminId: req.user.userId,
        stats
      });
      
      res.json({
        success: true,
        data: stats
      });
      
    } catch (error) {
      logger.error('Error getting session stats', {
        adminId: req.user.userId,
        error: error.message
      });
      
      res.status(500).json({
        success: false,
        error: 'Error interno del servidor',
        code: 'SESSION_STATS_ERROR'
      });
    }
  }
);

/**
 * @route POST /api/admin/cache/sessions/cleanup
 * @desc Limpiar sesiones expiradas
 * @access Admin
 */
router.post('/sessions/cleanup', 
  adminCacheLimit,
  authenticateToken, 
  requireRole(['admin']), 
  async (req, res) => {
    try {
      const cleanedCount = await sessionService.cleanupExpiredSessions();
      
      logger.info('Expired sessions cleaned by admin', {
        adminId: req.user.userId,
        cleanedCount
      });
      
      res.json({
        success: true,
        message: `${cleanedCount} sesiones expiradas limpiadas`,
        cleanedCount
      });
      
    } catch (error) {
      logger.error('Error cleaning expired sessions', {
        adminId: req.user.userId,
        error: error.message
      });
      
      res.status(500).json({
        success: false,
        error: 'Error interno del servidor',
        code: 'SESSION_CLEANUP_ERROR'
      });
    }
  }
);

/**
 * @route DELETE /api/admin/cache/sessions/:userId
 * @desc Eliminar todas las sesiones de un usuario específico
 * @access Admin
 */
router.delete('/sessions/:userId', 
  adminCacheLimit,
  authenticateToken, 
  requireRole(['admin']), 
  async (req, res) => {
    try {
      const { userId } = req.params;
      
      if (!userId || userId.length < 1) {
        return res.status(400).json({
          success: false,
          error: 'ID de usuario requerido',
          code: 'VALIDATION_ERROR'
        });
      }
      
      const deletedCount = await sessionService.deleteAllUserSessions(userId);
      
      logger.warn('User sessions deleted by admin', {
        adminId: req.user.userId,
        targetUserId: userId,
        deletedCount
      });
      
      res.json({
        success: true,
        message: `${deletedCount} sesiones eliminadas para el usuario`,
        deletedCount,
        userId
      });
      
    } catch (error) {
      logger.error('Error deleting user sessions', {
        adminId: req.user.userId,
        targetUserId: req.params.userId,
        error: error.message
      });
      
      res.status(500).json({
        success: false,
        error: 'Error interno del servidor',
        code: 'SESSION_DELETE_ERROR'
      });
    }
  }
);

/**
 * @route GET /api/admin/cache/health
 * @desc Verificar el estado de salud del sistema de cache
 * @access Admin
 */
router.get('/health', 
  adminCacheLimit,
  authenticateToken, 
  requireRole(['admin']), 
  async (req, res) => {
    try {
      const cacheStats = await getCacheStats();
      const sessionStats = await sessionService.getSessionStats();
      
      const health = {
        cache: {
          connected: cacheStats.connected,
          memoryUsed: cacheStats.memoryUsed,
          totalKeys: cacheStats.totalKeys,
          hitRate: cacheStats.hitRate
        },
        sessions: {
          connected: sessionStats.connected,
          activeSessions: sessionStats.activeSessions,
          activeTokens: sessionStats.activeTokens,
          activeOTPs: sessionStats.activeOTPs
        },
        overall: {
          healthy: cacheStats.connected && sessionStats.connected,
          timestamp: new Date().toISOString()
        }
      };
      
      const statusCode = health.overall.healthy ? 200 : 503;
      
      res.status(statusCode).json({
        success: health.overall.healthy,
        data: health
      });
      
    } catch (error) {
      logger.error('Error checking cache health', {
        adminId: req.user.userId,
        error: error.message
      });
      
      res.status(503).json({
        success: false,
        error: 'Error al verificar el estado del cache',
        code: 'CACHE_HEALTH_ERROR'
      });
    }
  }
);

module.exports = router;