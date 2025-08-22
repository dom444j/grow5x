const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../../middleware/auth');
const DailyProcessingState = require('../../models/DailyProcessingState');
const dailyBenefitsV2 = require('../../cron/daily-benefits-v2.cron');
const logger = require('../../config/logger');

/**
 * Get daily benefits processing status and history
 * GET /api/admin/daily-benefits/status
 */
router.get('/status', authenticateToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const { days = 7 } = req.query;
    
    // Get current date in Bogota timezone
    const today = new Date();
    const bogotaTime = new Date(today.toLocaleString("en-US", {timeZone: "America/Bogota"}));
    const todayStr = bogotaTime.toISOString().split('T')[0];
    
    // Calculate start date
    const startDate = new Date(bogotaTime);
    startDate.setDate(startDate.getDate() - parseInt(days));
    const startDateStr = startDate.toISOString().split('T')[0];
    
    // Get processing states for the date range
    const processingStates = await DailyProcessingState.getProcessingStats(startDateStr, todayStr);
    
    // Get cron job status
    const cronStatus = dailyBenefitsV2.getCronStatus();
    
    // Calculate summary statistics
    const summary = {
      totalDays: processingStates.length,
      completedDays: processingStates.filter(s => s.status === 'completed').length,
      failedDays: processingStates.filter(s => s.status === 'failed').length,
      processingDays: processingStates.filter(s => s.status === 'processing').length,
      totalBenefitAmount: processingStates.reduce((sum, s) => sum + (s.stats?.totalBenefitAmount || 0), 0),
      totalCommissionAmount: processingStates.reduce((sum, s) => sum + (s.stats?.totalCommissionAmount || 0), 0),
      totalProcessedPurchases: processingStates.reduce((sum, s) => sum + (s.stats?.processedPurchases || 0), 0),
      averageDuration: processingStates.length > 0 
        ? processingStates.reduce((sum, s) => sum + (s.stats?.durationMs || 0), 0) / processingStates.length
        : 0
    };
    
    res.json({
      success: true,
      data: {
        cronStatus,
        summary,
        processingStates,
        currentDate: todayStr,
        timezone: 'America/Bogota'
      }
    });
    
  } catch (error) {
    logger.error('Error getting daily benefits status:', {
      error: error.message,
      stack: error.stack,
      userId: req.user?.id
    });
    
    res.status(500).json({
      success: false,
      message: 'Error retrieving daily benefits status',
      error: error.message
    });
  }
});

/**
 * Manually trigger daily benefits processing for a specific date
 * POST /api/admin/daily-benefits/trigger
 */
router.post('/trigger', authenticateToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const { date, force = false } = req.body;
    
    if (!date) {
      return res.status(400).json({
        success: false,
        message: 'Date is required (YYYY-MM-DD format)'
      });
    }
    
    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date format. Use YYYY-MM-DD'
      });
    }
    
    // Check if already processed (unless force is true)
    if (!force) {
      const existingState = await DailyProcessingState.getProcessingState(date);
      if (existingState && existingState.status === 'completed') {
        return res.status(409).json({
          success: false,
          message: `Benefits for ${date} already processed. Use force=true to reprocess.`,
          existingState
        });
      }
    }
    
    logger.info('Manual daily benefits processing triggered', {
      date,
      force,
      triggeredBy: req.user.email,
      userId: req.user.id
    });
    
    // Trigger processing
    const result = await dailyBenefitsV2.triggerManualProcessingForDate(date, force);
    
    res.json({
      success: true,
      message: `Daily benefits processing triggered for ${date}`,
      data: result
    });
    
  } catch (error) {
    logger.error('Error triggering daily benefits processing:', {
      error: error.message,
      stack: error.stack,
      userId: req.user?.id,
      requestBody: req.body
    });
    
    res.status(500).json({
      success: false,
      message: 'Error triggering daily benefits processing',
      error: error.message
    });
  }
});

/**
 * Get detailed processing information for a specific date
 * GET /api/admin/daily-benefits/date/:date
 */
router.get('/date/:date', authenticateToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const { date } = req.params;
    
    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date format. Use YYYY-MM-DD'
      });
    }
    
    // Get processing state
    const processingState = await DailyProcessingState.getProcessingState(date);
    
    if (!processingState) {
      return res.status(404).json({
        success: false,
        message: `No processing state found for date ${date}`
      });
    }
    
    res.json({
      success: true,
      data: processingState
    });
    
  } catch (error) {
    logger.error('Error getting daily benefits date info:', {
      error: error.message,
      stack: error.stack,
      userId: req.user?.id,
      date: req.params.date
    });
    
    res.status(500).json({
      success: false,
      message: 'Error retrieving daily benefits date information',
      error: error.message
    });
  }
});

/**
 * Clean up old processing states
 * DELETE /api/admin/daily-benefits/cleanup
 */
router.delete('/cleanup', authenticateToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const result = await DailyProcessingState.cleanupOldStates();
    
    logger.info('Daily processing states cleanup completed', {
      deletedCount: result.deletedCount,
      triggeredBy: req.user.email,
      userId: req.user.id
    });
    
    res.json({
      success: true,
      message: 'Cleanup completed successfully',
      data: {
        deletedCount: result.deletedCount
      }
    });
    
  } catch (error) {
    logger.error('Error cleaning up daily processing states:', {
      error: error.message,
      stack: error.stack,
      userId: req.user?.id
    });
    
    res.status(500).json({
      success: false,
      message: 'Error cleaning up processing states',
      error: error.message
    });
  }
});

/**
 * Get cron job control (start/stop)
 * POST /api/admin/daily-benefits/control
 */
router.post('/control', authenticateToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const { action } = req.body;
    
    if (!['start', 'stop', 'restart'].includes(action)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid action. Use: start, stop, or restart'
      });
    }
    
    logger.info('Daily benefits cron control action', {
      action,
      triggeredBy: req.user.email,
      userId: req.user.id
    });
    
    let result;
    
    switch (action) {
      case 'start':
        result = dailyBenefitsV2.startCronJob();
        break;
      case 'stop':
        result = dailyBenefitsV2.stopCronJob();
        break;
      case 'restart':
        dailyBenefitsV2.stopCronJob();
        result = dailyBenefitsV2.startCronJob();
        break;
    }
    
    const status = dailyBenefitsV2.getCronStatus();
    
    res.json({
      success: true,
      message: `Cron job ${action} completed`,
      data: {
        action,
        status
      }
    });
    
  } catch (error) {
    logger.error('Error controlling daily benefits cron:', {
      error: error.message,
      stack: error.stack,
      userId: req.user?.id,
      action: req.body.action
    });
    
    res.status(500).json({
      success: false,
      message: 'Error controlling cron job',
      error: error.message
    });
  }
});

module.exports = router;