/**
 * WebSocket Middleware for Real-time Communication
 * Handles WebSocket connections, authentication, and message routing
 * Integrates with realtimeSyncService for state synchronization
 */

const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const realtimeSyncService = require('../services/realtimeSyncService');
const User = require('../models/User');

class WebSocketMiddleware {
  constructor() {
    this.wss = null;
    this.connections = new Map(); // connectionId -> { ws, userId, role, lastPing }
    this.heartbeatInterval = null;
    this.cleanupInterval = null;
  }

  /**
   * Initialize WebSocket server
   * @param {Object} server - HTTP server instance
   * @param {Object} options - WebSocket server options
   */
  initialize(server, options = {}) {
    const defaultOptions = {
      port: process.env.WS_PORT || 8080,
      path: '/ws',
      clientTracking: true,
      maxPayload: 16 * 1024, // 16KB
      ...options
    };

    this.wss = new WebSocket.Server({
      server,
      ...defaultOptions
    });

    this.setupEventHandlers();
    this.startHeartbeat();
    this.startCleanup();

    console.log(`WebSocket server initialized on port ${defaultOptions.port}`);
  }

  /**
   * Setup WebSocket event handlers
   */
  setupEventHandlers() {
    this.wss.on('connection', (ws, request) => {
      this.handleConnection(ws, request);
    });

    this.wss.on('error', (error) => {
      console.error('WebSocket server error:', error);
    });

    // Listen to realtime sync service events
    realtimeSyncService.on('user:update', (data) => {
      this.sendToUser(data.userId, {
        type: 'USER_UPDATE',
        data: data.payload
      });
    });

    realtimeSyncService.on('admin:update', (data) => {
      this.sendToAdmins({
        type: 'ADMIN_UPDATE',
        data: data.payload
      });
    });

    realtimeSyncService.on('system:notification', (data) => {
      this.broadcast({
        type: 'SYSTEM_NOTIFICATION',
        data: data.payload
      });
    });
  }

  /**
   * Handle new WebSocket connection
   * @param {WebSocket} ws - WebSocket connection
   * @param {Object} request - HTTP request object
   */
  async handleConnection(ws, request) {
    const connectionId = this.generateConnectionId();
    
    try {
      // Extract token from query parameters or headers
      const token = this.extractToken(request);
      
      if (!token) {
        ws.close(1008, 'Authentication required');
        return;
      }

      // Verify JWT token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.userId).select('role');
      
      if (!user) {
        ws.close(1008, 'Invalid user');
        return;
      }

      // Store connection info
      this.connections.set(connectionId, {
        ws,
        userId: decoded.userId,
        role: user.role,
        lastPing: Date.now(),
        connectedAt: new Date()
      });

      // Register with realtime sync service
      if (user.role === 'admin') {
        realtimeSyncService.registerAdminConnection(connectionId, ws);
      } else {
        realtimeSyncService.registerUserConnection(decoded.userId, connectionId, ws);
      }

      // Setup connection event handlers
      this.setupConnectionHandlers(ws, connectionId, decoded.userId, user.role);

      // Send connection confirmation
      this.sendMessage(ws, {
        type: 'CONNECTION_ESTABLISHED',
        data: {
          connectionId,
          userId: decoded.userId,
          role: user.role,
          timestamp: new Date().toISOString()
        }
      });

      console.log(`WebSocket connection established: ${connectionId} (User: ${decoded.userId}, Role: ${user.role})`);

    } catch (error) {
      console.error('WebSocket connection error:', error);
      ws.close(1008, 'Authentication failed');
    }
  }

  /**
   * Setup handlers for a specific connection
   * @param {WebSocket} ws - WebSocket connection
   * @param {string} connectionId - Connection identifier
   * @param {string} userId - User identifier
   * @param {string} role - User role
   */
  setupConnectionHandlers(ws, connectionId, userId, role) {
    ws.on('message', (data) => {
      this.handleMessage(ws, connectionId, userId, role, data);
    });

    ws.on('pong', () => {
      const connection = this.connections.get(connectionId);
      if (connection) {
        connection.lastPing = Date.now();
      }
    });

    ws.on('close', (code, reason) => {
      this.handleDisconnection(connectionId, userId, role, code, reason);
    });

    ws.on('error', (error) => {
      console.error(`WebSocket error for connection ${connectionId}:`, error);
      this.handleDisconnection(connectionId, userId, role, 1006, 'Connection error');
    });
  }

  /**
   * Handle incoming WebSocket messages
   * @param {WebSocket} ws - WebSocket connection
   * @param {string} connectionId - Connection identifier
   * @param {string} userId - User identifier
   * @param {string} role - User role
   * @param {Buffer} data - Message data
   */
  handleMessage(ws, connectionId, userId, role, data) {
    try {
      const message = JSON.parse(data.toString());
      
      switch (message.type) {
        case 'PING':
          this.sendMessage(ws, { type: 'PONG', timestamp: new Date().toISOString() });
          break;
          
        case 'SUBSCRIBE':
          this.handleSubscription(connectionId, userId, role, message.data);
          break;
          
        case 'UNSUBSCRIBE':
          this.handleUnsubscription(connectionId, userId, role, message.data);
          break;
          
        case 'REQUEST_STATE':
          this.handleStateRequest(ws, userId, role, message.data);
          break;
          
        default:
          console.warn(`Unknown message type: ${message.type}`);
      }
    } catch (error) {
      console.error('Error handling WebSocket message:', error);
      this.sendMessage(ws, {
        type: 'ERROR',
        data: { message: 'Invalid message format' }
      });
    }
  }

  /**
   * Handle connection disconnection
   * @param {string} connectionId - Connection identifier
   * @param {string} userId - User identifier
   * @param {string} role - User role
   * @param {number} code - Close code
   * @param {string} reason - Close reason
   */
  handleDisconnection(connectionId, userId, role, code, reason) {
    // Unregister from realtime sync service
    if (role === 'admin') {
      realtimeSyncService.unregisterAdminConnection(connectionId);
    } else {
      realtimeSyncService.unregisterUserConnection(userId, connectionId);
    }

    // Remove from connections map
    this.connections.delete(connectionId);

    console.log(`WebSocket disconnected: ${connectionId} (User: ${userId}, Code: ${code}, Reason: ${reason})`);
  }

  /**
   * Handle subscription requests
   * @param {string} connectionId - Connection identifier
   * @param {string} userId - User identifier
   * @param {string} role - User role
   * @param {Object} subscriptionData - Subscription details
   */
  handleSubscription(connectionId, userId, role, subscriptionData) {
    // Implementation for specific subscriptions
    // This can be extended based on specific requirements
    console.log(`Subscription request from ${connectionId}:`, subscriptionData);
  }

  /**
   * Handle unsubscription requests
   * @param {string} connectionId - Connection identifier
   * @param {string} userId - User identifier
   * @param {string} role - User role
   * @param {Object} unsubscriptionData - Unsubscription details
   */
  handleUnsubscription(connectionId, userId, role, unsubscriptionData) {
    // Implementation for specific unsubscriptions
    console.log(`Unsubscription request from ${connectionId}:`, unsubscriptionData);
  }

  /**
   * Handle state request from client
   * @param {WebSocket} ws - WebSocket connection
   * @param {string} userId - User identifier
   * @param {string} role - User role
   * @param {Object} requestData - State request details
   */
  async handleStateRequest(ws, userId, role, requestData) {
    try {
      // This would trigger a state refresh and send updated data
      if (role === 'admin') {
        realtimeSyncService.emit('admin:refresh:requested', { userId, requestData });
      } else {
        realtimeSyncService.emit('user:refresh:requested', { userId, requestData });
      }
    } catch (error) {
      console.error('Error handling state request:', error);
      this.sendMessage(ws, {
        type: 'ERROR',
        data: { message: 'Failed to process state request' }
      });
    }
  }

  /**
   * Send message to specific user
   * @param {string} userId - User identifier
   * @param {Object} message - Message to send
   */
  sendToUser(userId, message) {
    for (const [connectionId, connection] of this.connections) {
      if (connection.userId === userId && connection.ws.readyState === WebSocket.OPEN) {
        this.sendMessage(connection.ws, message);
      }
    }
  }

  /**
   * Send message to all admin connections
   * @param {Object} message - Message to send
   */
  sendToAdmins(message) {
    for (const [connectionId, connection] of this.connections) {
      if (connection.role === 'admin' && connection.ws.readyState === WebSocket.OPEN) {
        this.sendMessage(connection.ws, message);
      }
    }
  }

  /**
   * Broadcast message to all connections
   * @param {Object} message - Message to send
   */
  broadcast(message) {
    for (const [connectionId, connection] of this.connections) {
      if (connection.ws.readyState === WebSocket.OPEN) {
        this.sendMessage(connection.ws, message);
      }
    }
  }

  /**
   * Send message to specific WebSocket
   * @param {WebSocket} ws - WebSocket connection
   * @param {Object} message - Message to send
   */
  sendMessage(ws, message) {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify(message));
      } catch (error) {
        console.error('Error sending WebSocket message:', error);
      }
    }
  }

  /**
   * Extract authentication token from request
   * @param {Object} request - HTTP request object
   * @returns {string|null} - JWT token or null
   */
  extractToken(request) {
    const url = new URL(request.url, `http://${request.headers.host}`);
    
    // Try query parameter first
    let token = url.searchParams.get('token');
    
    // Try authorization header
    if (!token && request.headers.authorization) {
      const authHeader = request.headers.authorization;
      if (authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      }
    }
    
    return token;
  }

  /**
   * Generate unique connection ID
   * @returns {string} - Unique connection identifier
   */
  generateConnectionId() {
    return `ws_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Start heartbeat mechanism
   */
  startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      for (const [connectionId, connection] of this.connections) {
        if (connection.ws.readyState === WebSocket.OPEN) {
          connection.ws.ping();
        }
      }
    }, 30000); // Ping every 30 seconds
  }

  /**
   * Start cleanup mechanism for dead connections
   */
  startCleanup() {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      const timeout = 60000; // 60 seconds timeout
      
      for (const [connectionId, connection] of this.connections) {
        if (now - connection.lastPing > timeout || connection.ws.readyState !== WebSocket.OPEN) {
          console.log(`Cleaning up dead connection: ${connectionId}`);
          this.handleDisconnection(connectionId, connection.userId, connection.role, 1006, 'Timeout');
        }
      }
    }, 30000); // Check every 30 seconds
  }

  /**
   * Get connection statistics
   * @returns {Object} - Connection statistics
   */
  getStats() {
    const stats = {
      totalConnections: this.connections.size,
      userConnections: 0,
      adminConnections: 0,
      connectionsByRole: {},
      uptime: process.uptime()
    };

    for (const [connectionId, connection] of this.connections) {
      if (connection.role === 'admin') {
        stats.adminConnections++;
      } else {
        stats.userConnections++;
      }
      
      stats.connectionsByRole[connection.role] = (stats.connectionsByRole[connection.role] || 0) + 1;
    }

    return stats;
  }

  /**
   * Shutdown WebSocket server
   */
  shutdown() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    if (this.wss) {
      this.wss.close(() => {
        console.log('WebSocket server shut down');
      });
    }
  }
}

module.exports = new WebSocketMiddleware();