/**
 * Server Entry Point
 * Starts the Express server and handles server lifecycle
 * Updated to fix session expiration issue - restart
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const pino = require('pino');
const database = require('./config/database');
const cron = require('node-cron');
const cronManager = require('./cron');
const OutboxProcessor = require('./services/outboxProcessor');
const { purchaseConfirmationWorker } = require('./workers/purchaseConfirmationWorker');
const commissionUnlockWorker = require('./workers/commissionUnlockWorker');

// Import routes
const authRoutes = require('./routes/auth');
const packageRoutes = require('./routes/packages');
const paymentRoutes = require('./routes/payments');
const adminRoutes = require('./routes/admin');
const userRoutes = require('./routes/user');
const publicRoutes = require('./routes/public');
const referralRoutes = require('./routes/referral');
const withdrawalRoutes = require('./routes/withdrawals');
const withdrawalExportRoutes = require('./routes/withdrawalExport');
const checkoutRoutes = require('./routes/checkout');
const iamRoutes = require('./routes/iamRoutes');
const realtimeRoutes = require('./routes/realtime');
const healthRoutes = require('./routes/health');
const websocketConfig = require('./config/websocket');

// Logger setup
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV === 'development' ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard'
    }
  } : undefined
});

class Server {
  constructor() {
    this.app = express();
    this.port = process.env.PORT || 5000;
    this.setupMiddleware();
    this.setupRoutes();
    this.setupCronJobs();
    this.setupErrorHandling();
  }

  setupMiddleware() {
    // Security middleware
    this.app.use(helmet());
    
    // CORS configuration
    this.app.use(cors({
      origin: process.env.ALLOWED_ORIGIN || 'http://localhost:3000',
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
      allowedHeaders: ['Content-Type', 'Authorization']
    }));

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Request logging
    this.app.use((req, res, next) => {
      logger.info({
        method: req.method,
        url: req.url,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      }, 'Incoming request');
      next();
    });

    // Latency monitoring middleware
    this.app.use((req, res, next) => {
      const startTime = process.hrtime.bigint();
      
      res.on('finish', () => {
        const endTime = process.hrtime.bigint();
        const latencyMs = Number(endTime - startTime) / 1e6;
        
        // Log requests that take longer than 1 second or have errors
        if (latencyMs > 1000 || res.statusCode >= 400) {
          logger.warn({
            method: req.method,
            url: req.originalUrl,
            statusCode: res.statusCode,
            latencyMs: latencyMs.toFixed(1),
            ip: req.ip
          }, `[${res.statusCode}] ${req.method} ${req.originalUrl} - ${latencyMs.toFixed(1)}ms`);
        } else {
          logger.info({
            method: req.method,
            url: req.originalUrl,
            statusCode: res.statusCode,
            latencyMs: latencyMs.toFixed(1)
          }, `[${res.statusCode}] ${req.method} ${req.originalUrl} - ${latencyMs.toFixed(1)}ms`);
        }
      });
      
      next();
    });
  }

  setupRoutes() {
    // Health check
    this.app.get('/api/health', (req, res) => {
      const dbStatus = database.getStatus();
      res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV,
        database: dbStatus,
        version: '1.0.0'
      });
    });

    // API routes
    this.app.use('/api/auth', authRoutes);
    this.app.use('/api/packages', packageRoutes);
    this.app.use('/api/payments', paymentRoutes);
    // Mount specific admin routes before general admin routes
    this.app.use('/api/admin/withdrawals', withdrawalRoutes);
    this.app.use('/api/admin/withdrawals', withdrawalExportRoutes);
    this.app.use('/api/admin', adminRoutes);
    this.app.use('/api/me', userRoutes);
    this.app.use('/api/public', publicRoutes);
    this.app.use('/api/v1/iam', iamRoutes);
    this.app.use('/api/rt', realtimeRoutes);
    this.app.use('/api/health', healthRoutes);

    // Checkout routes (new unified endpoint)
    this.app.use('/api/checkout', checkoutRoutes);

    // ALIASES para rutas legacy (absorber rutas viejas)
    const { authenticateToken } = require('./middleware/auth');
    
    this.app.post('/api/me/purchases', authenticateToken, (req, res) => {
      res.redirect(307, '/api/checkout/start');
    });

    this.app.post('/api/payments/submit', authenticateToken, (req, res) => {
      res.redirect(307, '/api/checkout/start');
    });

    // Removed incorrect redirect for /api/me/purchases - let it reach userRoutes

    this.app.post('/api/me/purchases/:orderId/confirm', authenticateToken, (req, res) => {
      res.redirect(307, `/api/checkout/${req.params.orderId}/confirm`);
    });

    this.app.post('/api/payments/confirm-hash', authenticateToken, (req, res) => {
      // Transform legacy body format
      const orderId = req.body.purchaseId;
      const txHash = req.body.transactionHash;
      if (!orderId || !txHash) {
        return res.status(400).json({ error: 'BAD_REQUEST', message: 'purchaseId and transactionHash required' });
      }
      res.redirect(307, `/api/checkout/${orderId}/confirm`);
    });

    this.app.get('/api/payments/*', (req, res) => {
      res.status(410).json({ error: 'DEPRECATED', message: 'Use /api/checkout/* endpoints instead' });
    });

    // Removed alias for user overview endpoint - handled by userRoutes directly

    // Referral routes (must be before 404 handler)
    this.app.use('/', referralRoutes);

    // CATCH 404 estructurado (debug radical)
    this.app.use('/api', (req, res) => {
      res.status(404).json({ 
        error: 'NOT_FOUND', 
        pathTried: req.originalUrl, 
        method: req.method 
      });
    });

    // 404 handler general
    this.app.use('*', (req, res) => {
      res.status(404).json({
        error: 'Route not found',
        path: req.originalUrl
      });
    });
  }

  setupCronJobs() {
    // CRON jobs will be initialized after server starts
    // See cronManager.initializeCronJobs() in start() method
    logger.info('CRON jobs setup deferred to post-startup initialization');
  }

  setupErrorHandling() {
    // Global error handler (improved for debugging)
    this.app.use((error, req, res, next) => {
      const status = error.status || 500;
      
      logger.error({
        error: error.message,
        stack: error.stack,
        url: req.url,
        method: req.method,
        body: req.body,
        userId: req.userId,
        name: error.name,
        code: error.code
      }, 'Unhandled error');

      res.status(status).json({
        error: status === 500 ? 'SERVER_ERROR' : 'ERROR',
        message: process.env.NODE_ENV === 'production' && status === 500
          ? 'Internal server error' 
          : error.message,
        ...(process.env.NODE_ENV !== 'production' && { 
          stack: error.stack,
          name: error.name,
          code: error.code
        })
      });
    });

    // Graceful shutdown
    process.on('SIGTERM', () => this.shutdown('SIGTERM'));
    process.on('SIGINT', () => this.shutdown('SIGINT'));
  }

  async start() {
    try {
      // Connect to database
      await database.connect();
      
      // Run integrity checks before starting server
      // const { runIntegrityChecks } = require('./utils/integrity-checks');
      // await runIntegrityChecks();
      
      // Start server
      this.server = this.app.listen(this.port, () => {
        logger.info(`🚀 Server running on port ${this.port}`);
        logger.info(`📍 Environment: ${process.env.NODE_ENV}`);
        logger.info(`🔗 CORS origin: ${process.env.FRONTEND_URL}`);
        
        // Initialize WebSocket server
        try {
          this.websocketServices = websocketConfig.initializeWebSocket(this.server, this.app);
          logger.info('🔌 WebSocket server initialized successfully');
        } catch (error) {
          logger.error('Failed to initialize WebSocket server:', {
            error: error.message,
            stack: error.stack
          });
        }
        
        // Initialize CRON jobs after server starts
        try {
          cronManager.initializeCronJobs();
          logger.info('CRON jobs initialized successfully');
        } catch (error) {
          logger.error('Failed to initialize CRON jobs:', {
            error: error.message,
            stack: error.stack
          });
        }

        // Initialize Outbox Processor
        try {
          this.outboxProcessor = new OutboxProcessor();
          this.outboxProcessor.start();
          logger.info('Outbox processor started successfully');
        } catch (error) {
          logger.error('Failed to start outbox processor:', {
            error: error.message,
            stack: error.stack
          });
        }

        // Initialize Purchase Confirmation Worker
        try {
          purchaseConfirmationWorker.start(30000); // 30 segundos
          logger.info('Purchase confirmation worker started successfully');
        } catch (error) {
          logger.error('Failed to start purchase confirmation worker:', {
            error: error.message,
            stack: error.stack
          });
        }

        // Initialize Commission Unlock Worker
        try {
          commissionUnlockWorker.start(60000); // 1 minuto
          logger.info('Commission unlock worker started successfully');
        } catch (error) {
          logger.error('Failed to start commission unlock worker:', {
            error: error.message,
            stack: error.stack
          });
        }
      });
    } catch (error) {
      logger.error('Failed to start server:', error);
      process.exit(1);
    }
  }

  async shutdown(signal) {
    logger.info(`Received ${signal}, shutting down gracefully`);
    
    // Stop Purchase Confirmation Worker first
    try {
      purchaseConfirmationWorker.stop();
      logger.info('Purchase confirmation worker stopped');
    } catch (error) {
      logger.error('Error stopping purchase confirmation worker:', {
        error: error.message
      });
    }
    
    // Stop Commission Unlock Worker
    try {
      commissionUnlockWorker.stop();
      logger.info('Commission unlock worker stopped');
    } catch (error) {
      logger.error('Error stopping commission unlock worker:', {
        error: error.message
      });
    }
    
    // Stop Outbox Processor
    try {
      if (this.outboxProcessor) {
        this.outboxProcessor.stop();
        logger.info('Outbox processor stopped');
      }
    } catch (error) {
      logger.error('Error stopping outbox processor:', {
        error: error.message
      });
    }
    
    // Stop WebSocket services
    try {
      websocketConfig.shutdownWebSocket();
      logger.info('WebSocket services stopped');
    } catch (error) {
      logger.error('Error stopping WebSocket services:', {
        error: error.message
      });
    }
    
    // Stop CRON jobs
    try {
      cronManager.stopAllCronJobs();
      logger.info('CRON jobs stopped');
    } catch (error) {
      logger.error('Error stopping CRON jobs:', {
        error: error.message
      });
    }
    
    if (this.server) {
      this.server.close(async () => {
        logger.info('HTTP server closed');
        await database.disconnect();
        process.exit(0);
      });
    }
  }
}

// Start server if this file is run directly
if (require.main === module) {
  const server = new Server();
  server.start();
}

module.exports = Server;