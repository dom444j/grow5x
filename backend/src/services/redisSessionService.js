const Redis = require('ioredis');
const logger = require('../config/logger');
const crypto = require('crypto');

// Redis client para sesiones
const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD,
  db: process.env.REDIS_SESSION_DB || 1,
  retryDelayOnFailover: 100,
  enableReadyCheck: true,
  maxRetriesPerRequest: 3,
  lazyConnect: true,
  keyPrefix: 'grow5x:session:'
});

/**
 * Servicio de sesiones Redis
 * Maneja sesiones de usuario, tokens de autenticación y datos temporales
 */
class RedisSessionService {
  constructor() {
    this.DEFAULT_SESSION_TTL = 86400; // 24 horas
    this.SHORT_SESSION_TTL = 3600; // 1 hora
    this.LONG_SESSION_TTL = 604800; // 7 días
    this.TOKEN_TTL = 1800; // 30 minutos
    this.OTP_TTL = 300; // 5 minutos
  }

  /**
   * Genera un ID de sesión único
   * @returns {string} ID de sesión
   */
  generateSessionId() {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Genera un token temporal único
   * @returns {string} Token temporal
   */
  generateToken() {
    return crypto.randomBytes(16).toString('hex');
  }

  /**
   * Crea una nueva sesión de usuario
   * @param {string} userId - ID del usuario
   * @param {Object} sessionData - Datos de la sesión
   * @param {number} ttl - Tiempo de vida en segundos
   * @returns {Promise<string>} ID de sesión
   */
  async createSession(userId, sessionData = {}, ttl = this.DEFAULT_SESSION_TTL) {
    try {
      const sessionId = this.generateSessionId();
      const sessionKey = `user:${userId}:${sessionId}`;
      
      const session = {
        sessionId,
        userId,
        createdAt: new Date().toISOString(),
        lastAccessedAt: new Date().toISOString(),
        ipAddress: sessionData.ipAddress,
        userAgent: sessionData.userAgent,
        deviceInfo: sessionData.deviceInfo,
        ...sessionData
      };
      
      await redis.setex(sessionKey, ttl, JSON.stringify(session));
      
      // Mantener un índice de sesiones por usuario
      const userSessionsKey = `user_sessions:${userId}`;
      await redis.sadd(userSessionsKey, sessionId);
      await redis.expire(userSessionsKey, ttl);
      
      logger.debug('Session created', {
        userId,
        sessionId,
        ttl
      });
      
      return sessionId;
      
    } catch (error) {
      logger.error('Error creating session', {
        userId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Obtiene una sesión por ID
   * @param {string} userId - ID del usuario
   * @param {string} sessionId - ID de la sesión
   * @returns {Promise<Object|null>} Datos de la sesión
   */
  async getSession(userId, sessionId) {
    try {
      const sessionKey = `user:${userId}:${sessionId}`;
      const sessionData = await redis.get(sessionKey);
      
      if (!sessionData) {
        return null;
      }
      
      const session = JSON.parse(sessionData);
      
      // Actualizar último acceso
      session.lastAccessedAt = new Date().toISOString();
      await redis.setex(sessionKey, await redis.ttl(sessionKey), JSON.stringify(session));
      
      return session;
      
    } catch (error) {
      logger.error('Error getting session', {
        userId,
        sessionId,
        error: error.message
      });
      return null;
    }
  }

  /**
   * Actualiza datos de una sesión
   * @param {string} userId - ID del usuario
   * @param {string} sessionId - ID de la sesión
   * @param {Object} updateData - Datos a actualizar
   * @returns {Promise<boolean>} Éxito de la operación
   */
  async updateSession(userId, sessionId, updateData) {
    try {
      const sessionKey = `user:${userId}:${sessionId}`;
      const sessionData = await redis.get(sessionKey);
      
      if (!sessionData) {
        return false;
      }
      
      const session = JSON.parse(sessionData);
      const updatedSession = {
        ...session,
        ...updateData,
        lastAccessedAt: new Date().toISOString()
      };
      
      const ttl = await redis.ttl(sessionKey);
      await redis.setex(sessionKey, ttl > 0 ? ttl : this.DEFAULT_SESSION_TTL, JSON.stringify(updatedSession));
      
      return true;
      
    } catch (error) {
      logger.error('Error updating session', {
        userId,
        sessionId,
        error: error.message
      });
      return false;
    }
  }

  /**
   * Elimina una sesión específica
   * @param {string} userId - ID del usuario
   * @param {string} sessionId - ID de la sesión
   * @returns {Promise<boolean>} Éxito de la operación
   */
  async deleteSession(userId, sessionId) {
    try {
      const sessionKey = `user:${userId}:${sessionId}`;
      const userSessionsKey = `user_sessions:${userId}`;
      
      await redis.del(sessionKey);
      await redis.srem(userSessionsKey, sessionId);
      
      logger.debug('Session deleted', {
        userId,
        sessionId
      });
      
      return true;
      
    } catch (error) {
      logger.error('Error deleting session', {
        userId,
        sessionId,
        error: error.message
      });
      return false;
    }
  }

  /**
   * Elimina todas las sesiones de un usuario
   * @param {string} userId - ID del usuario
   * @returns {Promise<number>} Número de sesiones eliminadas
   */
  async deleteAllUserSessions(userId) {
    try {
      const userSessionsKey = `user_sessions:${userId}`;
      const sessionIds = await redis.smembers(userSessionsKey);
      
      if (sessionIds.length === 0) {
        return 0;
      }
      
      const sessionKeys = sessionIds.map(sessionId => `user:${userId}:${sessionId}`);
      sessionKeys.push(userSessionsKey);
      
      const deletedCount = await redis.del(...sessionKeys);
      
      logger.debug('All user sessions deleted', {
        userId,
        count: sessionIds.length
      });
      
      return sessionIds.length;
      
    } catch (error) {
      logger.error('Error deleting all user sessions', {
        userId,
        error: error.message
      });
      return 0;
    }
  }

  /**
   * Obtiene todas las sesiones activas de un usuario
   * @param {string} userId - ID del usuario
   * @returns {Promise<Array>} Lista de sesiones activas
   */
  async getUserSessions(userId) {
    try {
      const userSessionsKey = `user_sessions:${userId}`;
      const sessionIds = await redis.smembers(userSessionsKey);
      
      if (sessionIds.length === 0) {
        return [];
      }
      
      const sessions = [];
      
      for (const sessionId of sessionIds) {
        const sessionKey = `user:${userId}:${sessionId}`;
        const sessionData = await redis.get(sessionKey);
        
        if (sessionData) {
          const session = JSON.parse(sessionData);
          const ttl = await redis.ttl(sessionKey);
          session.expiresIn = ttl;
          sessions.push(session);
        } else {
          // Limpiar sesión expirada del índice
          await redis.srem(userSessionsKey, sessionId);
        }
      }
      
      return sessions;
      
    } catch (error) {
      logger.error('Error getting user sessions', {
        userId,
        error: error.message
      });
      return [];
    }
  }

  /**
   * Almacena un token temporal
   * @param {string} tokenType - Tipo de token (reset, activation, etc.)
   * @param {string} userId - ID del usuario
   * @param {Object} tokenData - Datos del token
   * @param {number} ttl - Tiempo de vida en segundos
   * @returns {Promise<string>} Token generado
   */
  async storeToken(tokenType, userId, tokenData = {}, ttl = this.TOKEN_TTL) {
    try {
      const token = this.generateToken();
      const tokenKey = `token:${tokenType}:${token}`;
      
      const data = {
        token,
        tokenType,
        userId,
        createdAt: new Date().toISOString(),
        ...tokenData
      };
      
      await redis.setex(tokenKey, ttl, JSON.stringify(data));
      
      // Mantener un índice de tokens por usuario
      const userTokensKey = `user_tokens:${userId}:${tokenType}`;
      await redis.sadd(userTokensKey, token);
      await redis.expire(userTokensKey, ttl);
      
      logger.debug('Token stored', {
        tokenType,
        userId,
        token: token.substring(0, 8) + '...',
        ttl
      });
      
      return token;
      
    } catch (error) {
      logger.error('Error storing token', {
        tokenType,
        userId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Obtiene y valida un token
   * @param {string} tokenType - Tipo de token
   * @param {string} token - Token a validar
   * @returns {Promise<Object|null>} Datos del token si es válido
   */
  async getToken(tokenType, token) {
    try {
      const tokenKey = `token:${tokenType}:${token}`;
      const tokenData = await redis.get(tokenKey);
      
      if (!tokenData) {
        return null;
      }
      
      const data = JSON.parse(tokenData);
      const ttl = await redis.ttl(tokenKey);
      data.expiresIn = ttl;
      
      return data;
      
    } catch (error) {
      logger.error('Error getting token', {
        tokenType,
        token: token.substring(0, 8) + '...',
        error: error.message
      });
      return null;
    }
  }

  /**
   * Consume un token (lo elimina después de usarlo)
   * @param {string} tokenType - Tipo de token
   * @param {string} token - Token a consumir
   * @returns {Promise<Object|null>} Datos del token si era válido
   */
  async consumeToken(tokenType, token) {
    try {
      const tokenKey = `token:${tokenType}:${token}`;
      const tokenData = await redis.get(tokenKey);
      
      if (!tokenData) {
        return null;
      }
      
      const data = JSON.parse(tokenData);
      
      // Eliminar token y del índice de usuario
      await redis.del(tokenKey);
      const userTokensKey = `user_tokens:${data.userId}:${tokenType}`;
      await redis.srem(userTokensKey, token);
      
      logger.debug('Token consumed', {
        tokenType,
        userId: data.userId,
        token: token.substring(0, 8) + '...'
      });
      
      return data;
      
    } catch (error) {
      logger.error('Error consuming token', {
        tokenType,
        token: token.substring(0, 8) + '...',
        error: error.message
      });
      return null;
    }
  }

  /**
   * Almacena un código OTP
   * @param {string} userId - ID del usuario
   * @param {string} otpCode - Código OTP
   * @param {Object} otpData - Datos adicionales del OTP
   * @param {number} ttl - Tiempo de vida en segundos
   * @returns {Promise<boolean>} Éxito de la operación
   */
  async storeOTP(userId, otpCode, otpData = {}, ttl = this.OTP_TTL) {
    try {
      const otpKey = `otp:${userId}:${otpCode}`;
      
      const data = {
        userId,
        otpCode,
        createdAt: new Date().toISOString(),
        attempts: 0,
        ...otpData
      };
      
      await redis.setex(otpKey, ttl, JSON.stringify(data));
      
      // Mantener solo un OTP activo por usuario
      const userOtpKey = `user_otp:${userId}`;
      const existingOtp = await redis.get(userOtpKey);
      if (existingOtp) {
        await redis.del(`otp:${userId}:${existingOtp}`);
      }
      
      await redis.setex(userOtpKey, ttl, otpCode);
      
      logger.debug('OTP stored', {
        userId,
        otpCode: otpCode.substring(0, 2) + '***',
        ttl
      });
      
      return true;
      
    } catch (error) {
      logger.error('Error storing OTP', {
        userId,
        error: error.message
      });
      return false;
    }
  }

  /**
   * Valida un código OTP
   * @param {string} userId - ID del usuario
   * @param {string} otpCode - Código OTP a validar
   * @param {boolean} consume - Si debe consumir el OTP después de validarlo
   * @returns {Promise<Object|null>} Datos del OTP si es válido
   */
  async validateOTP(userId, otpCode, consume = true) {
    try {
      const otpKey = `otp:${userId}:${otpCode}`;
      const otpData = await redis.get(otpKey);
      
      if (!otpData) {
        return null;
      }
      
      const data = JSON.parse(otpData);
      data.attempts = (data.attempts || 0) + 1;
      
      // Límite de intentos
      if (data.attempts > 3) {
        await redis.del(otpKey);
        await redis.del(`user_otp:${userId}`);
        
        logger.warn('OTP max attempts exceeded', {
          userId,
          otpCode: otpCode.substring(0, 2) + '***'
        });
        
        return null;
      }
      
      if (consume) {
        // Consumir OTP
        await redis.del(otpKey);
        await redis.del(`user_otp:${userId}`);
        
        logger.debug('OTP consumed', {
          userId,
          otpCode: otpCode.substring(0, 2) + '***'
        });
      } else {
        // Actualizar intentos
        const ttl = await redis.ttl(otpKey);
        await redis.setex(otpKey, ttl > 0 ? ttl : this.OTP_TTL, JSON.stringify(data));
      }
      
      return data;
      
    } catch (error) {
      logger.error('Error validating OTP', {
        userId,
        error: error.message
      });
      return null;
    }
  }

  /**
   * Obtiene estadísticas de sesiones
   * @returns {Promise<Object>} Estadísticas de sesiones
   */
  async getSessionStats() {
    try {
      const info = await redis.info('keyspace');
      const totalKeys = info.match(/keys=(\d+)/)?.[1] || '0';
      
      // Contar diferentes tipos de claves
      const userSessionKeys = await redis.keys('user:*');
      const tokenKeys = await redis.keys('token:*');
      const otpKeys = await redis.keys('otp:*');
      
      return {
        totalKeys: parseInt(totalKeys),
        activeSessions: userSessionKeys.length,
        activeTokens: tokenKeys.length,
        activeOTPs: otpKeys.length,
        connected: redis.status === 'ready'
      };
      
    } catch (error) {
      logger.error('Error getting session stats', { error: error.message });
      return {
        totalKeys: 0,
        activeSessions: 0,
        activeTokens: 0,
        activeOTPs: 0,
        connected: false
      };
    }
  }

  /**
   * Limpia sesiones expiradas
   * @returns {Promise<number>} Número de sesiones limpiadas
   */
  async cleanupExpiredSessions() {
    try {
      let cleanedCount = 0;
      
      // Obtener todas las claves de sesiones de usuario
      const userSessionIndexes = await redis.keys('user_sessions:*');
      
      for (const indexKey of userSessionIndexes) {
        const userId = indexKey.split(':')[1];
        const sessionIds = await redis.smembers(indexKey);
        
        for (const sessionId of sessionIds) {
          const sessionKey = `user:${userId}:${sessionId}`;
          const exists = await redis.exists(sessionKey);
          
          if (!exists) {
            await redis.srem(indexKey, sessionId);
            cleanedCount++;
          }
        }
        
        // Si no quedan sesiones, eliminar el índice
        const remainingSessions = await redis.scard(indexKey);
        if (remainingSessions === 0) {
          await redis.del(indexKey);
        }
      }
      
      logger.info('Expired sessions cleaned', { count: cleanedCount });
      return cleanedCount;
      
    } catch (error) {
      logger.error('Error cleaning expired sessions', { error: error.message });
      return 0;
    }
  }
}

// Manejo de eventos Redis
redis.on('connect', () => {
  logger.info('Redis connected for session service');
});

redis.on('ready', () => {
  logger.info('Redis ready for session operations');
});

redis.on('error', (err) => {
  logger.error('Redis session connection error', { error: err.message });
});

redis.on('close', () => {
  logger.warn('Redis session connection closed');
});

// Crear instancia del servicio
const sessionService = new RedisSessionService();

// Limpiar sesiones expiradas cada hora
setInterval(() => {
  sessionService.cleanupExpiredSessions().catch(err => {
    logger.error('Error in session cleanup interval', { error: err.message });
  });
}, 3600000); // 1 hora

module.exports = {
  RedisSessionService,
  sessionService,
  redis
};