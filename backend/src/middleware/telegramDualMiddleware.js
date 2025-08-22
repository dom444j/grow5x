/**
 * Telegram Dual Service Middleware
 * Integrates dual Telegram bots with existing services
 */

const logger = require('../config/logger');

// Lazy load telegramDualService to avoid initialization errors
let telegramDualService = null;
const getTelegramDualService = () => {
  if (!telegramDualService) {
    try {
      telegramDualService = require('../services/telegramDualService');
    } catch (error) {
      logger.error('Failed to load telegramDualService:', error);
      return null;
    }
  }
  return telegramDualService;
};

/**
 * Middleware to enhance requests with Telegram dual service capabilities
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Next middleware function
 */
const telegramDualMiddleware = (req, res, next) => {
  try {
    // Add Telegram dual service methods to request object
    req.telegramDual = {
      // Send OTP via dedicated OTP bot
      sendOTP: async (chatId, pin, purpose = 'withdrawal', options = {}) => {
        try {
          const service = getTelegramDualService();
          if (!service) return false;
          return await service.sendOtpPin(chatId, pin, purpose, options);
        } catch (error) {
          logger.error('Middleware OTP send error:', {
            error: error.message,
            chatId,
            purpose
          });
          return false;
        }
      },

      // Send notification via Alert bot
      sendNotification: async (chatId, message, options = {}) => {
        try {
          const service = getTelegramDualService();
          if (!service) return false;
          return await service.sendNotification(chatId, message, options);
        } catch (error) {
          logger.error('Middleware notification send error:', {
            error: error.message,
            chatId
          });
          return false;
        }
      },

      // Send admin alert
      sendAdminAlert: async (message, options = {}) => {
        try {
          const service = getTelegramDualService();
          if (!service) return false;
          return await service.sendAdminAlert(message, options);
        } catch (error) {
          logger.error('Middleware admin alert error:', {
            error: error.message
          });
          return false;
        }
      },

      // Send withdrawal notification
      sendWithdrawalNotification: async (chatId, withdrawal, status) => {
        try {
          const service = getTelegramDualService();
          if (!service) return false;
          return await service.sendWithdrawalNotification(chatId, withdrawal, status);
        } catch (error) {
          logger.error('Middleware withdrawal notification error:', {
            error: error.message,
            chatId,
            status
          });
          return false;
        }
      },

      // Send commission notification
      sendCommissionNotification: async (chatId, commission) => {
        try {
          const service = getTelegramDualService();
          if (!service) return false;
          return await service.sendCommissionNotification(chatId, commission);
        } catch (error) {
          logger.error('Middleware commission notification error:', {
            error: error.message,
            chatId
          });
          return false;
        }
      },

      // Queue message for later processing
      queueMessage: (type, chatId, content, options = {}) => {
        try {
          const service = getTelegramDualService();
          if (!service) return false;
          service.queueMessage(type, chatId, content, options);
          return true;
        } catch (error) {
          logger.error('Middleware queue message error:', {
            error: error.message,
            type,
            chatId
          });
          return false;
        }
      },

      // Get service status
      getStatus: () => {
        try {
          const service = getTelegramDualService();
          if (!service) return { error: 'Service not available' };
          return service.getStatus();
        } catch (error) {
          logger.error('Middleware get status error:', {
            error: error.message
          });
          return { error: 'Failed to get status' };
        }
      },

      // Get service statistics
      getStats: () => {
        try {
          const service = getTelegramDualService();
          if (!service) return { error: 'Service not available' };
          return service.getStats();
        } catch (error) {
          logger.error('Middleware get stats error:', {
            error: error.message
          });
          return { error: 'Failed to get stats' };
        }
      }
    };

    // Add backward compatibility with existing Telegram service
    req.telegram = {
      // Legacy method - routes to appropriate bot based on content
      sendMessage: async (chatId, message, options = {}) => {
        try {
          const service = getTelegramDualService();
          if (!service) return false;
          
          // If message contains PIN pattern, use OTP bot
          const pinPattern = /\b\d{6}\b/;
          if (pinPattern.test(message)) {
            const pinMatch = message.match(pinPattern);
            const pin = pinMatch ? pinMatch[0] : null;
            if (pin) {
              return await service.sendOtpPin(chatId, pin, 'general', options);
            }
          }
          
          // Otherwise use Alert bot
          return await service.sendNotification(chatId, message, options);
        } catch (error) {
          logger.error('Legacy telegram send message error:', {
            error: error.message,
            chatId
          });
          return false;
        }
      },

      // Legacy OTP method
      sendOtpPin: async (chatId, pin, purpose = 'withdrawal') => {
        try {
          const service = getTelegramDualService();
          if (!service) return false;
          return await service.sendOtpPin(chatId, pin, purpose);
        } catch (error) {
          logger.error('Legacy OTP send error:', {
            error: error.message,
            chatId,
            purpose
          });
          return false;
        }
      },

      // Legacy notification method
      sendNotification: async (chatId, message, options = {}) => {
        try {
          const service = getTelegramDualService();
          if (!service) return false;
          return await service.sendNotification(chatId, message, options);
        } catch (error) {
          logger.error('Legacy notification send error:', {
            error: error.message,
            chatId
          });
          return false;
        }
      },

      // Legacy admin notification
      sendAdminNotification: async (message, options = {}) => {
        try {
          const service = getTelegramDualService();
          if (!service) return false;
          return await service.sendAdminAlert(message, options);
        } catch (error) {
          logger.error('Legacy admin notification error:', {
            error: error.message
          });
          return false;
        }
      },

      // Legacy withdrawal notification
      sendWithdrawalNotification: async (chatId, withdrawal, status) => {
        try {
          const service = getTelegramDualService();
          if (!service) return false;
          return await service.sendWithdrawalNotification(chatId, withdrawal, status);
        } catch (error) {
          logger.error('Legacy withdrawal notification error:', {
            error: error.message,
            chatId,
            status
          });
          return false;
        }
      },

      // Legacy status method
      getStatus: () => {
        try {
          const service = getTelegramDualService();
          if (!service) return { error: 'Service unavailable' };
          
          const status = service.getStatus();
          // Convert to legacy format
          return {
            initialized: status.otpBot.initialized || status.alertBot.initialized,
            botConfigured: status.otpBot.configured || status.alertBot.configured,
            adminChatConfigured: status.admin.chatConfigured,
            enabled: status.enabled,
            webhookStatus: 'N/A - Using polling',
            environment: {
              botToken: status.alertBot.configured,
              adminChatId: status.admin.chatConfigured,
              enabled: status.enabled
            }
          };
        } catch (error) {
          logger.error('Legacy get status error:', {
            error: error.message
          });
          return { error: 'Failed to get status' };
        }
      }
    };

    next();
    
  } catch (error) {
    logger.error('Telegram dual middleware error:', {
      error: error.message,
      stack: error.stack
    });
    
    // Provide fallback methods that don't crash the application
    req.telegramDual = {
      sendOTP: async () => false,
      sendNotification: async () => false,
      sendAdminAlert: async () => false,
      sendWithdrawalNotification: async () => false,
      sendCommissionNotification: async () => false,
      queueMessage: () => false,
      getStatus: () => ({ error: 'Service unavailable' }),
      getStats: () => ({ error: 'Service unavailable' })
    };
    
    req.telegram = {
      sendMessage: async () => false,
      sendOtpPin: async () => false,
      sendNotification: async () => false,
      sendAdminNotification: async () => false,
      sendWithdrawalNotification: async () => false,
      getStatus: () => ({ error: 'Service unavailable' })
    };
    
    next();
  }
};

/**
 * Health check middleware for Telegram dual service
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Next middleware function
 */
const telegramHealthCheck = (req, res, next) => {
  try {
    const status = telegramDualService.getStatus();
    
    req.telegramHealth = {
      healthy: status.otpBot.initialized || status.alertBot.initialized,
      status,
      lastCheck: new Date().toISOString()
    };
    
    next();
    
  } catch (error) {
    logger.error('Telegram health check error:', {
      error: error.message
    });
    
    req.telegramHealth = {
      healthy: false,
      error: error.message,
      lastCheck: new Date().toISOString()
    };
    
    next();
  }
};

/**
 * Rate limiting middleware for Telegram operations
 * @param {string} type - Type of operation (otp, notification)
 * @param {number} limit - Maximum requests per window
 * @param {number} window - Time window in milliseconds
 * @returns {Function} Express middleware function
 */
const telegramRateLimit = (type = 'notification', limit = 10, window = 60000) => {
  const rateLimits = new Map();
  
  return (req, res, next) => {
    try {
      const identifier = req.user?.id || req.ip || 'anonymous';
      const key = `${identifier}:${type}`;
      const now = Date.now();
      
      if (!rateLimits.has(key)) {
        rateLimits.set(key, []);
      }
      
      const timestamps = rateLimits.get(key);
      const validTimestamps = timestamps.filter(timestamp => now - timestamp < window);
      
      if (validTimestamps.length >= limit) {
        return res.status(429).json({
          success: false,
          error: 'Rate limit exceeded for Telegram operations',
          retryAfter: Math.ceil(window / 1000)
        });
      }
      
      validTimestamps.push(now);
      rateLimits.set(key, validTimestamps);
      
      next();
      
    } catch (error) {
      logger.error('Telegram rate limit middleware error:', {
        error: error.message
      });
      next();
    }
  };
};

module.exports = {
  telegramDualMiddleware,
  telegramHealthCheck,
  telegramRateLimit
};