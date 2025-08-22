/**
 * Real-time Synchronization Service
 * Handles real-time state synchronization between backend and frontend
 * Uses WebSocket connections and event-driven architecture
 */

const EventEmitter = require('events');
const logger = require('../config/logger');
const { DecimalCalc } = require('../utils/decimal');

class RealtimeSyncService extends EventEmitter {
  constructor() {
    super();
    this.connections = new Map(); // userId -> Set of WebSocket connections
    this.sseConnections = new Map(); // userId -> Set of SSE connections
    this.adminConnections = new Set(); // Admin WebSocket connections
    this.adminSseConnections = new Set(); // Admin SSE connections
    this.lastUpdates = new Map(); // Track last update timestamps
    this.pendingUpdates = new Map(); // Queue updates for offline users
    this.initialized = false;
  }

  /**
   * Initialize the realtime sync service
   */
  initialize() {
    if (this.initialized) {
      logger.warn('RealtimeSyncService already initialized');
      return;
    }

    try {
      // Start cleanup interval for pending updates
      setInterval(() => {
        this.cleanupPendingUpdates();
      }, 60 * 60 * 1000); // Every hour

      this.initialized = true;
      logger.info('RealtimeSyncService initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize RealtimeSyncService:', error);
      throw error;
    }
  }

  /**
   * Register a user WebSocket connection
   * @param {string} userId - User ID
   * @param {WebSocket} ws - WebSocket connection
   */
  registerUserConnection(userId, ws) {
    if (!this.connections.has(userId)) {
      this.connections.set(userId, new Set());
    }
    
    this.connections.get(userId).add(ws);
    
    // Send any pending updates
    this.sendPendingUpdates(userId, ws);
    
    // Handle connection close
    ws.on('close', () => {
      this.unregisterUserConnection(userId, ws);
    });
    
    logger.info('User connected to real-time sync', { userId });
  }

  /**
   * Add user SSE connection
   * @param {string} userId - User ID
   * @param {Response} res - Express response object
   */
  addUserConnection(userId, res) {
    if (!this.sseConnections.has(userId)) {
      this.sseConnections.set(userId, new Set());
    }
    
    this.sseConnections.get(userId).add(res);
    
    // Send any pending updates
    this.sendPendingUpdatesSSE(userId, res);
    
    logger.info('User connected to SSE', { userId });
  }

  /**
   * Remove user SSE connection
   * @param {string} userId - User ID
   */
  removeUserConnection(userId) {
    const userConnections = this.sseConnections.get(userId);
    if (userConnections) {
      this.sseConnections.delete(userId);
    }
    
    logger.info('User disconnected from SSE', { userId });
  }

  /**
   * Register an admin WebSocket connection
   * @param {string} adminId - Admin ID
   * @param {WebSocket} ws - WebSocket connection
   */
  registerAdminConnection(adminId, ws) {
    this.adminConnections.add(ws);
    
    // Handle connection close
    ws.on('close', () => {
      this.adminConnections.delete(ws);
    });
    
    logger.info('Admin connected to real-time sync', { adminId });
  }

  /**
   * Add admin SSE connection
   * @param {string} adminId - Admin ID
   * @param {Response} res - Express response object
   */
  addAdminConnection(adminId, res) {
    this.adminSseConnections.add(res);
    logger.info('Admin connected to SSE', { adminId });
  }

  /**
   * Remove admin SSE connection
   * @param {string} adminId - Admin ID
   */
  removeAdminConnection(adminId) {
    // Note: We can't easily identify which specific connection to remove
    // This is a limitation of SSE vs WebSockets
    logger.info('Admin disconnected from SSE', { adminId });
  }

  /**
   * Unregister a user WebSocket connection
   * @param {string} userId - User ID
   * @param {WebSocket} ws - WebSocket connection
   */
  unregisterUserConnection(userId, ws) {
    const userConnections = this.connections.get(userId);
    if (userConnections) {
      userConnections.delete(ws);
      if (userConnections.size === 0) {
        this.connections.delete(userId);
      }
    }
    
    logger.info('User disconnected from real-time sync', { userId });
  }

  /**
   * Send real-time update to specific user
   * @param {string} userId - User ID
   * @param {Object} update - Update data
   */
  sendUserUpdate(userId, update) {
    const userConnections = this.connections.get(userId);
    const userSseConnections = this.sseConnections.get(userId);
    const timestamp = new Date().toISOString();
    
    const message = {
      type: 'USER_UPDATE',
      timestamp,
      data: update
    };
    
    let sent = false;
    
    // Send to WebSocket connections
    if (userConnections && userConnections.size > 0) {
      userConnections.forEach(ws => {
        if (ws.readyState === 1) { // WebSocket.OPEN
          try {
            ws.send(JSON.stringify(message));
            sent = true;
          } catch (error) {
            logger.error('Failed to send user update via WebSocket', { userId, error: error.message });
          }
        }
      });
    }
    
    // Send to SSE connections
    if (userSseConnections && userSseConnections.size > 0) {
      userSseConnections.forEach(res => {
        try {
          res.write(`data: ${JSON.stringify(message)}\n\n`);
          sent = true;
        } catch (error) {
          logger.error('Failed to send user update via SSE', { userId, error: error.message });
          // Remove broken connection
          userSseConnections.delete(res);
        }
      });
    }
    
    if (sent) {
      this.lastUpdates.set(userId, timestamp);
    } else {
      // Queue update for when user comes online
      this.queuePendingUpdate(userId, message);
    }
  }

  /**
   * Send real-time update to all admin connections
   * @param {Object} update - Update data
   */
  sendAdminUpdate(update) {
    const timestamp = new Date().toISOString();
    
    const message = {
      type: 'ADMIN_UPDATE',
      timestamp,
      data: update
    };
    
    // Send to WebSocket connections
    this.adminConnections.forEach(ws => {
      if (ws.readyState === 1) { // WebSocket.OPEN
        try {
          ws.send(JSON.stringify(message));
        } catch (error) {
          logger.error('Failed to send admin update via WebSocket', { error: error.message });
        }
      }
    });
    
    // Send to SSE connections
    this.adminSseConnections.forEach(res => {
      try {
        res.write(`data: ${JSON.stringify(message)}\n\n`);
      } catch (error) {
        logger.error('Failed to send admin update via SSE', { error: error.message });
        // Remove broken connection
        this.adminSseConnections.delete(res);
      }
    });
  }

  /**
   * Queue update for offline user
   * @param {string} userId - User ID
   * @param {Object} message - Message to queue
   */
  queuePendingUpdate(userId, message) {
    if (!this.pendingUpdates.has(userId)) {
      this.pendingUpdates.set(userId, []);
    }
    
    const queue = this.pendingUpdates.get(userId);
    queue.push(message);
    
    // Keep only last 10 updates per user
    if (queue.length > 10) {
      queue.shift();
    }
  }

  /**
   * Send pending updates to newly connected user (WebSocket)
   * @param {string} userId - User ID
   * @param {WebSocket} ws - WebSocket connection
   */
  sendPendingUpdates(userId, ws) {
    const pendingUpdates = this.pendingUpdates.get(userId);
    if (pendingUpdates && pendingUpdates.length > 0) {
      pendingUpdates.forEach(update => {
        try {
          ws.send(JSON.stringify(update));
        } catch (error) {
          logger.error('Failed to send pending update', { userId, error: error.message });
        }
      });
      
      // Clear pending updates after sending
      this.pendingUpdates.delete(userId);
    }
  }

  /**
   * Send pending updates to newly connected user (SSE)
   * @param {string} userId - User ID
   * @param {Response} res - SSE response object
   */
  sendPendingUpdatesSSE(userId, res) {
    const pendingUpdates = this.pendingUpdates.get(userId);
    if (pendingUpdates && pendingUpdates.length > 0) {
      pendingUpdates.forEach(update => {
        try {
          res.write(`data: ${JSON.stringify(update)}\n\n`);
        } catch (error) {
          logger.error('Failed to send pending update via SSE', { 
            userId, 
            error: error.message 
          });
        }
      });
      
      // Clear pending updates for this user
      this.pendingUpdates.delete(userId);
    }
  }

  /**
   * Handle purchase status change
   * @param {Object} purchase - Purchase object
   * @param {string} previousStatus - Previous status
   */
  onPurchaseStatusChange(purchase, previousStatus) {
    const userId = purchase.userId.toString();
    
    const update = {
      type: 'PURCHASE_STATUS_CHANGE',
      purchaseId: purchase.purchaseId,
      status: purchase.status,
      previousStatus,
      timestamp: new Date().toISOString(),
      data: {
        purchaseId: purchase.purchaseId,
        status: purchase.status,
        totalAmount: parseFloat(purchase.totalAmount.toString()),
        currency: purchase.currency
      }
    };
    
    // Send to user
    this.sendUserUpdate(userId, update);
    
    // Send to admins
    this.sendAdminUpdate({
      type: 'PURCHASE_STATUS_CHANGE',
      userId,
      ...update
    });
  }

  /**
   * Handle withdrawal status change
   * @param {Object} withdrawal - Withdrawal object
   * @param {string} previousStatus - Previous status
   */
  onWithdrawalStatusChange(withdrawal, previousStatus) {
    const userId = withdrawal.userId.toString();
    
    const update = {
      type: 'WITHDRAWAL_STATUS_CHANGE',
      withdrawalId: withdrawal.withdrawalId,
      status: withdrawal.status,
      previousStatus,
      timestamp: new Date().toISOString(),
      data: {
        withdrawalId: withdrawal.withdrawalId,
        status: withdrawal.status,
        amount: parseFloat(withdrawal.amount.toString()),
        currency: withdrawal.currency,
        network: withdrawal.network
      }
    };
    
    // Send to user
    this.sendUserUpdate(userId, update);
    
    // Send to admins
    this.sendAdminUpdate({
      type: 'WITHDRAWAL_STATUS_CHANGE',
      userId,
      ...update
    });
  }

  /**
   * Handle balance update
   * @param {string} userId - User ID
   * @param {number} newBalance - New balance
   * @param {number} previousBalance - Previous balance
   * @param {string} reason - Reason for balance change
   */
  onBalanceUpdate(userId, newBalance, previousBalance, reason) {
    const update = {
      type: 'BALANCE_UPDATE',
      balance: newBalance,
      previousBalance,
      change: DecimalCalc.subtract(newBalance, previousBalance),
      reason,
      timestamp: new Date().toISOString()
    };
    
    // Send to user
    this.sendUserUpdate(userId, update);
    
    // Send to admins if significant change
    const changeAmount = Math.abs(update.change);
    if (changeAmount >= 10) { // Notify admins for changes >= $10
      this.sendAdminUpdate({
        type: 'SIGNIFICANT_BALANCE_CHANGE',
        userId,
        ...update
      });
    }
  }

  /**
   * Handle benefit accrual
   * @param {string} userId - User ID
   * @param {Object} benefit - Benefit data
   */
  onBenefitAccrual(userId, benefit) {
    const update = {
      type: 'BENEFIT_ACCRUAL',
      amount: benefit.amount,
      purchaseId: benefit.purchaseId,
      day: benefit.day,
      timestamp: new Date().toISOString()
    };
    
    // Send to user
    this.sendUserUpdate(userId, update);
  }

  /**
   * Handle referral commission
   * @param {string} userId - User ID (referrer)
   * @param {Object} commission - Commission data
   */
  onReferralCommission(userId, commission) {
    const update = {
      type: 'REFERRAL_COMMISSION',
      amount: commission.amount,
      referredUserId: commission.referredUserId,
      purchaseId: commission.purchaseId,
      timestamp: new Date().toISOString()
    };
    
    // Send to user
    this.sendUserUpdate(userId, update);
  }

  /**
   * Broadcast system-wide notification
   * @param {Object} notification - Notification data
   */
  broadcastSystemNotification(notification) {
    const message = {
      type: 'SYSTEM_NOTIFICATION',
      timestamp: new Date().toISOString(),
      data: notification
    };
    
    // Send to all connected users
    this.connections.forEach((connections, userId) => {
      connections.forEach(ws => {
        if (ws.readyState === 1) {
          try {
            ws.send(JSON.stringify(message));
          } catch (error) {
            logger.error('Failed to send system notification', { userId, error: error.message });
          }
        }
      });
    });
    
    // Send to all admins
    this.adminConnections.forEach(ws => {
      if (ws.readyState === 1) {
        try {
          ws.send(JSON.stringify(message));
        } catch (error) {
          logger.error('Failed to send system notification to admin', { error: error.message });
        }
      }
    });
  }

  /**
   * Get connection statistics
   * @returns {Object} - Connection stats
   */
  getConnectionStats() {
    const userConnections = Array.from(this.connections.values())
      .reduce((total, connections) => total + connections.size, 0);
    
    return {
      totalUsers: this.connections.size,
      totalUserConnections: userConnections,
      totalAdminConnections: this.adminConnections.size,
      pendingUpdatesQueued: Array.from(this.pendingUpdates.values())
        .reduce((total, queue) => total + queue.length, 0)
    };
  }

  /**
   * Clean up old pending updates (called periodically)
   */
  cleanupPendingUpdates() {
    const cutoffTime = Date.now() - (24 * 60 * 60 * 1000); // 24 hours ago
    
    this.pendingUpdates.forEach((queue, userId) => {
      const filteredQueue = queue.filter(update => {
        const updateTime = new Date(update.timestamp).getTime();
        return updateTime > cutoffTime;
      });
      
      if (filteredQueue.length === 0) {
        this.pendingUpdates.delete(userId);
      } else {
        this.pendingUpdates.set(userId, filteredQueue);
      }
    });
  }
}

// Export singleton instance
module.exports = new RealtimeSyncService();