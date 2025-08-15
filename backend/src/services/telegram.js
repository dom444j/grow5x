/**
 * Telegram Service
 * Handles Telegram bot operations for OTP PIN delivery
 */

const { Telegraf } = require('telegraf');
const logger = require('../config/logger');

class TelegramService {
  constructor() {
    this.bot = null;
    this.isInitialized = false;
    this.initialize();
  }

  /**
   * Initialize Telegram bot
   */
  initialize() {
    try {
      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      
      if (!botToken) {
        logger.warn('Telegram bot token not configured. OTP PIN delivery will be disabled.');
        return;
      }

      this.bot = new Telegraf(botToken);
      this.isInitialized = true;
      
      logger.info('Telegram service initialized successfully');
      
    } catch (error) {
      logger.error('Failed to initialize Telegram service:', {
        error: error.message,
        stack: error.stack
      });
    }
  }

  /**
   * Send OTP PIN to user via Telegram
   * @param {string} chatId - Telegram chat ID
   * @param {string} pin - 6-digit PIN code
   * @param {string} purpose - Purpose of the PIN (withdrawal, etc.)
   * @returns {Promise<boolean>} Success status
   */
  async sendOtpPin(chatId, pin, purpose = 'withdrawal') {
    try {
      if (!this.isInitialized || !this.bot) {
        logger.error('Telegram service not initialized');
        return false;
      }

      if (!chatId || !pin) {
        logger.error('Invalid parameters for OTP PIN sending', {
          chatId: !!chatId,
          pin: !!pin
        });
        return false;
      }

      const message = this.formatOtpMessage(pin, purpose);
      
      await this.bot.telegram.sendMessage(chatId, message, {
        parse_mode: 'HTML',
        disable_web_page_preview: true
      });

      logger.info('OTP PIN sent successfully', {
        chatId,
        purpose,
        timestamp: new Date().toISOString()
      });

      return true;
      
    } catch (error) {
      logger.error('Failed to send OTP PIN via Telegram:', {
        error: error.message,
        chatId,
        purpose,
        stack: error.stack
      });
      
      return false;
    }
  }

  /**
   * Format OTP PIN message
   * @param {string} pin - 6-digit PIN
   * @param {string} purpose - Purpose of the PIN
   * @returns {string} Formatted message
   */
  formatOtpMessage(pin, purpose) {
    const purposeText = {
      withdrawal: 'retiro de fondos',
      security: 'verificación de seguridad',
      account: 'verificación de cuenta'
    }[purpose] || 'operación';

    return `🔐 <b>Código de Verificación - Grow5X</b>\n\n` +
           `Su código PIN para ${purposeText}:\n\n` +
           `<code>${pin}</code>\n\n` +
           `⏰ <i>Este código expira en 10 minutos</i>\n` +
           `🔒 <i>No comparta este código con nadie</i>\n\n` +
           `Si no solicitó esta operación, ignore este mensaje.`;
  }

  /**
   * Send notification message
   * @param {string} chatId - Telegram chat ID
   * @param {string} message - Message to send
   * @param {Object} options - Additional options
   * @returns {Promise<boolean>} Success status
   */
  async sendNotification(chatId, message, options = {}) {
    try {
      if (!this.isInitialized || !this.bot) {
        logger.error('Telegram service not initialized');
        return false;
      }

      await this.bot.telegram.sendMessage(chatId, message, {
        parse_mode: 'HTML',
        disable_web_page_preview: true,
        ...options
      });

      logger.info('Notification sent successfully', {
        chatId,
        timestamp: new Date().toISOString()
      });

      return true;
      
    } catch (error) {
      logger.error('Failed to send notification via Telegram:', {
        error: error.message,
        chatId,
        stack: error.stack
      });
      
      return false;
    }
  }

  /**
   * Send withdrawal status notification
   * @param {string} chatId - Telegram chat ID
   * @param {Object} withdrawal - Withdrawal object
   * @param {string} status - New status
   * @returns {Promise<boolean>} Success status
   */
  async sendWithdrawalNotification(chatId, withdrawal, status) {
    try {
      const statusMessages = {
        approved: {
          title: '✅ Retiro Aprobado',
          message: `Su solicitud de retiro ha sido aprobada y está siendo procesada.\n\n` +
                  `💰 Monto: ${withdrawal.amount} ${withdrawal.currency}\n` +
                  `🏦 Red: ${withdrawal.network}\n` +
                  `📅 Fecha: ${new Date(withdrawal.createdAt).toLocaleDateString('es-ES')}`
        },
        completed: {
          title: '🎉 Retiro Completado',
          message: `Su retiro ha sido procesado exitosamente.\n\n` +
                  `💰 Monto: ${withdrawal.amount} ${withdrawal.currency}\n` +
                  `🏦 Red: ${withdrawal.network}\n` +
                  `🔗 Hash: <code>${withdrawal.txHash || 'Pendiente'}</code>\n` +
                  `📅 Completado: ${new Date().toLocaleDateString('es-ES')}`
        },
        rejected: {
          title: '❌ Retiro Rechazado',
          message: `Su solicitud de retiro ha sido rechazada.\n\n` +
                  `💰 Monto: ${withdrawal.amount} ${withdrawal.currency}\n` +
                  `📝 Motivo: ${withdrawal.adminNotes || 'No especificado'}\n` +
                  `📅 Fecha: ${new Date(withdrawal.createdAt).toLocaleDateString('es-ES')}\n\n` +
                  `Los fondos han sido devueltos a su balance disponible.`
        }
      };

      const notification = statusMessages[status];
      if (!notification) {
        logger.error('Invalid withdrawal status for notification', { status });
        return false;
      }

      const fullMessage = `🔔 <b>${notification.title}</b>\n\n${notification.message}`;
      
      return await this.sendNotification(chatId, fullMessage);
      
    } catch (error) {
      logger.error('Failed to send withdrawal notification:', {
        error: error.message,
        chatId,
        withdrawalId: withdrawal._id,
        status
      });
      
      return false;
    }
  }

  /**
   * Validate chat ID format
   * @param {string} chatId - Chat ID to validate
   * @returns {boolean} Is valid
   */
  isValidChatId(chatId) {
    if (!chatId) return false;
    
    // Telegram chat IDs are typically numeric strings
    // Can be positive (user) or negative (group/channel)
    return /^-?\d+$/.test(chatId.toString());
  }

  /**
   * Set webhook URL for the bot
   * @param {string} webhookUrl - Webhook URL
   * @param {Object} options - Additional webhook options
   * @returns {Promise<boolean>} Success status
   */
  async setWebhook(webhookUrl, options = {}) {
    try {
      if (!this.isInitialized || !this.bot) {
        logger.error('Telegram service not initialized');
        return false;
      }

      const webhookOptions = {
        url: webhookUrl,
        allowed_updates: ['message', 'callback_query'],
        drop_pending_updates: true,
        ...options
      };

      // Add secret token if configured
      if (process.env.TELEGRAM_SECRET_TOKEN) {
        webhookOptions.secret_token = process.env.TELEGRAM_SECRET_TOKEN;
      }

      await this.bot.telegram.setWebhook(webhookOptions);
      
      logger.info('Webhook set successfully', {
        url: webhookUrl,
        secretConfigured: !!process.env.TELEGRAM_SECRET_TOKEN
      });

      return true;
      
    } catch (error) {
      logger.error('Failed to set webhook:', {
        error: error.message,
        webhookUrl,
        stack: error.stack
      });
      
      return false;
    }
  }

  /**
   * Get webhook info
   * @returns {Promise<Object|null>} Webhook info
   */
  async getWebhookInfo() {
    try {
      if (!this.isInitialized || !this.bot) {
        logger.error('Telegram service not initialized');
        return null;
      }

      const webhookInfo = await this.bot.telegram.getWebhookInfo();
      
      logger.info('Webhook info retrieved', {
        url: webhookInfo.url,
        hasCustomCertificate: webhookInfo.has_custom_certificate,
        pendingUpdateCount: webhookInfo.pending_update_count
      });

      return webhookInfo;
      
    } catch (error) {
      logger.error('Failed to get webhook info:', {
        error: error.message,
        stack: error.stack
      });
      
      return null;
    }
  }

  /**
   * Delete webhook
   * @returns {Promise<boolean>} Success status
   */
  async deleteWebhook() {
    try {
      if (!this.isInitialized || !this.bot) {
        logger.error('Telegram service not initialized');
        return false;
      }

      await this.bot.telegram.deleteWebhook({ drop_pending_updates: true });
      
      logger.info('Webhook deleted successfully');
      return true;
      
    } catch (error) {
      logger.error('Failed to delete webhook:', {
        error: error.message,
        stack: error.stack
      });
      
      return false;
    }
  }

  /**
   * Send admin notification
   * @param {string} message - Message to send to admin
   * @param {Object} options - Additional options
   * @returns {Promise<boolean>} Success status
   */
  async sendAdminNotification(message, options = {}) {
    try {
      const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
      
      if (!adminChatId) {
        logger.warn('Admin chat ID not configured');
        return false;
      }

      return await this.sendNotification(adminChatId, message, options);
      
    } catch (error) {
      logger.error('Failed to send admin notification:', {
        error: error.message,
        stack: error.stack
      });
      
      return false;
    }
  }

  /**
   * Get service status
   * @returns {Object} Service status
   */
  getStatus() {
    return {
      initialized: this.isInitialized,
      botConfigured: !!this.bot,
      webhookConfigured: !!process.env.TELEGRAM_WEBHOOK_URL,
      adminChatConfigured: !!process.env.TELEGRAM_ADMIN_CHAT_ID,
      secretTokenConfigured: !!process.env.TELEGRAM_SECRET_TOKEN,
      enabled: process.env.TELEGRAM_ENABLED === 'true',
      timestamp: new Date().toISOString()
    };
  }
}

// Create singleton instance
const telegramService = new TelegramService();

module.exports = telegramService;