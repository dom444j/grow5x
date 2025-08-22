const User = require('../models/User');
const logger = require('../config/logger');
const telegramService = require('./telegram');
const Redis = require('ioredis');
const crypto = require('crypto');

// Redis client para tokens de activación
const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD,
  db: process.env.REDIS_ACTIVATION_DB || 3,
  retryDelayOnFailover: 100,
  enableReadyCheck: true,
  maxRetriesPerRequest: 3,
  lazyConnect: true
});

/**
 * Servicio de activación por Telegram
 * Maneja el proceso completo de activación de usuarios vía Telegram
 */
class TelegramActivationService {
  constructor() {
    this.ACTIVATION_TOKEN_TTL = 24 * 60 * 60; // 24 horas
    this.MAX_ACTIVATION_ATTEMPTS = 3;
    this.RATE_LIMIT_WINDOW = 60 * 60; // 1 hora
    this.MAX_REQUESTS_PER_HOUR = 5;
  }

  /**
   * Genera un token de activación único para un usuario
   * @param {string} userId - ID del usuario
   * @param {string} telegramChatId - Chat ID de Telegram
   * @returns {Promise<string>} Token de activación
   */
  async generateActivationToken(userId, telegramChatId) {
    try {
      // Verificar rate limiting
      const rateLimitKey = `activation_rate:${telegramChatId}`;
      const currentRequests = await redis.get(rateLimitKey) || 0;
      
      if (parseInt(currentRequests) >= this.MAX_REQUESTS_PER_HOUR) {
        throw new Error('RATE_LIMIT_EXCEEDED');
      }

      // Generar token único
      const token = crypto.randomBytes(32).toString('hex');
      const tokenKey = `activation_token:${token}`;
      
      // Datos del token
      const tokenData = {
        userId,
        telegramChatId,
        createdAt: new Date().toISOString(),
        attempts: 0,
        used: false
      };

      // Guardar token en Redis
      await redis.setex(tokenKey, this.ACTIVATION_TOKEN_TTL, JSON.stringify(tokenData));
      
      // Incrementar contador de rate limiting
      await redis.incr(rateLimitKey);
      await redis.expire(rateLimitKey, this.RATE_LIMIT_WINDOW);

      logger.info('Activation token generated', {
        userId,
        telegramChatId,
        token: token.substring(0, 8) + '...', // Log solo los primeros 8 caracteres
        expiresIn: this.ACTIVATION_TOKEN_TTL
      });

      return token;

    } catch (error) {
      logger.error('Error generating activation token', {
        userId,
        telegramChatId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Envía mensaje de activación por Telegram
   * @param {string} userId - ID del usuario
   * @param {string} telegramChatId - Chat ID de Telegram
   * @param {Object} userInfo - Información del usuario
   * @returns {Promise<boolean>} Éxito del envío
   */
  async sendActivationMessage(userId, telegramChatId, userInfo) {
    try {
      // Generar token de activación
      const token = await this.generateActivationToken(userId, telegramChatId);
      
      // Crear URL de activación
      const activationUrl = `${process.env.FRONTEND_URL || 'https://app.grow5x.app'}/activate?token=${token}`;
      
      // Mensaje de activación
      const message = this.formatActivationMessage(userInfo, activationUrl, token);
      
      // Enviar mensaje por Telegram
      const sent = await telegramService.sendNotification(telegramChatId, message);
      
      if (sent) {
        logger.info('Activation message sent successfully', {
          userId,
          telegramChatId,
          token: token.substring(0, 8) + '...'
        });
        
        // Notificar al admin
        await this.notifyAdminActivationRequest(userInfo, telegramChatId);
      }
      
      return sent;

    } catch (error) {
      logger.error('Error sending activation message', {
        userId,
        telegramChatId,
        error: error.message
      });
      return false;
    }
  }

  /**
   * Formatea el mensaje de activación
   * @param {Object} userInfo - Información del usuario
   * @param {string} activationUrl - URL de activación
   * @param {string} token - Token de activación
   * @returns {string} Mensaje formateado
   */
  formatActivationMessage(userInfo, activationUrl, token) {
    return (
      `🎉 <b>¡Bienvenido a Grow5X!</b>\n\n` +
      `Hola ${userInfo.firstName} ${userInfo.lastName},\n\n` +
      `Tu cuenta ha sido creada exitosamente. Para completar el proceso de registro, ` +
      `necesitas activar tu cuenta.\n\n` +
      `🔐 <b>Código de activación:</b> <code>${token.substring(0, 12)}</code>\n\n` +
      `🌐 <b>Activa tu cuenta aquí:</b>\n` +
      `${activationUrl}\n\n` +
      `⚠️ <b>Importante:</b>\n` +
      `• Este enlace expira en 24 horas\n` +
      `• Solo puedes usar este código una vez\n` +
      `• Mantén este código seguro\n\n` +
      `Si no solicitaste esta cuenta, puedes ignorar este mensaje.\n\n` +
      `¡Gracias por unirte a Grow5X! 🚀`
    );
  }

  /**
   * Valida y procesa un token de activación
   * @param {string} token - Token de activación
   * @param {string} telegramChatId - Chat ID de Telegram (opcional para validación adicional)
   * @returns {Promise<Object>} Resultado de la activación
   */
  async activateWithToken(token, telegramChatId = null) {
    try {
      const tokenKey = `activation_token:${token}`;
      const tokenDataStr = await redis.get(tokenKey);
      
      if (!tokenDataStr) {
        return {
          success: false,
          error: 'INVALID_TOKEN',
          message: 'Token de activación inválido o expirado'
        };
      }

      const tokenData = JSON.parse(tokenDataStr);
      
      // Verificar si el token ya fue usado
      if (tokenData.used) {
        return {
          success: false,
          error: 'TOKEN_ALREADY_USED',
          message: 'Este token ya ha sido utilizado'
        };
      }

      // Verificar intentos máximos
      if (tokenData.attempts >= this.MAX_ACTIVATION_ATTEMPTS) {
        await redis.del(tokenKey);
        return {
          success: false,
          error: 'MAX_ATTEMPTS_EXCEEDED',
          message: 'Se han excedido los intentos máximos de activación'
        };
      }

      // Validación adicional de chat ID si se proporciona
      if (telegramChatId && tokenData.telegramChatId !== telegramChatId) {
        // Incrementar intentos
        tokenData.attempts += 1;
        await redis.setex(tokenKey, this.ACTIVATION_TOKEN_TTL, JSON.stringify(tokenData));
        
        return {
          success: false,
          error: 'CHAT_ID_MISMATCH',
          message: 'Token no válido para este chat de Telegram'
        };
      }

      // Buscar y activar usuario
      const user = await User.findOne({ userId: tokenData.userId });
      
      if (!user) {
        await redis.del(tokenKey);
        return {
          success: false,
          error: 'USER_NOT_FOUND',
          message: 'Usuario no encontrado'
        };
      }

      if (user.isActive) {
        await redis.del(tokenKey);
        return {
          success: false,
          error: 'ALREADY_ACTIVE',
          message: 'La cuenta ya está activada'
        };
      }

      // Activar usuario
      await User.findByIdAndUpdate(user._id, {
        isActive: true,
        telegramVerified: true,
        telegramVerifiedAt: new Date(),
        telegramChatId: tokenData.telegramChatId,
        activatedAt: new Date(),
        activationMethod: 'telegram'
      });

      // Marcar token como usado
      tokenData.used = true;
      tokenData.usedAt = new Date().toISOString();
      await redis.setex(tokenKey, 3600, JSON.stringify(tokenData)); // Mantener por 1 hora para auditoría

      logger.info('User activated successfully via Telegram', {
        userId: user.userId,
        email: user.email,
        telegramChatId: tokenData.telegramChatId,
        token: token.substring(0, 8) + '...'
      });

      // Enviar confirmación al usuario
      await this.sendActivationConfirmation(tokenData.telegramChatId, user);
      
      // Notificar al admin
      await this.notifyAdminActivationSuccess(user, tokenData.telegramChatId);

      return {
        success: true,
        message: 'Cuenta activada exitosamente',
        user: {
          userId: user.userId,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          isActive: true,
          telegramVerified: true
        }
      };

    } catch (error) {
      logger.error('Error activating user with token', {
        token: token.substring(0, 8) + '...',
        telegramChatId,
        error: error.message
      });
      
      return {
        success: false,
        error: 'INTERNAL_ERROR',
        message: 'Error interno del servidor'
      };
    }
  }

  /**
   * Envía confirmación de activación al usuario
   * @param {string} telegramChatId - Chat ID de Telegram
   * @param {Object} user - Datos del usuario
   */
  async sendActivationConfirmation(telegramChatId, user) {
    try {
      const message = (
        `✅ <b>¡Cuenta activada exitosamente!</b>\n\n` +
        `🎉 ¡Bienvenido oficialmente a Grow5X, ${user.firstName}!\n\n` +
        `Tu cuenta ha sido activada y ya puedes acceder a la plataforma ` +
        `con tu email y contraseña.\n\n` +
        `🌐 <b>Accede aquí:</b>\n` +
        `${process.env.FRONTEND_URL || 'https://app.grow5x.app'}\n\n` +
        `📱 <b>Próximos pasos:</b>\n` +
        `• Completa tu perfil\n` +
        `• Configura tu billetera\n` +
        `• Explora las oportunidades de inversión\n\n` +
        `¡Gracias por unirte a nuestra comunidad! 🚀`
      );
      
      await telegramService.sendNotification(telegramChatId, message);
      
    } catch (error) {
      logger.warn('Error sending activation confirmation', {
        telegramChatId,
        userId: user.userId,
        error: error.message
      });
    }
  }

  /**
   * Notifica al admin sobre solicitud de activación
   * @param {Object} userInfo - Información del usuario
   * @param {string} telegramChatId - Chat ID de Telegram
   */
  async notifyAdminActivationRequest(userInfo, telegramChatId) {
    try {
      const message = (
        `📝 <b>Nueva solicitud de activación</b>\n\n` +
        `👤 ${userInfo.firstName} ${userInfo.lastName}\n` +
        `📧 ${userInfo.email}\n` +
        `🆔 ${userInfo.userId}\n` +
        `📱 Chat ID: ${telegramChatId}\n` +
        `⏱ ${new Date().toISOString()}\n\n` +
        `El usuario recibirá un enlace de activación por Telegram.`
      );
      
      await telegramService.sendAdminNotification(message);
      
    } catch (error) {
      logger.warn('Error notifying admin about activation request', {
        userId: userInfo.userId,
        error: error.message
      });
    }
  }

  /**
   * Notifica al admin sobre activación exitosa
   * @param {Object} user - Datos del usuario
   * @param {string} telegramChatId - Chat ID de Telegram
   */
  async notifyAdminActivationSuccess(user, telegramChatId) {
    try {
      const message = (
        `✅ <b>Usuario activado vía Telegram</b>\n\n` +
        `👤 ${user.firstName} ${user.lastName}\n` +
        `📧 ${user.email}\n` +
        `🆔 ${user.userId}\n` +
        `📱 Chat ID: ${telegramChatId}\n` +
        `⏱ ${new Date().toISOString()}\n\n` +
        `La cuenta ha sido activada exitosamente.`
      );
      
      await telegramService.sendAdminNotification(message);
      
    } catch (error) {
      logger.warn('Error notifying admin about activation success', {
        userId: user.userId,
        error: error.message
      });
    }
  }

  /**
   * Obtiene estadísticas de activación
   * @param {string} period - Período de tiempo ('day', 'week', 'month')
   * @returns {Promise<Object>} Estadísticas
   */
  async getActivationStats(period = 'day') {
    try {
      const periodMs = {
        day: 24 * 60 * 60 * 1000,
        week: 7 * 24 * 60 * 60 * 1000,
        month: 30 * 24 * 60 * 60 * 1000
      };

      const since = new Date(Date.now() - periodMs[period]);
      
      const [totalActivations, telegramActivations, pendingTokens] = await Promise.all([
        User.countDocuments({
          isActive: true,
          activatedAt: { $gte: since }
        }),
        User.countDocuments({
          isActive: true,
          activationMethod: 'telegram',
          activatedAt: { $gte: since }
        }),
        this.getPendingTokensCount()
      ]);

      return {
        period,
        totalActivations,
        telegramActivations,
        manualActivations: totalActivations - telegramActivations,
        pendingTokens,
        telegramActivationRate: totalActivations > 0 ? (telegramActivations / totalActivations * 100).toFixed(2) : 0
      };

    } catch (error) {
      logger.error('Error getting activation stats', {
        period,
        error: error.message
      });
      return null;
    }
  }

  /**
   * Obtiene el número de tokens pendientes
   * @returns {Promise<number>} Número de tokens pendientes
   */
  async getPendingTokensCount() {
    try {
      const keys = await redis.keys('activation_token:*');
      let pendingCount = 0;
      
      for (const key of keys) {
        const tokenDataStr = await redis.get(key);
        if (tokenDataStr) {
          const tokenData = JSON.parse(tokenDataStr);
          if (!tokenData.used) {
            pendingCount++;
          }
        }
      }
      
      return pendingCount;
    } catch (error) {
      logger.warn('Error counting pending tokens', { error: error.message });
      return 0;
    }
  }

  /**
   * Limpia tokens expirados
   * @returns {Promise<number>} Número de tokens limpiados
   */
  async cleanupExpiredTokens() {
    try {
      const keys = await redis.keys('activation_token:*');
      let cleanedCount = 0;
      
      for (const key of keys) {
        const ttl = await redis.ttl(key);
        if (ttl === -1 || ttl === -2) { // -1: no expiry, -2: key doesn't exist
          await redis.del(key);
          cleanedCount++;
        }
      }
      
      logger.info('Expired activation tokens cleaned', { cleanedCount });
      return cleanedCount;
      
    } catch (error) {
      logger.error('Error cleaning expired tokens', { error: error.message });
      return 0;
    }
  }
}

// Manejo de eventos Redis
redis.on('connect', () => {
  logger.info('Redis connected for Telegram activation service');
});

redis.on('error', (err) => {
  logger.error('Redis connection error for Telegram activation', { error: err.message });
});

module.exports = new TelegramActivationService();