/**
 * Enhanced Telegram Service with Dual Bots
 * Separates OTP delivery from general notifications for better security and organization
 */

const { Telegraf } = require('telegraf');
const logger = require('../config/logger');
const EventEmitter = require('events');

class TelegramDualService extends EventEmitter {
  constructor() {
    super();
    this.otpBot = null;
    this.alertBot = null;
    this.isOtpBotInitialized = false;
    this.isAlertBotInitialized = false;
    this.messageQueue = [];
    this.rateLimits = new Map();
    this.initialize();
  }

  /**
   * Initialize both Telegram bots
   */
  async initialize() {
    try {
      await this.initializeOtpBot();
      await this.initializeAlertBot();
      this.startQueueProcessor();
      
      logger.info('Telegram dual service initialized successfully', {
        otpBot: this.isOtpBotInitialized,
        alertBot: this.isAlertBotInitialized
      });
      
    } catch (error) {
      logger.error('Failed to initialize Telegram dual service:', {
        error: error.message,
        stack: error.stack
      });
    }
  }

  /**
   * Initialize OTP bot (dedicated for security codes)
   */
  async initializeOtpBot() {
    try {
      const otpBotToken = process.env.TELEGRAM_OTP_BOT_TOKEN;
      
      if (!otpBotToken) {
        logger.warn('OTP bot token not configured. OTP delivery will be disabled.');
        return;
      }

      this.otpBot = new Telegraf(otpBotToken);
      
      // Set up OTP bot commands
      this.otpBot.start((ctx) => {
        ctx.reply(
          '🔐 *Bot de Seguridad Grow5X*\n\n' +
          'Este bot está dedicado exclusivamente al envío de códigos de verificación.\n\n' +
          '⚠️ *Importante:*\n' +
          '• Nunca comparta sus códigos con nadie\n' +
          '• Los códigos expiran en 10 minutos\n' +
          '• Si no solicitó un código, ignore el mensaje',
          { parse_mode: 'Markdown' }
        );
      });

      this.otpBot.help((ctx) => {
        ctx.reply(
          '🆘 *Ayuda - Bot de Seguridad*\n\n' +
          'Este bot envía códigos de verificación para:\n' +
          '• Retiros de fondos\n' +
          '• Cambios de configuración de seguridad\n' +
          '• Verificación de cuenta\n\n' +
          'Para soporte, contacte al administrador.',
          { parse_mode: 'Markdown' }
        );
      });

      // Error handling for OTP bot
      this.otpBot.catch((err, ctx) => {
        logger.error('OTP bot error:', {
          error: err.message,
          chatId: ctx?.chat?.id,
          updateType: ctx?.updateType
        });
      });

      this.isOtpBotInitialized = true;
      logger.info('OTP bot initialized successfully');
      
    } catch (error) {
      logger.error('Failed to initialize OTP bot:', {
        error: error.message,
        stack: error.stack
      });
    }
  }

  /**
   * Initialize Alert bot (for notifications and general messages)
   */
  async initializeAlertBot() {
    try {
      const alertBotToken = process.env.TELEGRAM_ALERT_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
      
      if (!alertBotToken) {
        logger.warn('Alert bot token not configured. Notifications will be disabled.');
        return;
      }

      this.alertBot = new Telegraf(alertBotToken);
      
      // Set up Alert bot commands
      this.alertBot.start((ctx) => {
        ctx.reply(
          '🔔 *Bot de Notificaciones Grow5X*\n\n' +
          'Bienvenido al sistema de notificaciones de Grow5X.\n\n' +
          'Recibirá actualizaciones sobre:\n' +
          '• Estado de retiros\n' +
          '• Comisiones desbloqueadas\n' +
          '• Actualizaciones del sistema\n' +
          '• Alertas importantes',
          { parse_mode: 'Markdown' }
        );
      });

      this.alertBot.help((ctx) => {
        ctx.reply(
          '🆘 *Ayuda - Bot de Notificaciones*\n\n' +
          'Comandos disponibles:\n' +
          '/start - Mensaje de bienvenida\n' +
          '/help - Esta ayuda\n' +
          '/status - Estado de su cuenta\n' +
          '/settings - Configurar notificaciones\n\n' +
          'Para soporte técnico, contacte al administrador.',
          { parse_mode: 'Markdown' }
        );
      });

      this.alertBot.command('status', (ctx) => {
        ctx.reply(
          '📊 *Estado del Sistema*\n\n' +
          '✅ Bot de notificaciones activo\n' +
          '🔔 Notificaciones habilitadas\n' +
          `📅 Fecha: ${new Date().toLocaleDateString('es-ES')}\n` +
          `⏰ Hora: ${new Date().toLocaleTimeString('es-ES')}`,
          { parse_mode: 'Markdown' }
        );
      });

      // Error handling for Alert bot
      this.alertBot.catch((err, ctx) => {
        logger.error('Alert bot error:', {
          error: err.message,
          chatId: ctx?.chat?.id,
          updateType: ctx?.updateType
        });
      });

      this.isAlertBotInitialized = true;
      logger.info('Alert bot initialized successfully');
      
    } catch (error) {
      logger.error('Failed to initialize Alert bot:', {
        error: error.message,
        stack: error.stack
      });
    }
  }

  /**
   * Send OTP PIN via dedicated OTP bot
   * @param {string} chatId - Telegram chat ID
   * @param {string} pin - 6-digit PIN code
   * @param {string} purpose - Purpose of the PIN
   * @param {Object} options - Additional options
   * @returns {Promise<boolean>} Success status
   */
  async sendOtpPin(chatId, pin, purpose = 'withdrawal', options = {}) {
    try {
      if (!this.isOtpBotInitialized || !this.otpBot) {
        logger.error('OTP bot not initialized');
        return false;
      }

      if (!this.isValidChatId(chatId) || !pin) {
        logger.error('Invalid parameters for OTP PIN sending', {
          chatId: !!chatId,
          pin: !!pin
        });
        return false;
      }

      // Check rate limiting for OTP
      if (!this.checkRateLimit(chatId, 'otp', 3, 300000)) { // 3 OTPs per 5 minutes
        logger.warn('OTP rate limit exceeded', { chatId });
        return false;
      }

      const message = this.formatOtpMessage(pin, purpose);
      
      await this.otpBot.telegram.sendMessage(chatId, message, {
        parse_mode: 'HTML',
        disable_web_page_preview: true,
        disable_notification: false,
        ...options
      });

      logger.info('OTP PIN sent successfully via OTP bot', {
        chatId,
        purpose,
        timestamp: new Date().toISOString()
      });

      // Emit event for monitoring
      this.emit('otpSent', { chatId, purpose, timestamp: new Date() });

      return true;
      
    } catch (error) {
      logger.error('Failed to send OTP PIN via OTP bot:', {
        error: error.message,
        chatId,
        purpose,
        stack: error.stack
      });
      
      this.emit('otpError', { chatId, purpose, error: error.message });
      return false;
    }
  }

  /**
   * Send notification via Alert bot
   * @param {string} chatId - Telegram chat ID
   * @param {string} message - Message to send
   * @param {Object} options - Additional options
   * @returns {Promise<boolean>} Success status
   */
  async sendNotification(chatId, message, options = {}) {
    try {
      if (!this.isAlertBotInitialized || !this.alertBot) {
        logger.error('Alert bot not initialized');
        return false;
      }

      if (!this.isValidChatId(chatId) || !message) {
        logger.error('Invalid parameters for notification sending', {
          chatId: !!chatId,
          message: !!message
        });
        return false;
      }

      // Check rate limiting for notifications
      if (!this.checkRateLimit(chatId, 'notification', 10, 60000)) { // 10 notifications per minute
        logger.warn('Notification rate limit exceeded', { chatId });
        return false;
      }

      await this.alertBot.telegram.sendMessage(chatId, message, {
        parse_mode: 'HTML',
        disable_web_page_preview: true,
        disable_notification: options.silent || false,
        ...options
      });

      logger.info('Notification sent successfully via Alert bot', {
        chatId,
        timestamp: new Date().toISOString()
      });

      // Emit event for monitoring
      this.emit('notificationSent', { chatId, timestamp: new Date() });

      return true;
      
    } catch (error) {
      logger.error('Failed to send notification via Alert bot:', {
        error: error.message,
        chatId,
        stack: error.stack
      });
      
      this.emit('notificationError', { chatId, error: error.message });
      return false;
    }
  }

  /**
   * Send admin alert via Alert bot
   * @param {string} message - Message to send to admin
   * @param {Object} options - Additional options
   * @returns {Promise<boolean>} Success status
   */
  async sendAdminAlert(message, options = {}) {
    try {
      const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
      
      if (!adminChatId) {
        logger.warn('Admin chat ID not configured');
        return false;
      }

      const adminMessage = `🚨 *ALERTA ADMINISTRATIVA*\n\n${message}`;
      
      return await this.sendNotification(adminChatId, adminMessage, {
        parse_mode: 'Markdown',
        disable_notification: false,
        ...options
      });
      
    } catch (error) {
      logger.error('Failed to send admin alert:', {
        error: error.message,
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
          icon: '✅',
          title: 'Retiro Aprobado',
          message: `Su solicitud de retiro ha sido aprobada y está siendo procesada.\n\n` +
                  `💰 <b>Monto:</b> ${withdrawal.amount} ${withdrawal.currency}\n` +
                  `🏦 <b>Red:</b> ${withdrawal.network}\n` +
                  `📅 <b>Fecha:</b> ${new Date(withdrawal.createdAt).toLocaleDateString('es-ES')}\n\n` +
                  `⏳ <i>El procesamiento puede tomar entre 24-48 horas.</i>`
        },
        completed: {
          icon: '🎉',
          title: 'Retiro Completado',
          message: `Su retiro ha sido procesado exitosamente.\n\n` +
                  `💰 <b>Monto:</b> ${withdrawal.amount} ${withdrawal.currency}\n` +
                  `🏦 <b>Red:</b> ${withdrawal.network}\n` +
                  `🔗 <b>Hash:</b> <code>${withdrawal.txHash || 'Pendiente'}</code>\n` +
                  `📅 <b>Completado:</b> ${new Date().toLocaleDateString('es-ES')}\n\n` +
                  `✨ <i>¡Gracias por usar Grow5X!</i>`
        },
        rejected: {
          icon: '❌',
          title: 'Retiro Rechazado',
          message: `Su solicitud de retiro ha sido rechazada.\n\n` +
                  `💰 <b>Monto:</b> ${withdrawal.amount} ${withdrawal.currency}\n` +
                  `📝 <b>Motivo:</b> ${withdrawal.adminNotes || 'No especificado'}\n` +
                  `📅 <b>Fecha:</b> ${new Date(withdrawal.createdAt).toLocaleDateString('es-ES')}\n\n` +
                  `💳 <i>Los fondos han sido devueltos a su balance disponible.</i>`
        },
        pending: {
          icon: '⏳',
          title: 'Retiro en Revisión',
          message: `Su solicitud de retiro está siendo revisada.\n\n` +
                  `💰 <b>Monto:</b> ${withdrawal.amount} ${withdrawal.currency}\n` +
                  `🏦 <b>Red:</b> ${withdrawal.network}\n` +
                  `📅 <b>Solicitado:</b> ${new Date(withdrawal.createdAt).toLocaleDateString('es-ES')}\n\n` +
                  `⏰ <i>Le notificaremos cuando sea procesado.</i>`
        }
      };

      const notification = statusMessages[status];
      if (!notification) {
        logger.error('Invalid withdrawal status for notification', { status });
        return false;
      }

      const fullMessage = `${notification.icon} <b>${notification.title}</b>\n\n${notification.message}`;
      
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
   * Send commission unlock notification
   * @param {string} chatId - Telegram chat ID
   * @param {Object} commission - Commission object
   * @returns {Promise<boolean>} Success status
   */
  async sendCommissionNotification(chatId, commission) {
    try {
      const message = 
        `💰 <b>Comisión Desbloqueada</b>\n\n` +
        `🎉 ¡Felicidades! Se ha desbloqueado una nueva comisión.\n\n` +
        `💵 <b>Monto:</b> $${commission.amount}\n` +
        `👥 <b>Nivel:</b> ${commission.level}\n` +
        `📅 <b>Fecha:</b> ${new Date().toLocaleDateString('es-ES')}\n\n` +
        `💳 <i>Los fondos están disponibles en su balance.</i>`;
      
      return await this.sendNotification(chatId, message);
      
    } catch (error) {
      logger.error('Failed to send commission notification:', {
        error: error.message,
        chatId,
        commissionId: commission._id
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
      account: 'verificación de cuenta',
      login: 'inicio de sesión',
      settings: 'cambio de configuración'
    }[purpose] || 'operación';

    return `🔐 <b>Código de Verificación - Grow5X</b>\n\n` +
           `Su código PIN para <b>${purposeText}</b>:\n\n` +
           `<code>${pin}</code>\n\n` +
           `⏰ <i>Este código expira en 10 minutos</i>\n` +
           `🔒 <i>NUNCA comparta este código con nadie</i>\n` +
           `🛡️ <i>Nuestro equipo NUNCA le pedirá este código</i>\n\n` +
           `❓ Si no solicitó esta operación, ignore este mensaje y contacte soporte.`;
  }

  /**
   * Check rate limiting
   * @param {string} chatId - Chat ID
   * @param {string} type - Type of message (otp, notification)
   * @param {number} limit - Maximum messages allowed
   * @param {number} window - Time window in milliseconds
   * @returns {boolean} Whether the request is within limits
   */
  checkRateLimit(chatId, type, limit, window) {
    const key = `${chatId}:${type}`;
    const now = Date.now();
    
    if (!this.rateLimits.has(key)) {
      this.rateLimits.set(key, []);
    }
    
    const timestamps = this.rateLimits.get(key);
    
    // Remove old timestamps outside the window
    const validTimestamps = timestamps.filter(timestamp => now - timestamp < window);
    
    if (validTimestamps.length >= limit) {
      return false;
    }
    
    validTimestamps.push(now);
    this.rateLimits.set(key, validTimestamps);
    
    return true;
  }

  /**
   * Validate chat ID format
   * @param {string} chatId - Chat ID to validate
   * @returns {boolean} Is valid
   */
  isValidChatId(chatId) {
    if (!chatId) return false;
    return /^-?\d+$/.test(chatId.toString());
  }

  /**
   * Start message queue processor for handling high volume
   */
  startQueueProcessor() {
    setInterval(() => {
      if (this.messageQueue.length > 0) {
        const message = this.messageQueue.shift();
        this.processQueuedMessage(message);
      }
    }, 1000); // Process one message per second to avoid rate limits
  }

  /**
   * Process queued message
   * @param {Object} message - Queued message object
   */
  async processQueuedMessage(message) {
    try {
      const { type, chatId, content, options } = message;
      
      if (type === 'otp') {
        await this.sendOtpPin(chatId, content.pin, content.purpose, options);
      } else if (type === 'notification') {
        await this.sendNotification(chatId, content, options);
      }
      
    } catch (error) {
      logger.error('Failed to process queued message:', {
        error: error.message,
        message
      });
    }
  }

  /**
   * Queue message for later processing
   * @param {string} type - Message type
   * @param {string} chatId - Chat ID
   * @param {any} content - Message content
   * @param {Object} options - Additional options
   */
  queueMessage(type, chatId, content, options = {}) {
    this.messageQueue.push({
      type,
      chatId,
      content,
      options,
      timestamp: new Date()
    });
    
    logger.info('Message queued for processing', {
      type,
      chatId,
      queueLength: this.messageQueue.length
    });
  }

  /**
   * Get service status
   * @returns {Object} Service status
   */
  getStatus() {
    return {
      otpBot: {
        initialized: this.isOtpBotInitialized,
        configured: !!process.env.TELEGRAM_OTP_BOT_TOKEN
      },
      alertBot: {
        initialized: this.isAlertBotInitialized,
        configured: !!process.env.TELEGRAM_ALERT_BOT_TOKEN || !!process.env.TELEGRAM_BOT_TOKEN
      },
      admin: {
        chatConfigured: !!process.env.TELEGRAM_ADMIN_CHAT_ID
      },
      queue: {
        length: this.messageQueue.length,
        rateLimits: this.rateLimits.size
      },
      enabled: process.env.TELEGRAM_ENABLED !== 'false',
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get statistics
   * @returns {Object} Service statistics
   */
  getStats() {
    const events = ['otpSent', 'notificationSent', 'otpError', 'notificationError'];
    const stats = {};
    
    events.forEach(event => {
      stats[event] = this.listenerCount(event);
    });
    
    return {
      ...this.getStatus(),
      eventListeners: stats,
      uptime: process.uptime()
    };
  }

  /**
   * Cleanup resources
   */
  async shutdown() {
    try {
      logger.info('Shutting down Telegram dual service...');
      
      // Clear message queue
      this.messageQueue = [];
      
      // Clear rate limits
      this.rateLimits.clear();
      
      // Remove all listeners
      this.removeAllListeners();
      
      logger.info('Telegram dual service shutdown complete');
      
    } catch (error) {
      logger.error('Error during Telegram dual service shutdown:', {
        error: error.message
      });
    }
  }
}

// Create singleton instance
const telegramDualService = new TelegramDualService();

module.exports = telegramDualService;