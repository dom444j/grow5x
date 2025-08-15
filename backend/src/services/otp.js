/**
 * OTP Service
 * Handles OTP PIN generation, validation, and management
 */

const crypto = require('crypto');
const logger = require('../config/logger');

// In-memory store for OTP codes (in production, use Redis)
const otpStore = new Map();

class OtpService {
  constructor() {
    this.otpExpiration = 10 * 60 * 1000; // 10 minutes in milliseconds
    this.maxAttempts = 3;
    this.cleanupInterval = 5 * 60 * 1000; // 5 minutes
    
    // Start cleanup interval
    this.startCleanupInterval();
  }

  /**
   * Generate a 6-digit OTP PIN
   * @returns {string} 6-digit PIN
   */
  generatePin() {
    return crypto.randomInt(100000, 999999).toString();
  }

  /**
   * Create and store OTP for user
   * @param {string} userId - User ID
   * @param {string} purpose - Purpose of OTP (withdrawal, security, etc.)
   * @returns {Object} OTP details
   */
  createOtp(userId, purpose = 'withdrawal') {
    try {
      const pin = this.generatePin();
      const otpId = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + this.otpExpiration);
      
      const otpData = {
        id: otpId,
        userId,
        pin,
        purpose,
        attempts: 0,
        maxAttempts: this.maxAttempts,
        createdAt: new Date(),
        expiresAt,
        used: false
      };

      // Store OTP with composite key
      const storeKey = `${userId}:${purpose}`;
      
      // Remove any existing OTP for this user/purpose
      if (otpStore.has(storeKey)) {
        logger.info('Replacing existing OTP', {
          userId,
          purpose,
          oldOtpId: otpStore.get(storeKey).id
        });
      }
      
      otpStore.set(storeKey, otpData);
      
      logger.info('OTP created successfully', {
        otpId,
        userId,
        purpose,
        expiresAt: expiresAt.toISOString()
      });

      return {
        otpId,
        pin,
        expiresAt,
        purpose
      };
      
    } catch (error) {
      logger.error('Failed to create OTP:', {
        error: error.message,
        userId,
        purpose,
        stack: error.stack
      });
      
      throw new Error('Failed to generate OTP');
    }
  }

  /**
   * Validate OTP PIN
   * @param {string} userId - User ID
   * @param {string} pin - PIN to validate
   * @param {string} purpose - Purpose of OTP
   * @returns {Object} Validation result
   */
  validateOtp(userId, pin, purpose = 'withdrawal') {
    try {
      const storeKey = `${userId}:${purpose}`;
      const otpData = otpStore.get(storeKey);

      if (!otpData) {
        logger.warn('OTP not found for validation', {
          userId,
          purpose,
          pin: pin ? 'provided' : 'missing'
        });
        
        return {
          valid: false,
          error: 'OTP_NOT_FOUND',
          message: 'Código OTP no encontrado o expirado'
        };
      }

      // Check if OTP is expired
      if (new Date() > otpData.expiresAt) {
        this.removeOtp(userId, purpose);
        
        logger.warn('OTP expired during validation', {
          userId,
          purpose,
          otpId: otpData.id,
          expiresAt: otpData.expiresAt.toISOString()
        });
        
        return {
          valid: false,
          error: 'OTP_EXPIRED',
          message: 'Código OTP expirado'
        };
      }

      // Check if OTP is already used
      if (otpData.used) {
        logger.warn('Attempt to use already used OTP', {
          userId,
          purpose,
          otpId: otpData.id
        });
        
        return {
          valid: false,
          error: 'OTP_ALREADY_USED',
          message: 'Código OTP ya utilizado'
        };
      }

      // Increment attempt counter
      otpData.attempts++;

      // Check if max attempts exceeded
      if (otpData.attempts > otpData.maxAttempts) {
        this.removeOtp(userId, purpose);
        
        logger.warn('Max OTP attempts exceeded', {
          userId,
          purpose,
          otpId: otpData.id,
          attempts: otpData.attempts
        });
        
        return {
          valid: false,
          error: 'MAX_ATTEMPTS_EXCEEDED',
          message: 'Máximo número de intentos excedido'
        };
      }

      // Validate PIN
      if (otpData.pin !== pin) {
        logger.warn('Invalid OTP PIN provided', {
          userId,
          purpose,
          otpId: otpData.id,
          attempts: otpData.attempts,
          remainingAttempts: otpData.maxAttempts - otpData.attempts
        });
        
        return {
          valid: false,
          error: 'INVALID_PIN',
          message: `Código OTP incorrecto. Intentos restantes: ${otpData.maxAttempts - otpData.attempts}`,
          remainingAttempts: otpData.maxAttempts - otpData.attempts
        };
      }

      // Mark as used
      otpData.used = true;
      otpData.usedAt = new Date();

      logger.info('OTP validated successfully', {
        userId,
        purpose,
        otpId: otpData.id,
        attempts: otpData.attempts
      });

      return {
        valid: true,
        otpId: otpData.id,
        message: 'Código OTP válido'
      };
      
    } catch (error) {
      logger.error('Failed to validate OTP:', {
        error: error.message,
        userId,
        purpose,
        stack: error.stack
      });
      
      return {
        valid: false,
        error: 'VALIDATION_ERROR',
        message: 'Error interno en la validación'
      };
    }
  }

  /**
   * Remove OTP from store
   * @param {string} userId - User ID
   * @param {string} purpose - Purpose of OTP
   * @returns {boolean} Success status
   */
  removeOtp(userId, purpose = 'withdrawal') {
    try {
      const storeKey = `${userId}:${purpose}`;
      const existed = otpStore.has(storeKey);
      
      if (existed) {
        const otpData = otpStore.get(storeKey);
        otpStore.delete(storeKey);
        
        logger.info('OTP removed from store', {
          userId,
          purpose,
          otpId: otpData.id
        });
      }
      
      return existed;
      
    } catch (error) {
      logger.error('Failed to remove OTP:', {
        error: error.message,
        userId,
        purpose
      });
      
      return false;
    }
  }

  /**
   * Get OTP status for user
   * @param {string} userId - User ID
   * @param {string} purpose - Purpose of OTP
   * @returns {Object|null} OTP status or null if not found
   */
  getOtpStatus(userId, purpose = 'withdrawal') {
    try {
      const storeKey = `${userId}:${purpose}`;
      const otpData = otpStore.get(storeKey);

      if (!otpData) {
        return null;
      }

      const now = new Date();
      const isExpired = now > otpData.expiresAt;
      const timeRemaining = Math.max(0, otpData.expiresAt.getTime() - now.getTime());

      return {
        exists: true,
        expired: isExpired,
        used: otpData.used,
        attempts: otpData.attempts,
        maxAttempts: otpData.maxAttempts,
        remainingAttempts: Math.max(0, otpData.maxAttempts - otpData.attempts),
        timeRemaining: Math.floor(timeRemaining / 1000), // seconds
        createdAt: otpData.createdAt,
        expiresAt: otpData.expiresAt
      };
      
    } catch (error) {
      logger.error('Failed to get OTP status:', {
        error: error.message,
        userId,
        purpose
      });
      
      return null;
    }
  }

  /**
   * Clean up expired OTPs
   */
  cleanupExpiredOtps() {
    try {
      const now = new Date();
      let cleanedCount = 0;

      for (const [key, otpData] of otpStore.entries()) {
        if (now > otpData.expiresAt) {
          otpStore.delete(key);
          cleanedCount++;
        }
      }

      if (cleanedCount > 0) {
        logger.info('Cleaned up expired OTPs', {
          cleanedCount,
          remainingCount: otpStore.size
        });
      }
      
    } catch (error) {
      logger.error('Failed to cleanup expired OTPs:', {
        error: error.message,
        stack: error.stack
      });
    }
  }

  /**
   * Start cleanup interval
   */
  startCleanupInterval() {
    setInterval(() => {
      this.cleanupExpiredOtps();
    }, this.cleanupInterval);
    
    logger.info('OTP cleanup interval started', {
      intervalMs: this.cleanupInterval
    });
  }

  /**
   * Get service statistics
   * @returns {Object} Service stats
   */
  getStats() {
    const now = new Date();
    let activeCount = 0;
    let expiredCount = 0;
    let usedCount = 0;

    for (const otpData of otpStore.values()) {
      if (otpData.used) {
        usedCount++;
      } else if (now > otpData.expiresAt) {
        expiredCount++;
      } else {
        activeCount++;
      }
    }

    return {
      total: otpStore.size,
      active: activeCount,
      expired: expiredCount,
      used: usedCount,
      timestamp: now.toISOString()
    };
  }
}

// Create singleton instance
const otpService = new OtpService();

module.exports = otpService;