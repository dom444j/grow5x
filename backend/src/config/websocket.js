/**
 * WebSocket Configuration
 * Configures WebSocket server integration with Express app
 */

const websocketMiddleware = require('../middleware/websocketMiddleware');
const realtimeSyncService = require('../services/realtimeSyncService');
const logger = require('./logger');

/**
 * Initialize WebSocket server with Express app
 * @param {Object} server - HTTP server instance
 * @param {Object} app - Express app instance
 */
function initializeWebSocket(server, app) {
  try {
    // Initialize WebSocket middleware
    websocketMiddleware.initialize(server, {
      port: process.env.WS_PORT || 8080,
      path: '/ws',
      clientTracking: true,
      maxPayload: 16 * 1024, // 16KB
      perMessageDeflate: {
        zlibDeflateOptions: {
          level: 3
        }
      }
    });

    // Initialize realtime sync service
    realtimeSyncService.initialize();

    // Add WebSocket stats endpoint
    app.get('/api/admin/websocket/stats', (req, res) => {
      try {
        const stats = websocketMiddleware.getStats();
        const syncStats = realtimeSyncService.getConnectionStats();
        
        res.json({
          success: true,
          data: {
            websocket: stats,
            realtimeSync: syncStats,
            timestamp: new Date().toISOString()
          }
        });
      } catch (error) {
        logger.error('Error getting WebSocket stats:', error);
        res.status(500).json({
          success: false,
          message: 'Error retrieving WebSocket statistics'
        });
      }
    });

    // Health check endpoint for WebSocket
    app.get('/api/websocket/health', (req, res) => {
      try {
        const stats = websocketMiddleware.getStats();
        const isHealthy = stats.totalConnections >= 0; // Basic health check
        
        res.status(isHealthy ? 200 : 503).json({
          success: isHealthy,
          status: isHealthy ? 'healthy' : 'unhealthy',
          connections: stats.totalConnections,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        logger.error('WebSocket health check error:', error);
        res.status(503).json({
          success: false,
          status: 'unhealthy',
          error: 'Health check failed'
        });
      }
    });

    logger.info('WebSocket server initialized successfully');
    
    return {
      websocketMiddleware,
      realtimeSyncService
    };
    
  } catch (error) {
    logger.error('Failed to initialize WebSocket server:', error);
    throw error;
  }
}

/**
 * Graceful shutdown of WebSocket services
 */
function shutdownWebSocket() {
  try {
    logger.info('Shutting down WebSocket services...');
    
    // Shutdown WebSocket middleware
    if (websocketMiddleware) {
      websocketMiddleware.shutdown();
    }
    
    // Shutdown realtime sync service
    if (realtimeSyncService) {
      realtimeSyncService.shutdown();
    }
    
    logger.info('WebSocket services shut down successfully');
  } catch (error) {
    logger.error('Error during WebSocket shutdown:', error);
  }
}

/**
 * Get WebSocket connection statistics
 * @returns {Object} Connection statistics
 */
function getWebSocketStats() {
  try {
    const wsStats = websocketMiddleware.getStats();
    const syncStats = realtimeSyncService.getConnectionStats();
    
    return {
      websocket: wsStats,
      realtimeSync: syncStats,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    logger.error('Error getting WebSocket stats:', error);
    return {
      error: 'Failed to retrieve statistics',
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Send real-time update to specific user
 * @param {string} userId - User identifier
 * @param {Object} data - Data to send
 */
function sendUserUpdate(userId, data) {
  try {
    realtimeSyncService.emitUserUpdate(userId, data);
  } catch (error) {
    logger.error('Error sending user update:', error);
  }
}

/**
 * Send real-time update to all admin users
 * @param {Object} data - Data to send
 */
function sendAdminUpdate(data) {
  try {
    realtimeSyncService.emitAdminUpdate(data);
  } catch (error) {
    logger.error('Error sending admin update:', error);
  }
}

/**
 * Broadcast system notification to all connected users
 * @param {Object} data - Notification data
 */
function broadcastSystemNotification(data) {
  try {
    realtimeSyncService.emitSystemNotification(data);
  } catch (error) {
    logger.error('Error broadcasting system notification:', error);
  }
}

module.exports = {
  initializeWebSocket,
  shutdownWebSocket,
  getWebSocketStats,
  sendUserUpdate,
  sendAdminUpdate,
  broadcastSystemNotification
};