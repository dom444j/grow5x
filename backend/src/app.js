/**
 * Express Application Setup
 * Main application file that configures Express server with all routes and middleware
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const path = require('path');
require('dotenv').config();

const logger = require('./config/logger');
const connectDB = require('./config/database');
const swaggerUi = require('swagger-ui-express');
const YAML = require('js-yaml');
const fs = require('fs');

// Import routes
const authRoutes = require('./routes/auth');
const packageRoutes = require('./routes/packages');
const paymentRoutes = require('./routes/payments');
const userRoutes = require('./routes/user');
const adminRoutes = require('./routes/admin');
const cronRoutes = require('./routes/cron');
const withdrawalRoutes = require('./routes/withdrawals');
const withdrawalExportRoutes = require('./routes/withdrawalExport');
const webhookRoutes = require('./routes/webhooks');
const userImportRoutes = require('./routes/userImportRoutes');
const iamRoutes = require('./routes/iamRoutes');
const referralRoutes = require('./routes/referral');
const specialParentReportsRoutes = require('./routes/specialParentReports');
const benefitsRoutes = require('./routes/benefits');
const sseRoutes = require('./routes/sse');
const activationRoutes = require('./routes/activation');
const cacheAdminRoutes = require('./routes/admin/cache');
const websocketRoutes = require('./routes/websocket');
const telegramDualRoutes = require('./routes/telegramDual');
const healthRoutes = require('./routes/health');
const { applyV1Rbac } = require('./middleware/v1Rbac');
const { telegramDualMiddleware } = require('./middleware/telegramDualMiddleware');

// Import cache middleware
const { 
  cacheUserData, 
  cacheAdminData, 
  cacheStats, 
  cachePublicData,
  invalidateUserCache,
  invalidateAdminCache
} = require('./middleware/redisCache');

// Create Express app
const app = express();

// Trust proxy for accurate IP addresses
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: false // Manejado en Nginx
}));

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:5173',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:5173',
      ...(process.env.FRONTEND_URL ? process.env.FRONTEND_URL.split(',').map(url => url.trim()) : [])
    ].filter(Boolean);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      logger.warn('CORS blocked request from origin:', { origin });
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['X-Total-Count']
};

app.use(cors(corsOptions));

// Compression middleware
app.use(compression());

// Request logging
app.use(morgan('combined', {
  stream: {
    write: (message) => logger.info(message.trim())
  },
  skip: (req) => {
    // Skip logging for health checks and static files
    return req.url === '/health' || req.url.startsWith('/static');
  }
}));

// Body parsing middleware
app.use(express.json({ 
  limit: '10mb'
  // Comentado temporalmente para resolver problemas de parsing
  // verify: (req, res, buf) => {
  //   try {
  //     JSON.parse(buf);
  //   } catch (e) {
  //     res.status(400).json({
  //       success: false,
  //       message: 'JSON inválido',
  //       code: 'INVALID_JSON'
  //     });
  //     throw new Error('Invalid JSON');
  //   }
  // }
}));

app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Cookie parsing middleware
app.use(cookieParser());

// Apply Telegram dual service middleware globally
app.use(telegramDualMiddleware);

// Global rate limiting
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per windowMs
  message: {
    success: false,
    message: 'Demasiadas solicitudes desde esta IP. Intenta nuevamente más tarde.',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for health checks
    return req.url === '/health';
  }
});

app.use(globalLimiter);

// Request ID middleware for tracking
app.use((req, res, next) => {
  req.requestId = Math.random().toString(36).substring(2, 15);
  res.setHeader('X-Request-ID', req.requestId);
  next();
});

// Request logging middleware
app.use((req, res, next) => {
  logger.info('Incoming request', {
    requestId: req.requestId,
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString()
  });
  next();
});

// Swagger API Documentation
try {
  const swaggerDocument = YAML.load(fs.readFileSync(path.join(__dirname, '../openapi.yaml'), 'utf8'));
  
  // Configure Swagger UI options
  const swaggerOptions = {
    explorer: true,
    swaggerOptions: {
      docExpansion: 'none',
      filter: true,
      showRequestHeaders: true,
      showCommonExtensions: true,
      tryItOutEnabled: true
    },
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Grow5X API Documentation'
  };
  
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument, swaggerOptions));
  
  // API docs redirect
  app.get('/docs', (req, res) => {
    res.redirect('/api/docs');
  });
  
  logger.info('Swagger UI configured at /api/docs');
} catch (error) {
  logger.warn('Could not load OpenAPI documentation:', error.message);
}

// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    // Check database connection
    const mongoose = require('mongoose');
    const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
    
    // Check Redis connection
    const { client: redisClient } = require('./config/redis');
    let redisStatus = 'disconnected';
    try {
      if (redisClient && typeof redisClient.ping === 'function') {
        await redisClient.ping();
        redisStatus = 'connected';
      } else if (process.env.NODE_ENV === 'development' && !process.env.REDIS_URL) {
        redisStatus = 'mock';
      }
    } catch (redisError) {
      logger.warn('Redis health check failed:', redisError.message);
      redisStatus = 'error';
    }
    
    const overallStatus = dbStatus === 'connected' && (redisStatus === 'connected' || redisStatus === 'mock') ? 'ok' : 'degraded';
    
    res.json({
      success: true,
      status: overallStatus,
      message: 'Server is healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      version: require('../package.json').version || '1.0.0',
      database: {
        status: dbStatus,
        name: 'MongoDB'
      },
      redis: {
        status: redisStatus,
        namespace: process.env.REDIS_NAMESPACE || 'grow5x'
      }
    });
  } catch (error) {
    logger.error('Health check error:', error);
    res.status(503).json({
      success: false,
      status: 'error',
      message: 'Service unavailable',
      timestamp: new Date().toISOString()
    });
  }
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/activation', activationRoutes);
app.use('/api/health', healthRoutes);
app.use('/api/packages', cachePublicData(3600), packageRoutes); // Cache packages for 1 hour
app.use('/api/payments', paymentRoutes);
app.use('/api/me', cacheUserData(900), userRoutes); // Cache user data for 15 minutes
app.use('/api/user/benefits', cacheUserData(300), benefitsRoutes); // Cache benefits for 5 minutes
app.use('/api/sse', sseRoutes);
app.use('/api/special-parent', cacheAdminData(600), specialParentReportsRoutes); // Cache reports for 10 minutes
// Mount specific admin routes before general admin routes
app.use('/api/admin/withdrawals', withdrawalRoutes);
app.use('/api/admin/withdrawals', withdrawalExportRoutes);
app.use('/api/admin/cache', cacheAdminRoutes);
app.use('/api/websocket', websocketRoutes);
app.use('/api/admin/telegram-dual', telegramDualRoutes);
app.use('/api/admin', cacheAdminData(300), adminRoutes); // Cache admin data for 5 minutes
app.use('/api/cron', cronRoutes);
app.use('/api/webhooks', webhookRoutes);

// Referral routes (both redirect and API)
app.use('/', referralRoutes);

// V1 API Routes with RBAC
app.use('/api/v1/users-import', userImportRoutes);
app.use('/api/v1/iam', iamRoutes);
app.use('/api/v1/cohorts', require('./routes/cohortRoutes'));

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  const staticPath = path.join(__dirname, '../../../frontend/dist');
  app.use(express.static(staticPath));
  
  // Serve React app for all non-API routes
  app.get('*', (req, res) => {
    res.sendFile(path.join(staticPath, 'index.html'));
  });
}

// 404 handler for API routes
app.use('/api/*', (req, res) => {
  logger.warn('API route not found', {
    requestId: req.requestId,
    method: req.method,
    url: req.url,
    ip: req.ip
  });
  
  res.status(404).json({
    success: false,
    message: 'Endpoint no encontrado',
    code: 'ENDPOINT_NOT_FOUND',
    requestId: req.requestId
  });
});

// Global error handler
app.use((error, req, res, next) => {
  // Skip if response already sent
  if (res.headersSent) {
    return next(error);
  }
  
  logger.error('Unhandled error', {
    requestId: req.requestId,
    error: error.message,
    stack: error.stack,
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: req.user?.userId
  });
  
  // Handle specific error types
  let statusCode = 500;
  let message = 'Error interno del servidor';
  let code = 'INTERNAL_ERROR';
  
  // MongoDB validation errors
  if (error.name === 'ValidationError') {
    statusCode = 400;
    const field = Object.keys(error.errors)[0];
    message = error.errors[field]?.message || 'Error de validación';
    code = 'VALIDATION_ERROR';
  }
  
  // MongoDB cast errors (invalid ObjectId)
  else if (error.name === 'CastError') {
    statusCode = 400;
    message = 'Formato de ID inválido';
    code = 'INVALID_ID_FORMAT';
  }
  
  // MongoDB duplicate key errors
  else if (error.code === 11000) {
    statusCode = 409;
    const field = Object.keys(error.keyPattern || {})[0] || 'campo';
    message = `El ${field} ya existe`;
    code = 'DUPLICATE_KEY';
  }
  
  // JWT errors
  else if (error.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Token inválido';
    code = 'INVALID_TOKEN';
  }
  
  else if (error.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expirado';
    code = 'TOKEN_EXPIRED';
  }
  
  // Zod validation errors
  else if (error.name === 'ZodError') {
    statusCode = 400;
    const firstError = error.errors[0];
    message = firstError?.message || 'Error de validación';
    code = 'VALIDATION_ERROR';
  }
  
  // Custom errors with status
  else if (error.status || error.statusCode) {
    statusCode = error.status || error.statusCode;
    message = error.message || message;
    code = error.code || code;
  }
  
  // Don't leak error details in production
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  res.status(statusCode).json({
    success: false,
    message: isDevelopment ? (error.message || message) : message,
    code,
    requestId: req.requestId,
    timestamp: new Date().toISOString(),
    ...(isDevelopment && { stack: error.stack })
  });
});

// Graceful shutdown handling
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', {
    error: error.message,
    stack: error.stack
  });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection:', {
    reason: reason,
    promise: promise
  });
  process.exit(1);
});

// Connect to database
connectDB();

module.exports = app;