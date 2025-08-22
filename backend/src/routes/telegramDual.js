/**
 * Telegram Dual Service Admin Routes
 * Provides endpoints for managing and monitoring dual Telegram bots
 */

const express = require('express');
const { z } = require('zod');
const router = express.Router();
const telegramDualService = require('../services/telegramDualService');
const { authenticateToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/roleAuth');
const { rateLimiter } = require('../middleware/rateLimiter');
const { telegramRateLimit } = require('../middleware/telegramDualMiddleware');
const logger = require('../config/logger');

// Input validation schemas
const sendOtpSchema = z.object({
  chatId: z.string().min(1, 'Chat ID is required'),
  pin: z.string().regex(/^\d{6}$/, 'PIN must be exactly 6 digits'),
  purpose: z.enum(['withdrawal', 'security', 'account', 'login', 'settings']).default('withdrawal')
});

const sendNotificationSchema = z.object({
  chatId: z.string().min(1, 'Chat ID is required'),
  message: z.string().min(1, 'Message is required').max(4096, 'Message too long'),
  silent: z.boolean().default(false),
  parseMode: z.enum(['HTML', 'Markdown']).default('HTML')
});

const sendAdminAlertSchema = z.object({
  message: z.string().min(1, 'Message is required').max(4096, 'Message too long'),
  priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium')
});

const broadcastSchema = z.object({
  message: z.string().min(1, 'Message is required').max(4096, 'Message too long'),
  userIds: z.array(z.string()).optional(),
  silent: z.boolean().default(false)
});

/**
 * @route GET /api/admin/telegram-dual/status
 * @desc Get Telegram dual service status
 * @access Admin
 */
router.get('/status',
  authenticateToken,
  requireRole(['admin']),
  rateLimiter({ windowMs: 60000, max: 30 }),
  async (req, res) => {
    try {
      const status = telegramDualService.getStatus();
      
      res.json({
        success: true,
        data: status
      });
      
    } catch (error) {
      logger.error('Failed to get Telegram dual service status:', {
        error: error.message,
        adminId: req.user.id
      });
      
      res.status(500).json({
        success: false,
        error: 'Failed to get service status'
      });
    }
  }
);

/**
 * @route GET /api/admin/telegram-dual/stats
 * @desc Get Telegram dual service statistics
 * @access Admin
 */
router.get('/stats',
  authenticateToken,
  requireRole(['admin']),
  rateLimiter({ windowMs: 60000, max: 20 }),
  async (req, res) => {
    try {
      const stats = telegramDualService.getStats();
      
      res.json({
        success: true,
        data: stats
      });
      
    } catch (error) {
      logger.error('Failed to get Telegram dual service stats:', {
        error: error.message,
        adminId: req.user.id
      });
      
      res.status(500).json({
        success: false,
        error: 'Failed to get service statistics'
      });
    }
  }
);

/**
 * @route POST /api/admin/telegram-dual/send-otp
 * @desc Send OTP via dedicated OTP bot
 * @access Admin
 */
router.post('/send-otp',
  authenticateToken,
  requireRole(['admin']),
  rateLimiter({ windowMs: 300000, max: 10 }), // 10 OTPs per 5 minutes
  telegramRateLimit('otp', 5, 300000),
  async (req, res) => {
    try {
      const validatedData = sendOtpSchema.parse(req.body);
      const { chatId, pin, purpose } = validatedData;
      
      const success = await telegramDualService.sendOtpPin(chatId, pin, purpose);
      
      if (success) {
        logger.info('OTP sent successfully via admin endpoint', {
          chatId,
          purpose,
          adminId: req.user.id
        });
        
        res.json({
          success: true,
          message: 'OTP sent successfully'
        });
      } else {
        res.status(400).json({
          success: false,
          error: 'Failed to send OTP'
        });
      }
      
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: 'Validation error',
          details: error.errors
        });
      }
      
      logger.error('Failed to send OTP via admin endpoint:', {
        error: error.message,
        adminId: req.user.id
      });
      
      res.status(500).json({
        success: false,
        error: 'Failed to send OTP'
      });
    }
  }
);

/**
 * @route POST /api/admin/telegram-dual/send-notification
 * @desc Send notification via Alert bot
 * @access Admin
 */
router.post('/send-notification',
  authenticateToken,
  requireRole(['admin']),
  rateLimiter({ windowMs: 60000, max: 20 }),
  telegramRateLimit('notification', 15, 60000),
  async (req, res) => {
    try {
      const validatedData = sendNotificationSchema.parse(req.body);
      const { chatId, message, silent, parseMode } = validatedData;
      
      const options = {
        parse_mode: parseMode,
        disable_notification: silent
      };
      
      const success = await telegramDualService.sendNotification(chatId, message, options);
      
      if (success) {
        logger.info('Notification sent successfully via admin endpoint', {
          chatId,
          adminId: req.user.id
        });
        
        res.json({
          success: true,
          message: 'Notification sent successfully'
        });
      } else {
        res.status(400).json({
          success: false,
          error: 'Failed to send notification'
        });
      }
      
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: 'Validation error',
          details: error.errors
        });
      }
      
      logger.error('Failed to send notification via admin endpoint:', {
        error: error.message,
        adminId: req.user.id
      });
      
      res.status(500).json({
        success: false,
        error: 'Failed to send notification'
      });
    }
  }
);

/**
 * @route POST /api/admin/telegram-dual/send-admin-alert
 * @desc Send alert to admin chat
 * @access Admin
 */
router.post('/send-admin-alert',
  authenticateToken,
  requireRole(['admin']),
  rateLimiter({ windowMs: 300000, max: 5 }), // 5 admin alerts per 5 minutes
  async (req, res) => {
    try {
      const validatedData = sendAdminAlertSchema.parse(req.body);
      const { message, priority } = validatedData;
      
      const priorityIcons = {
        low: '🔵',
        medium: '🟡',
        high: '🟠',
        critical: '🔴'
      };
      
      const formattedMessage = `${priorityIcons[priority]} **PRIORIDAD ${priority.toUpperCase()}**\n\n${message}\n\n_Enviado por: ${req.user.email}_`;
      
      const success = await telegramDualService.sendAdminAlert(formattedMessage);
      
      if (success) {
        logger.info('Admin alert sent successfully', {
          priority,
          adminId: req.user.id
        });
        
        res.json({
          success: true,
          message: 'Admin alert sent successfully'
        });
      } else {
        res.status(400).json({
          success: false,
          error: 'Failed to send admin alert'
        });
      }
      
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: 'Validation error',
          details: error.errors
        });
      }
      
      logger.error('Failed to send admin alert:', {
        error: error.message,
        adminId: req.user.id
      });
      
      res.status(500).json({
        success: false,
        error: 'Failed to send admin alert'
      });
    }
  }
);

/**
 * @route POST /api/admin/telegram-dual/broadcast
 * @desc Broadcast message to multiple users
 * @access Admin
 */
router.post('/broadcast',
  authenticateToken,
  requireRole(['admin']),
  rateLimiter({ windowMs: 600000, max: 3 }), // 3 broadcasts per 10 minutes
  async (req, res) => {
    try {
      const validatedData = broadcastSchema.parse(req.body);
      const { message, userIds, silent } = validatedData;
      
      if (!userIds || userIds.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'User IDs array is required and cannot be empty'
        });
      }
      
      if (userIds.length > 100) {
        return res.status(400).json({
          success: false,
          error: 'Cannot broadcast to more than 100 users at once'
        });
      }
      
      const results = {
        total: userIds.length,
        successful: 0,
        failed: 0,
        errors: []
      };
      
      const options = {
        disable_notification: silent
      };
      
      // Process broadcasts with delay to avoid rate limits
      for (const userId of userIds) {
        try {
          const success = await telegramDualService.sendNotification(userId, message, options);
          if (success) {
            results.successful++;
          } else {
            results.failed++;
            results.errors.push({ userId, error: 'Send failed' });
          }
          
          // Add delay between messages
          await new Promise(resolve => setTimeout(resolve, 1000));
          
        } catch (error) {
          results.failed++;
          results.errors.push({ userId, error: error.message });
        }
      }
      
      logger.info('Broadcast completed', {
        ...results,
        adminId: req.user.id
      });
      
      res.json({
        success: true,
        message: 'Broadcast completed',
        data: results
      });
      
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: 'Validation error',
          details: error.errors
        });
      }
      
      logger.error('Failed to process broadcast:', {
        error: error.message,
        adminId: req.user.id
      });
      
      res.status(500).json({
        success: false,
        error: 'Failed to process broadcast'
      });
    }
  }
);

/**
 * @route GET /api/admin/telegram-dual/health
 * @desc Health check for Telegram dual service
 * @access Admin
 */
router.get('/health',
  authenticateToken,
  requireRole(['admin']),
  rateLimiter({ windowMs: 60000, max: 60 }),
  async (req, res) => {
    try {
      const status = telegramDualService.getStatus();
      
      const health = {
        healthy: status.otpBot.initialized || status.alertBot.initialized,
        services: {
          otpBot: {
            status: status.otpBot.initialized ? 'healthy' : 'unhealthy',
            configured: status.otpBot.configured
          },
          alertBot: {
            status: status.alertBot.initialized ? 'healthy' : 'unhealthy',
            configured: status.alertBot.configured
          },
          admin: {
            status: status.admin.chatConfigured ? 'configured' : 'not_configured'
          }
        },
        queue: status.queue,
        enabled: status.enabled,
        timestamp: status.timestamp
      };
      
      const httpStatus = health.healthy ? 200 : 503;
      
      res.status(httpStatus).json({
        success: health.healthy,
        data: health
      });
      
    } catch (error) {
      logger.error('Health check failed:', {
        error: error.message,
        adminId: req.user.id
      });
      
      res.status(503).json({
        success: false,
        error: 'Health check failed',
        data: {
          healthy: false,
          error: error.message,
          timestamp: new Date().toISOString()
        }
      });
    }
  }
);

/**
 * @route POST /api/admin/telegram-dual/test-connection
 * @desc Test connection to both Telegram bots
 * @access Admin
 */
router.post('/test-connection',
  authenticateToken,
  requireRole(['admin']),
  rateLimiter({ windowMs: 300000, max: 5 }), // 5 tests per 5 minutes
  async (req, res) => {
    try {
      const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
      
      if (!adminChatId) {
        return res.status(400).json({
          success: false,
          error: 'Admin chat ID not configured'
        });
      }
      
      const testResults = {
        otpBot: false,
        alertBot: false,
        timestamp: new Date().toISOString()
      };
      
      // Test OTP bot
      try {
        testResults.otpBot = await telegramDualService.sendOtpPin(
          adminChatId,
          '123456',
          'security',
          { disable_notification: true }
        );
      } catch (error) {
        logger.error('OTP bot test failed:', { error: error.message });
      }
      
      // Test Alert bot
      try {
        testResults.alertBot = await telegramDualService.sendNotification(
          adminChatId,
          '🧪 **Test de Conexión**\n\nEste es un mensaje de prueba del bot de alertas.\n\n_Enviado desde el panel de administración_',
          { parse_mode: 'Markdown', disable_notification: true }
        );
      } catch (error) {
        logger.error('Alert bot test failed:', { error: error.message });
      }
      
      const allTestsPassed = testResults.otpBot && testResults.alertBot;
      
      logger.info('Connection test completed', {
        ...testResults,
        adminId: req.user.id
      });
      
      res.json({
        success: allTestsPassed,
        message: allTestsPassed ? 'All tests passed' : 'Some tests failed',
        data: testResults
      });
      
    } catch (error) {
      logger.error('Connection test failed:', {
        error: error.message,
        adminId: req.user.id
      });
      
      res.status(500).json({
        success: false,
        error: 'Connection test failed'
      });
    }
  }
);

module.exports = router;