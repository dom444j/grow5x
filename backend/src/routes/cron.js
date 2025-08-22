/**
 * CRON Management Routes
 * Administrative routes for managing CRON jobs and manual processing
 */

const express = require('express');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const cronManager = require('../cron');
const logger = require('../config/logger');

const router = express.Router();

// Apply admin authentication to all routes
router.use(authenticateToken, requireAdmin);

/**
 * GET /api/cron/status
 * Get status of all CRON jobs
 */
router.get('/status', async (req, res) => {
  try {
    const status = cronManager.getAllCronStatus();
    const healthCheck = cronManager.healthCheck();
    
    res.json({
      success: true,
      data: {
        status,
        health: healthCheck,
        jobs: {
          dailyBenefits: {
            name: 'Daily Benefits Processor',
            description: 'Processes 12.5% daily benefits for active purchases',
            schedule: 'Daily at 03:00 UTC',
            status: status.dailyBenefits
          },
          unlockCommissions: {
            name: 'Commission Unlock Processor',
            description: 'Unlocks pending commissions on D+9 and D+18',
            schedule: 'Daily at 03:00 UTC',
            status: status.unlockCommissions
          }
        }
      }
    });
    
  } catch (error) {
    logger.error('Get CRON status error:', {
      error: error.message,
      adminId: req.user?.userId,
      ip: req.ip
    });
    
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * GET /api/cron/stats
 * Get comprehensive processing statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = await cronManager.getAllProcessingStats();
    
    res.json({
      success: true,
      data: { stats }
    });
    
  } catch (error) {
    logger.error('Get CRON stats error:', {
      error: error.message,
      adminId: req.user?.userId,
      ip: req.ip
    });
    
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * POST /api/cron/trigger/all
 * Manually trigger all CRON processors
 */
router.post('/trigger/all', async (req, res) => {
  try {
    logger.info('Manual CRON trigger initiated by admin', {
      adminId: req.user.userId,
      ip: req.ip
    });
    
    const results = await cronManager.triggerAllProcessors();
    
    const hasErrors = results.errors.length > 0;
    
    res.status(hasErrors ? 207 : 200).json({
      success: !hasErrors,
      message: hasErrors 
        ? 'Procesamiento completado con algunos errores'
        : 'Procesamiento manual completado exitosamente',
      data: {
        results,
        summary: {
          dailyBenefitsProcessed: results.dailyBenefits?.processedCount || 0,
          commissionsUnlocked: results.unlockCommissions?.unlockedCount || 0,
          totalErrors: results.errors.length
        }
      }
    });
    
  } catch (error) {
    logger.error('Manual CRON trigger error:', {
      error: error.message,
      stack: error.stack,
      adminId: req.user?.userId,
      ip: req.ip
    });
    
    res.status(500).json({
      success: false,
      message: 'Error en el procesamiento manual',
      code: 'PROCESSING_ERROR'
    });
  }
});

/**
 * POST /api/cron/trigger/benefits
 * Manually trigger daily benefits processing
 */
router.post('/trigger/benefits', async (req, res) => {
  try {
    logger.info('Manual daily benefits trigger initiated by admin', {
      adminId: req.user.userId,
      ip: req.ip
    });
    
    const result = await cronManager.dailyBenefits.triggerManualProcessing();
    
    res.json({
      success: true,
      message: 'Procesamiento de beneficios diarios completado',
      data: {
        result,
        summary: {
          totalPurchases: result.totalPurchases,
          processedCount: result.processedCount,
          errorCount: result.errorCount,
          duration: result.duration
        }
      }
    });
    
  } catch (error) {
    logger.error('Manual benefits trigger error:', {
      error: error.message,
      stack: error.stack,
      adminId: req.user?.userId,
      ip: req.ip
    });
    
    res.status(500).json({
      success: false,
      message: 'Error en el procesamiento de beneficios',
      code: 'BENEFITS_PROCESSING_ERROR'
    });
  }
});

/**
 * POST /api/cron/trigger/commissions
 * Manually trigger commission unlock processing
 */
router.post('/trigger/commissions', async (req, res) => {
  try {
    logger.info('Manual commission unlock trigger initiated by admin', {
      adminId: req.user.userId,
      ip: req.ip
    });
    
    const result = await cronManager.unlockCommissions.triggerManualUnlocking();
    
    res.json({
      success: true,
      message: 'Procesamiento de desbloqueo de comisiones completado',
      data: {
        result,
        summary: {
          totalCommissions: result.totalCommissions,
          unlockedCount: result.unlockedCount,
          errorCount: result.errorCount,
          duration: result.duration
        }
      }
    });
    
  } catch (error) {
    logger.error('Manual commission unlock trigger error:', {
      error: error.message,
      stack: error.stack,
      adminId: req.user?.userId,
      ip: req.ip
    });
    
    res.status(500).json({
      success: false,
      message: 'Error en el desbloqueo de comisiones',
      code: 'COMMISSION_UNLOCK_ERROR'
    });
  }
});

/**
 * GET /api/cron/upcoming-unlocks
 * Get upcoming commission unlocks
 */
router.get('/upcoming-unlocks', async (req, res) => {
  try {
    const { days = 7 } = req.query;
    const upcomingUnlocks = await cronManager.unlockCommissions.getUpcomingUnlocks(parseInt(days));
    
    res.json({
      success: true,
      data: {
        upcomingUnlocks,
        period: `Next ${days} days`
      }
    });
    
  } catch (error) {
    logger.error('Get upcoming unlocks error:', {
      error: error.message,
      adminId: req.user?.userId,
      ip: req.ip
    });
    
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * POST /api/cron/restart
 * Restart all CRON jobs
 */
router.post('/restart', async (req, res) => {
  try {
    logger.info('CRON jobs restart initiated by admin', {
      adminId: req.user.userId,
      ip: req.ip
    });
    
    // Stop all jobs
    cronManager.stopAllCronJobs();
    
    // Wait a moment
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Start all jobs
    cronManager.initializeCronJobs();
    
    const status = cronManager.getAllCronStatus();
    
    res.json({
      success: true,
      message: 'Trabajos CRON reiniciados exitosamente',
      data: { status }
    });
    
  } catch (error) {
    logger.error('CRON restart error:', {
      error: error.message,
      stack: error.stack,
      adminId: req.user?.userId,
      ip: req.ip
    });
    
    res.status(500).json({
      success: false,
      message: 'Error al reiniciar trabajos CRON',
      code: 'CRON_RESTART_ERROR'
    });
  }
});

/**
 * GET /api/cron/health
 * Health check endpoint for CRON jobs
 */
router.get('/health', async (req, res) => {
  try {
    const healthCheck = cronManager.healthCheck();
    
    res.status(healthCheck.healthy ? 200 : 503).json({
      success: healthCheck.healthy,
      message: healthCheck.healthy 
        ? 'Todos los trabajos CRON están funcionando correctamente'
        : 'Algunos trabajos CRON no están funcionando',
      data: { healthCheck }
    });
    
  } catch (error) {
    logger.error('CRON health check error:', {
      error: error.message,
      adminId: req.user?.userId,
      ip: req.ip
    });
    
    res.status(503).json({
      success: false,
      message: 'Error en la verificación de salud de CRON',
      code: 'HEALTH_CHECK_ERROR'
    });
  }
});

module.exports = router;