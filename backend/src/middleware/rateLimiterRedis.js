const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const Redis = require('ioredis');
const logger = require('../config/logger');
const { ipKeyGenerator } = require('express-rate-limit');

// Redis client for rate limiting
const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD,
  db: process.env.REDIS_RATE_LIMIT_DB || 1,
  retryDelayOnFailover: 100,
  enableReadyCheck: true,
  maxRetriesPerRequest: 3,
  lazyConnect: true
});

// Redis store for rate limiting (faster than MongoDB)
const redisStore = new RedisStore({
  sendCommand: (...args) => redis.call(...args),
  prefix: 'rl:',
});

/**
 * Enhanced rate limiter for authentication endpoints
 * Stricter limits with Redis for better performance
 */
const authLimiter = rateLimit({
  store: redisStore,
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: {
    error: 'RATE_LIMIT_EXCEEDED',
    message: 'Demasiados intentos de autenticación. Intente nuevamente en 15 minutos.',
    retryAfter: 15 * 60
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Use IP + email for more granular limiting
    const email = req.body?.email || 'unknown';
    const ip = ipKeyGenerator(req);
    return `auth:${ip}:${email}`;
  },
  handler: (req, res, next, options) => {
    logger.warn('Auth rate limit exceeded', {
      ip: req.ip,
      email: req.body?.email,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString()
    });
    res.status(options.statusCode).json(options.message);
  },
  skip: (req) => {
    // Skip in development
    return process.env.NODE_ENV === 'development';
  }
});

/**
 * Enhanced rate limiter for login endpoints
 * More aggressive limiting for login attempts
 */
const loginLimiter = rateLimit({
  store: redisStore,
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3, // Only 3 login attempts per window
  message: {
    error: 'LOGIN_RATE_LIMIT_EXCEEDED',
    message: 'Demasiados intentos de inicio de sesión. Intente nuevamente en 15 minutos.',
    retryAfter: 15 * 60
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const email = req.body?.email || 'unknown';
    const ip = ipKeyGenerator(req);
    return `login:${ip}:${email}`;
  },
  handler: (req, res, next, options) => {
    logger.warn('Login rate limit exceeded', {
      ip: req.ip,
      email: req.body?.email,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString()
    });
    res.status(options.statusCode).json(options.message);
  }
});

/**
 * Enhanced rate limiter for withdrawal endpoints
 * Stricter limits with Redis for financial operations
 */
const withdrawalLimiter = rateLimit({
  store: redisStore,
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Only 3 withdrawal requests per hour
  message: {
    error: 'WITHDRAWAL_RATE_LIMIT_EXCEEDED',
    message: 'Demasiadas solicitudes de retiro. Intente nuevamente en 1 hora.',
    retryAfter: 60 * 60
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const userId = req.user?.userId || req.user?._id || 'anonymous';
    const ip = ipKeyGenerator(req);
    return `withdrawal:${ip}:${userId}`;
  },
  handler: (req, res, next, options) => {
    logger.warn('Withdrawal rate limit exceeded', {
      ip: req.ip,
      userId: req.user?.userId || req.user?._id,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString()
    });
    res.status(options.statusCode).json(options.message);
  }
});

/**
 * Enhanced rate limiter for OTP requests
 * Prevent OTP spam attacks
 */
const otpLimiter = rateLimit({
  store: redisStore,
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 3, // Only 3 OTP requests per 5 minutes
  message: {
    error: 'OTP_RATE_LIMIT_EXCEEDED',
    message: 'Demasiadas solicitudes de código OTP. Intente nuevamente en 5 minutos.',
    retryAfter: 5 * 60
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const userId = req.user?.userId || req.user?._id || 'anonymous';
    const ip = ipKeyGenerator(req);
    return `otp:${ip}:${userId}`;
  },
  handler: (req, res, next, options) => {
    logger.warn('OTP rate limit exceeded', {
      ip: req.ip,
      userId: req.user?.userId || req.user?._id,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString()
    });
    res.status(options.statusCode).json(options.message);
  }
});

/**
 * Enhanced general API rate limiter
 * Broad protection with Redis performance
 */
const generalLimiter = rateLimit({
  store: redisStore,
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  message: {
    error: 'RATE_LIMIT_EXCEEDED',
    message: 'Demasiadas solicitudes. Intente nuevamente en 1 minuto.',
    retryAfter: 60
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const ip = ipKeyGenerator(req);
    const userId = req.user?.userId || req.user?._id || 'anonymous';
    return `general:${ip}:${userId}`;
  },
  skip: (req) => {
    // Skip rate limiting for health checks and static assets
    return req.path === '/api/admin/health' || 
           req.path.startsWith('/static/') ||
           process.env.NODE_ENV === 'development';
  },
  handler: (req, res, next, options) => {
    logger.warn('General rate limit exceeded', {
      ip: req.ip,
      userId: req.user?.userId || req.user?._id,
      path: req.path,
      method: req.method,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString()
    });
    res.status(options.statusCode).json(options.message);
  }
});

/**
 * Enhanced admin rate limiter
 * Higher limits for admin operations
 */
const adminLimiter = rateLimit({
  store: redisStore,
  windowMs: 60 * 1000, // 1 minute
  max: 500, // 500 admin actions per minute
  message: {
    error: 'ADMIN_RATE_LIMIT_EXCEEDED',
    message: 'Demasiadas solicitudes de administrador. Intente nuevamente en 1 minuto.',
    retryAfter: 60
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const userId = req.user?.userId || req.user?._id || 'anonymous';
    const ip = ipKeyGenerator(req);
    return `admin:${ip}:${userId}`;
  },
  handler: (req, res, next, options) => {
    logger.warn('Admin rate limit exceeded', {
      ip: req.ip,
      userId: req.user?.userId || req.user?._id,
      method: req.method,
      path: req.path,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString()
    });
    res.status(options.statusCode).json(options.message);
  }
});

/**
 * Rate limiter for payment endpoints
 * Moderate limits for financial operations
 */
const paymentLimiter = rateLimit({
  store: redisStore,
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 5, // 5 payment actions per window
  message: {
    error: 'PAYMENT_RATE_LIMIT_EXCEEDED',
    message: 'Demasiadas solicitudes de pago. Intente nuevamente en 10 minutos.',
    retryAfter: 10 * 60
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const userId = req.user?.userId || req.user?._id || 'anonymous';
    const ip = ipKeyGenerator(req);
    return `payment:${ip}:${userId}`;
  },
  handler: (req, res, next, options) => {
    logger.warn('Payment rate limit exceeded', {
      ip: req.ip,
      userId: req.user?.userId || req.user?._id,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString()
    });
    res.status(options.statusCode).json(options.message);
  }
});

// Redis connection event handlers
redis.on('connect', () => {
  logger.info('Redis connected for rate limiting');
});

redis.on('error', (err) => {
  logger.error('Redis connection error for rate limiting', { error: err.message });
});

redis.on('close', () => {
  logger.warn('Redis connection closed for rate limiting');
});

module.exports = {
  authLimiter,
  loginLimiter,
  withdrawalLimiter,
  otpLimiter,
  generalLimiter,
  adminLimiter,
  paymentLimiter,
  redis
};