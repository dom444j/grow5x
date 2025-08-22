const express = require('express');
const { z } = require('zod');
const rateLimit = require('express-rate-limit');
const telegramActivationService = require('../services/telegramActivationService');
const User = require('../models/User');
const logger = require('../config/logger');
const { authLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// Rate limiter específico para activación
const activationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // máximo 5 intentos por IP
  message: {
    success: false,
    message: 'Demasiados intentos de activación. Inténtalo más tarde.',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Esquemas de validación
const activateTokenSchema = z.object({
  token: z.string().min(32, 'Token inválido').max(128, 'Token inválido'),
  telegramChatId: z.string().optional()
});

const resendActivationSchema = z.object({
  email: z.string().email('Email inválido'),
  telegramChatId: z.string().min(1, 'Chat ID de Telegram requerido')
});

/**
 * POST /api/activation/activate
 * Activa una cuenta usando un token de activación
 */
router.post('/activate', activationLimiter, async (req, res) => {
  try {
    // Validar entrada
    const { token, telegramChatId } = activateTokenSchema.parse(req.body);
    
    logger.info('Activation attempt', {
      token: token.substring(0, 8) + '...',
      telegramChatId,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    // Procesar activación
    const result = await telegramActivationService.activateWithToken(token, telegramChatId);
    
    if (result.success) {
      logger.info('User activated successfully', {
        userId: result.user.userId,
        email: result.user.email,
        method: 'telegram_token'
      });
      
      res.status(200).json({
        success: true,
        message: result.message,
        user: {
          userId: result.user.userId,
          email: result.user.email,
          firstName: result.user.firstName,
          lastName: result.user.lastName,
          isActive: result.user.isActive,
          telegramVerified: result.user.telegramVerified
        }
      });
    } else {
      logger.warn('Activation failed', {
        token: token.substring(0, 8) + '...',
        error: result.error,
        message: result.message
      });
      
      const statusCode = {
        'INVALID_TOKEN': 400,
        'TOKEN_ALREADY_USED': 400,
        'MAX_ATTEMPTS_EXCEEDED': 429,
        'CHAT_ID_MISMATCH': 403,
        'USER_NOT_FOUND': 404,
        'ALREADY_ACTIVE': 409,
        'INTERNAL_ERROR': 500
      }[result.error] || 400;
      
      res.status(statusCode).json({
        success: false,
        message: result.message,
        code: result.error
      });
    }
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Datos de entrada inválidos',
        errors: error.errors.map(e => ({
          field: e.path.join('.'),
          message: e.message
        }))
      });
    }
    
    logger.error('Error in activation endpoint', {
      error: error.message,
      stack: error.stack,
      body: req.body
    });
    
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * POST /api/activation/resend
 * Reenvía el mensaje de activación por Telegram
 */
router.post('/resend', authLimiter, async (req, res) => {
  try {
    // Validar entrada
    const { email, telegramChatId } = resendActivationSchema.parse(req.body);
    
    logger.info('Resend activation request', {
      email,
      telegramChatId,
      ip: req.ip
    });

    // Buscar usuario
    const user = await User.findOne({ email }).select(
      'userId email firstName lastName isActive telegramVerified telegramChatId'
    );
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado',
        code: 'USER_NOT_FOUND'
      });
    }
    
    if (user.isActive) {
      return res.status(409).json({
        success: false,
        message: 'La cuenta ya está activada',
        code: 'ALREADY_ACTIVE'
      });
    }

    // Enviar mensaje de activación
    const sent = await telegramActivationService.sendActivationMessage(
      user.userId,
      telegramChatId,
      {
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        userId: user.userId
      }
    );
    
    if (sent) {
      logger.info('Activation message resent successfully', {
        userId: user.userId,
        email: user.email,
        telegramChatId
      });
      
      res.status(200).json({
        success: true,
        message: 'Mensaje de activación enviado a Telegram',
        data: {
          email: user.email,
          telegramChatId
        }
      });
    } else {
      logger.error('Failed to resend activation message', {
        userId: user.userId,
        email: user.email,
        telegramChatId
      });
      
      res.status(500).json({
        success: false,
        message: 'Error enviando mensaje por Telegram',
        code: 'TELEGRAM_ERROR'
      });
    }
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Datos de entrada inválidos',
        errors: error.errors.map(e => ({
          field: e.path.join('.'),
          message: e.message
        }))
      });
    }
    
    if (error.message === 'RATE_LIMIT_EXCEEDED') {
      return res.status(429).json({
        success: false,
        message: 'Demasiadas solicitudes. Inténtalo más tarde.',
        code: 'RATE_LIMIT_EXCEEDED'
      });
    }
    
    logger.error('Error in resend activation endpoint', {
      error: error.message,
      stack: error.stack,
      body: req.body
    });
    
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * GET /api/activation/stats
 * Obtiene estadísticas de activación (solo para admins)
 */
router.get('/stats', async (req, res) => {
  try {
    // TODO: Agregar middleware de autenticación de admin
    
    const period = req.query.period || 'day';
    
    if (!['day', 'week', 'month'].includes(period)) {
      return res.status(400).json({
        success: false,
        message: 'Período inválido. Use: day, week, month',
        code: 'INVALID_PERIOD'
      });
    }
    
    const stats = await telegramActivationService.getActivationStats(period);
    
    if (!stats) {
      return res.status(500).json({
        success: false,
        message: 'Error obteniendo estadísticas',
        code: 'STATS_ERROR'
      });
    }
    
    res.status(200).json({
      success: true,
      data: stats
    });
    
  } catch (error) {
    logger.error('Error in activation stats endpoint', {
      error: error.message,
      stack: error.stack,
      query: req.query
    });
    
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * POST /api/activation/cleanup
 * Limpia tokens expirados (solo para admins)
 */
router.post('/cleanup', async (req, res) => {
  try {
    // TODO: Agregar middleware de autenticación de admin
    
    const cleanedCount = await telegramActivationService.cleanupExpiredTokens();
    
    logger.info('Activation tokens cleanup completed', {
      cleanedCount,
      requestedBy: req.ip
    });
    
    res.status(200).json({
      success: true,
      message: 'Limpieza de tokens completada',
      data: {
        cleanedCount
      }
    });
    
  } catch (error) {
    logger.error('Error in activation cleanup endpoint', {
      error: error.message,
      stack: error.stack
    });
    
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * GET /api/activation/status/:token
 * Verifica el estado de un token de activación
 */
router.get('/status/:token', activationLimiter, async (req, res) => {
  try {
    const { token } = req.params;
    
    if (!token || token.length < 32) {
      return res.status(400).json({
        success: false,
        message: 'Token inválido',
        code: 'INVALID_TOKEN'
      });
    }
    
    // Verificar si el token existe y obtener información básica
    const Redis = require('ioredis');
    const redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD,
      db: process.env.REDIS_ACTIVATION_DB || 3
    });
    
    const tokenKey = `activation_token:${token}`;
    const tokenDataStr = await redis.get(tokenKey);
    
    if (!tokenDataStr) {
      return res.status(404).json({
        success: false,
        message: 'Token no encontrado o expirado',
        code: 'TOKEN_NOT_FOUND'
      });
    }
    
    const tokenData = JSON.parse(tokenDataStr);
    const ttl = await redis.ttl(tokenKey);
    
    res.status(200).json({
      success: true,
      data: {
        valid: !tokenData.used && ttl > 0,
        used: tokenData.used,
        attempts: tokenData.attempts,
        expiresIn: ttl > 0 ? ttl : 0,
        createdAt: tokenData.createdAt
      }
    });
    
    await redis.disconnect();
    
  } catch (error) {
    logger.error('Error in activation status endpoint', {
      error: error.message,
      token: req.params.token?.substring(0, 8) + '...'
    });
    
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      code: 'INTERNAL_ERROR'
    });
  }
});

module.exports = router;