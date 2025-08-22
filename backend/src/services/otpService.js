const bcrypt = require('bcryptjs');
const OtpPin = require('../models/OtpPin');
const logger = require('../config/logger');
const telegramMigrationService = require('./telegramMigrationService');

class OTPService {
  /**
   * Genera un código OTP de 6 dígitos
   * @param {string} userId - ID del usuario
   * @param {string} type - Tipo de OTP (withdrawal, password_reset, account_activation)
   * @param {Object} metadata - Metadatos adicionales
   * @returns {Promise<string>} - Código OTP en texto plano
   */
  async generateOTP(userId, type, metadata = {}) {
    try {
      // Invalidar OTPs previos del mismo tipo
      await this.invalidatePreviousOTPs(userId, type);
      
      // Generar PIN de 6 dígitos
      const pin = Math.floor(100000 + Math.random() * 900000).toString();
      
      // Hash del PIN para almacenamiento seguro
      const hashedPin = await bcrypt.hash(pin, 12);
      
      // Crear registro OTP
      const otpRecord = await OtpPin.create({
        userId,
        pin: hashedPin,
        type,
        expiresAt: new Date(Date.now() + this.getExpirationTime(type)),
        metadata
      });
      
      logger.info('OTP generated', {
        userId,
        type,
        otpId: otpRecord._id,
        expiresAt: otpRecord.expiresAt
      });
      
      return pin;
    } catch (error) {
      logger.error('Error generating OTP', { userId, type, error: error.message });
      throw new Error('Error al generar código OTP');
    }
  }
  
  /**
   * Verifica un código OTP
   * @param {string} userId - ID del usuario
   * @param {string} pin - Código PIN a verificar
   * @param {string} type - Tipo de OTP
   * @returns {Promise<Object>} - Resultado de la verificación
   */
  async verifyOTP(userId, pin, type) {
    try {
      // Buscar OTP válido
      const otpRecord = await OtpPin.findOne({
        userId,
        type,
        used: false,
        expiresAt: { $gt: new Date() }
      }).sort({ createdAt: -1 }); // Más reciente primero
      
      if (!otpRecord) {
        logger.warn('OTP not found or expired', { userId, type });
        return {
          valid: false,
          reason: 'Código OTP no encontrado o expirado'
        };
      }
      
      // Verificar PIN
      const isValidPin = await bcrypt.compare(pin, otpRecord.pin);
      
      if (!isValidPin) {
        logger.warn('Invalid OTP attempt', { userId, type, otpId: otpRecord._id });
        return {
          valid: false,
          reason: 'Código OTP incorrecto'
        };
      }
      
      // Marcar como usado
      otpRecord.used = true;
      await otpRecord.save();
      
      logger.info('OTP verified successfully', {
        userId,
        type,
        otpId: otpRecord._id
      });
      
      return {
        valid: true,
        otpId: otpRecord._id,
        metadata: otpRecord.metadata
      };
    } catch (error) {
      logger.error('Error verifying OTP', { userId, type, error: error.message });
      throw new Error('Error al verificar código OTP');
    }
  }
  
  /**
   * Envía OTP por Telegram
   * @param {string} userId - ID del usuario
   * @param {string} pin - Código PIN
   * @param {string} type - Tipo de OTP
   */
  async sendOTPViaTelegram(userId, pin, type) {
    try {
      const User = require('../models/User');
      const user = await User.findById(userId).select('telegramChatId username');
      
      if (!user || !user.telegramChatId) {
        throw new Error('Usuario no tiene Telegram configurado');
      }
      
      const message = this.getOTPMessage(pin, type, user.username);
      await telegramMigrationService.sendOtpPin(user.telegramChatId, pin, type);
      
      logger.info('OTP sent via Telegram', { userId, type });
    } catch (error) {
      logger.error('Error sending OTP via Telegram', {
        userId,
        type,
        error: error.message
      });
      throw error;
    }
  }
  
  /**
   * Invalida OTPs previos del mismo tipo
   * @param {string} userId - ID del usuario
   * @param {string} type - Tipo de OTP
   */
  async invalidatePreviousOTPs(userId, type) {
    await OtpPin.updateMany(
      {
        userId,
        type,
        used: false,
        expiresAt: { $gt: new Date() }
      },
      { used: true }
    );
  }
  
  /**
   * Obtiene el tiempo de expiración según el tipo
   * @param {string} type - Tipo de OTP
   * @returns {number} - Tiempo en milisegundos
   */
  getExpirationTime(type) {
    const times = {
      withdrawal: 10 * 60 * 1000,        // 10 minutos
      password_reset: 15 * 60 * 1000,    // 15 minutos
      account_activation: 60 * 60 * 1000  // 1 hora
    };
    
    return times[type] || 10 * 60 * 1000; // Default 10 minutos
  }
  
  /**
   * Genera mensaje personalizado según el tipo de OTP
   * @param {string} pin - Código PIN
   * @param {string} type - Tipo de OTP
   * @param {string} username - Nombre de usuario
   * @returns {string} - Mensaje formateado
   */
  getOTPMessage(pin, type, username) {
    const messages = {
      withdrawal: `🔐 Hola ${username}\n\nTu código OTP para confirmar el retiro es: **${pin}**\n\n⏱ Válido por 10 minutos\n🔒 No compartas este código con nadie`,
      password_reset: `🔐 Hola ${username}\n\nTu código para restablecer contraseña es: **${pin}**\n\n⏱ Válido por 15 minutos\n🔒 No compartas este código con nadie`,
      account_activation: `🔐 Hola ${username}\n\nTu código de activación es: **${pin}**\n\n⏱ Válido por 1 hora\n🔒 No compartas este código con nadie`
    };
    
    return messages[type] || `🔐 Tu código OTP es: ${pin}`;
  }
  
  /**
   * Limpia OTPs expirados (para ejecutar en cron)
   */
  async cleanupExpiredOTPs() {
    try {
      const deletedCount = await OtpPin.cleanupExpired();
      logger.info('Expired OTPs cleaned up', { deletedCount });
      return deletedCount;
    } catch (error) {
      logger.error('Error cleaning up expired OTPs', { error: error.message });
      throw error;
    }
  }
  
  /**
   * Obtiene estadísticas de OTPs
   * @param {string} userId - ID del usuario (opcional)
   * @returns {Promise<Object>} - Estadísticas
   */
  async getOTPStats(userId = null) {
    try {
      const filter = userId ? { userId } : {};
      
      const stats = await OtpPin.aggregate([
        { $match: filter },
        {
          $group: {
            _id: '$type',
            total: { $sum: 1 },
            used: { $sum: { $cond: ['$used', 1, 0] } },
            expired: {
              $sum: {
                $cond: [
                  { $lt: ['$expiresAt', new Date()] },
                  1,
                  0
                ]
              }
            }
          }
        }
      ]);
      
      return stats;
    } catch (error) {
      logger.error('Error getting OTP stats', { error: error.message });
      throw error;
    }
  }
}

module.exports = new OTPService();