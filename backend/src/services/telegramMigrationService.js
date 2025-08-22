/**
 * Telegram Migration Service
 * Facilitates migration from single bot to dual bot architecture
 */

const telegramService = require('./telegram');
const telegramDualService = require('./telegramDualService');
const logger = require('../config/logger');

class TelegramMigrationService {
  constructor() {
    this.migrationEnabled = process.env.TELEGRAM_MIGRATION_ENABLED === 'true';
    this.fallbackToLegacy = process.env.TELEGRAM_FALLBACK_LEGACY === 'true';
    this.dualServicePriority = process.env.TELEGRAM_DUAL_PRIORITY === 'true';
  }

  /**
   * Send OTP with fallback mechanism
   * @param {string} chatId - Telegram chat ID
   * @param {string} pin - 6-digit PIN code
   * @param {string} purpose - Purpose of the PIN
   * @param {Object} options - Additional options
   * @returns {Promise<boolean>} Success status
   */
  async sendOtpPin(chatId, pin, purpose = 'withdrawal', options = {}) {
    try {
      // Try dual service first if enabled and prioritized
      if (this.dualServicePriority) {
        try {
          const dualResult = await telegramDualService.sendOtpPin(chatId, pin, purpose, options);
          if (dualResult) {
            logger.info('OTP sent successfully via dual service', {
              chatId,
              purpose,
              service: 'dual'
            });
            return true;
          }
        } catch (error) {
          logger.warn('Dual service OTP failed, trying fallback', {
            error: error.message,
            chatId,
            purpose
          });
        }
      }

      // Fallback to legacy service if enabled
      if (this.fallbackToLegacy) {
        try {
          const legacyResult = await telegramService.sendOtpPin(chatId, pin, purpose);
          if (legacyResult) {
            logger.info('OTP sent successfully via legacy service', {
              chatId,
              purpose,
              service: 'legacy'
            });
            return true;
          }
        } catch (error) {
          logger.error('Legacy service OTP also failed', {
            error: error.message,
            chatId,
            purpose
          });
        }
      }

      // If dual service is not prioritized, try it as fallback
      if (!this.dualServicePriority) {
        try {
          const dualResult = await telegramDualService.sendOtpPin(chatId, pin, purpose, options);
          if (dualResult) {
            logger.info('OTP sent successfully via dual service (fallback)', {
              chatId,
              purpose,
              service: 'dual-fallback'
            });
            return true;
          }
        } catch (error) {
          logger.error('Dual service fallback also failed', {
            error: error.message,
            chatId,
            purpose
          });
        }
      }

      logger.error('All OTP sending methods failed', {
        chatId,
        purpose,
        dualServicePriority: this.dualServicePriority,
        fallbackToLegacy: this.fallbackToLegacy
      });

      return false;

    } catch (error) {
      logger.error('Migration service OTP error:', {
        error: error.message,
        chatId,
        purpose,
        stack: error.stack
      });
      return false;
    }
  }

  /**
   * Send notification with fallback mechanism
   * @param {string} chatId - Telegram chat ID
   * @param {string} message - Message to send
   * @param {Object} options - Additional options
   * @returns {Promise<boolean>} Success status
   */
  async sendNotification(chatId, message, options = {}) {
    try {
      // Try dual service first if enabled and prioritized
      if (this.dualServicePriority) {
        try {
          const dualResult = await telegramDualService.sendNotification(chatId, message, options);
          if (dualResult) {
            logger.info('Notification sent successfully via dual service', {
              chatId,
              service: 'dual'
            });
            return true;
          }
        } catch (error) {
          logger.warn('Dual service notification failed, trying fallback', {
            error: error.message,
            chatId
          });
        }
      }

      // Fallback to legacy service if enabled
      if (this.fallbackToLegacy) {
        try {
          const legacyResult = await telegramService.sendNotification(chatId, message, options);
          if (legacyResult) {
            logger.info('Notification sent successfully via legacy service', {
              chatId,
              service: 'legacy'
            });
            return true;
          }
        } catch (error) {
          logger.error('Legacy service notification also failed', {
            error: error.message,
            chatId
          });
        }
      }

      // If dual service is not prioritized, try it as fallback
      if (!this.dualServicePriority) {
        try {
          const dualResult = await telegramDualService.sendNotification(chatId, message, options);
          if (dualResult) {
            logger.info('Notification sent successfully via dual service (fallback)', {
              chatId,
              service: 'dual-fallback'
            });
            return true;
          }
        } catch (error) {
          logger.error('Dual service fallback also failed', {
            error: error.message,
            chatId
          });
        }
      }

      logger.error('All notification sending methods failed', {
        chatId,
        dualServicePriority: this.dualServicePriority,
        fallbackToLegacy: this.fallbackToLegacy
      });

      return false;

    } catch (error) {
      logger.error('Migration service notification error:', {
        error: error.message,
        chatId,
        stack: error.stack
      });
      return false;
    }
  }

  /**
   * Send admin notification with fallback mechanism
   * @param {string} message - Message to send to admin
   * @param {Object} options - Additional options
   * @returns {Promise<boolean>} Success status
   */
  async sendAdminNotification(message, options = {}) {
    try {
      // Try dual service first if enabled and prioritized
      if (this.dualServicePriority) {
        try {
          const dualResult = await telegramDualService.sendAdminAlert(message, options);
          if (dualResult) {
            logger.info('Admin notification sent successfully via dual service', {
              service: 'dual'
            });
            return true;
          }
        } catch (error) {
          logger.warn('Dual service admin notification failed, trying fallback', {
            error: error.message
          });
        }
      }

      // Fallback to legacy service if enabled
      if (this.fallbackToLegacy) {
        try {
          const legacyResult = await telegramService.sendAdminNotification(message, options);
          if (legacyResult) {
            logger.info('Admin notification sent successfully via legacy service', {
              service: 'legacy'
            });
            return true;
          }
        } catch (error) {
          logger.error('Legacy service admin notification also failed', {
            error: error.message
          });
        }
      }

      // If dual service is not prioritized, try it as fallback
      if (!this.dualServicePriority) {
        try {
          const dualResult = await telegramDualService.sendAdminAlert(message, options);
          if (dualResult) {
            logger.info('Admin notification sent successfully via dual service (fallback)', {
              service: 'dual-fallback'
            });
            return true;
          }
        } catch (error) {
          logger.error('Dual service admin fallback also failed', {
            error: error.message
          });
        }
      }

      logger.error('All admin notification methods failed', {
        dualServicePriority: this.dualServicePriority,
        fallbackToLegacy: this.fallbackToLegacy
      });

      return false;

    } catch (error) {
      logger.error('Migration service admin notification error:', {
        error: error.message,
        stack: error.stack
      });
      return false;
    }
  }

  /**
   * Send withdrawal notification with fallback mechanism
   * @param {string} chatId - Telegram chat ID
   * @param {Object} withdrawal - Withdrawal object
   * @param {string} status - New status
   * @returns {Promise<boolean>} Success status
   */
  async sendWithdrawalNotification(chatId, withdrawal, status) {
    try {
      // Try dual service first if enabled and prioritized
      if (this.dualServicePriority) {
        try {
          const dualResult = await telegramDualService.sendWithdrawalNotification(chatId, withdrawal, status);
          if (dualResult) {
            logger.info('Withdrawal notification sent successfully via dual service', {
              chatId,
              status,
              service: 'dual'
            });
            return true;
          }
        } catch (error) {
          logger.warn('Dual service withdrawal notification failed, trying fallback', {
            error: error.message,
            chatId,
            status
          });
        }
      }

      // Fallback to legacy service if enabled
      if (this.fallbackToLegacy) {
        try {
          const legacyResult = await telegramService.sendWithdrawalNotification(chatId, withdrawal, status);
          if (legacyResult) {
            logger.info('Withdrawal notification sent successfully via legacy service', {
              chatId,
              status,
              service: 'legacy'
            });
            return true;
          }
        } catch (error) {
          logger.error('Legacy service withdrawal notification also failed', {
            error: error.message,
            chatId,
            status
          });
        }
      }

      // If dual service is not prioritized, try it as fallback
      if (!this.dualServicePriority) {
        try {
          const dualResult = await telegramDualService.sendWithdrawalNotification(chatId, withdrawal, status);
          if (dualResult) {
            logger.info('Withdrawal notification sent successfully via dual service (fallback)', {
              chatId,
              status,
              service: 'dual-fallback'
            });
            return true;
          }
        } catch (error) {
          logger.error('Dual service withdrawal fallback also failed', {
            error: error.message,
            chatId,
            status
          });
        }
      }

      logger.error('All withdrawal notification methods failed', {
        chatId,
        status,
        dualServicePriority: this.dualServicePriority,
        fallbackToLegacy: this.fallbackToLegacy
      });

      return false;

    } catch (error) {
      logger.error('Migration service withdrawal notification error:', {
        error: error.message,
        chatId,
        status,
        stack: error.stack
      });
      return false;
    }
  }

  /**
   * Get combined status from both services
   * @returns {Object} Combined status
   */
  getStatus() {
    try {
      const legacyStatus = telegramService.getStatus();
      const dualStatus = telegramDualService.getStatus();

      return {
        migration: {
          enabled: this.migrationEnabled,
          dualServicePriority: this.dualServicePriority,
          fallbackToLegacy: this.fallbackToLegacy
        },
        legacy: legacyStatus,
        dual: dualStatus,
        overall: {
          healthy: legacyStatus.initialized || (dualStatus.otpBot.initialized || dualStatus.alertBot.initialized),
          preferredService: this.dualServicePriority ? 'dual' : 'legacy'
        },
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      logger.error('Failed to get migration service status:', {
        error: error.message
      });

      return {
        migration: {
          enabled: this.migrationEnabled,
          dualServicePriority: this.dualServicePriority,
          fallbackToLegacy: this.fallbackToLegacy
        },
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Test both services
   * @returns {Promise<Object>} Test results
   */
  async testServices() {
    const results = {
      legacy: { available: false, error: null },
      dual: { available: false, error: null },
      timestamp: new Date().toISOString()
    };

    // Test legacy service
    try {
      const legacyStatus = telegramService.getStatus();
      results.legacy.available = legacyStatus.initialized;
    } catch (error) {
      results.legacy.error = error.message;
    }

    // Test dual service
    try {
      const dualStatus = telegramDualService.getStatus();
      results.dual.available = dualStatus.otpBot.initialized || dualStatus.alertBot.initialized;
    } catch (error) {
      results.dual.error = error.message;
    }

    return results;
  }

  /**
   * Update migration configuration
   * @param {Object} config - New configuration
   */
  updateConfig(config) {
    if (typeof config.dualServicePriority === 'boolean') {
      this.dualServicePriority = config.dualServicePriority;
    }
    if (typeof config.fallbackToLegacy === 'boolean') {
      this.fallbackToLegacy = config.fallbackToLegacy;
    }
    if (typeof config.migrationEnabled === 'boolean') {
      this.migrationEnabled = config.migrationEnabled;
    }

    logger.info('Migration service configuration updated', {
      dualServicePriority: this.dualServicePriority,
      fallbackToLegacy: this.fallbackToLegacy,
      migrationEnabled: this.migrationEnabled
    });
  }
}

// Create singleton instance
const telegramMigrationService = new TelegramMigrationService();

module.exports = telegramMigrationService;