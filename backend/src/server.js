/**
 * Server Entry Point
 * Starts the Express server and handles server lifecycle
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const pino = require('pino');
const database = require('./config/database');
const cron = require('node-cron');
const cronManager = require('./cron');

// Import processors
const { processDailyBenefits } = require('./processors/daily-benefits.cron');
const { unlockCommissions } = require('./processors/unlock-commissions.cron');

// Import routes
const authRoutes = require('./routes/auth');
const packageRoutes = require('./routes/packages');
const paymentRoutes = require('./routes/payments');
const adminRoutes = require('./routes/admin');
const userRoutes = require('./routes/user');

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
    this.app.use('/api/admin', adminRoutes);
    this.app.use('/api/me', userRoutes);

    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({
        error: 'Route not found',
        path: req.originalUrl
      });
    });
  }

  setupCronJobs() {
    if (process.env.ENABLE_BENEFITS_RELEASE === 'true') {
      // Daily benefits at 03:00 UTC
      cron.schedule('0 3 * * *', async () => {
        logger.info('Starting daily benefits processing');
        try {
          await processDailyBenefits();
          logger.info('Daily benefits processing completed');
        } catch (error) {
          logger.error('Daily benefits processing failed:', error);
        }
      }, {
        timezone: 'UTC'
      });
    }

    if (process.env.ENABLE_COMMISSIONS_RELEASE === 'true') {
      // Unlock commissions at 03:30 UTC
      cron.schedule('30 3 * * *', async () => {
        logger.info('Starting commission unlock processing');
        try {
          await unlockCommissions();
          logger.info('Commission unlock processing completed');
        } catch (error) {
          logger.error('Commission unlock processing failed:', error);
        }
      }, {
        timezone: 'UTC'
      });
    }
  }

  setupErrorHandling() {
    // Global error handler
    this.app.use((error, req, res, next) => {
      logger.error({
        error: error.message,
        stack: error.stack,
        url: req.url,
        method: req.method
      }, 'Unhandled error');

      res.status(error.status || 500).json({
        error: process.env.NODE_ENV === 'production' 
          ? 'Internal server error' 
          : error.message,
        ...(process.env.NODE_ENV !== 'production' && { stack: error.stack })
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
      const { runIntegrityChecks } = require('./utils/integrity-checks');
      await runIntegrityChecks();
      
      // Start server
      this.server = this.app.listen(this.port, () => {
        logger.info(`🚀 Server running on port ${this.port}`);
        logger.info(`📍 Environment: ${process.env.NODE_ENV}`);
        logger.info(`🔗 CORS origin: ${process.env.ALLOWED_ORIGIN}`);
        
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
      });
    } catch (error) {
      logger.error('Failed to start server:', error);
      process.exit(1);
    }
  }

  async shutdown(signal) {
    logger.info(`Received ${signal}, shutting down gracefully`);
    
    // Stop CRON jobs first
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