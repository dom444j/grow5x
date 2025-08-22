const { User } = require('../models');
const logger = require('../utils/logger');
const redis = require('../config/redis');
const WebSocket = require('ws');
const axios = require('axios');

// Legacy support
const ENABLE_ALERTS = process.env.ENABLE_ALERTS === "1";
const BOT = process.env.TELEGRAM_BOT_TOKEN;
const CHAT = process.env.TELEGRAM_CHAT_ID;

// Alert types and priorities
const ALERT_TYPES = {
  SYSTEM: 'system',
  SECURITY: 'security',
  FINANCIAL: 'financial',
  USER_ACTION: 'user_action',
  PERFORMANCE: 'performance',
  ERROR: 'error'
};

const ALERT_PRIORITIES = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical'
};

class AlertService {
  constructor() {
    this.wsClients = new Set();
    this.alertQueue = [];
    this.processingQueue = false;
  }

  /**
   * Legacy notify function for backward compatibility
   */
  async notify(text) {
    if (!ENABLE_ALERTS || !BOT || !CHAT) return false;
    try {
      const url = `https://api.telegram.org/bot${BOT}/sendMessage`;
      await axios.post(url, { chat_id: CHAT, text, parse_mode: "HTML", disable_web_page_preview: true }, { timeout: 6000 });
      return true;
    } catch { return false; }
  }

  /**
   * Initialize WebSocket server for real-time alerts
   */
  initializeWebSocket(server) {
    this.wss = new WebSocket.Server({ server, path: '/ws/alerts' });
    
    this.wss.on('connection', (ws, req) => {
      logger.info('Admin WebSocket connected', { ip: req.socket.remoteAddress });
      
      this.wsClients.add(ws);
      this.sendRecentAlerts(ws);
      
      ws.on('close', () => {
        this.wsClients.delete(ws);
        logger.info('Admin WebSocket disconnected');
      });
      
      ws.on('error', (error) => {
        logger.error('WebSocket error:', error);
        this.wsClients.delete(ws);
      });
    });
  }

  /**
   * Create and dispatch a system alert
   */
  async createAlert(type, priority, title, message, metadata = {}, sendTelegram = null) {
    try {
      const alert = {
        id: this.generateAlertId(),
        type,
        priority,
        title,
        message,
        metadata,
        timestamp: new Date(),
        acknowledged: false,
        acknowledgedBy: null,
        acknowledgedAt: null
      };

      if (sendTelegram === null) {
        sendTelegram = priority === ALERT_PRIORITIES.HIGH || priority === ALERT_PRIORITIES.CRITICAL;
      }

      await this.storeAlert(alert);
      this.alertQueue.push({ alert, sendTelegram });
      
      if (!this.processingQueue) {
        this.processAlertQueue();
      }

      logger.info('Alert created:', {
        id: alert.id,
        type,
        priority,
        title
      });

      return alert;

    } catch (error) {
      logger.error('AlertService.createAlert error:', {
        error: error.message,
        type,
        priority,
        title
      });
      throw error;
    }
  }

  /**
   * Process alert queue
   */
  async processAlertQueue() {
    this.processingQueue = true;

    while (this.alertQueue.length > 0) {
      const { alert, sendTelegram } = this.alertQueue.shift();

      try {
        this.broadcastAlert(alert);

        if (sendTelegram) {
          await this.sendTelegramAlert(alert);
        }

        logger.info('Alert dispatched:', {
          id: alert.id,
          websocket: true,
          telegram: sendTelegram
        });

      } catch (error) {
        logger.error('Alert dispatch error:', {
          error: error.message,
          alertId: alert.id
        });
      }
    }

    this.processingQueue = false;
  }

  /**
   * Store alert in Redis
   */
  async storeAlert(alert) {
    try {
      const key = `alert:${alert.id}`;
      const listKey = 'alerts:recent';
      const ttl = 7 * 24 * 60 * 60; // 7 days

      await redis.setex(key, ttl, JSON.stringify(alert));
      await redis.lpush(listKey, alert.id);
      await redis.ltrim(listKey, 0, 99);
      await redis.expire(listKey, ttl);

    } catch (error) {
      logger.error('AlertService.storeAlert error:', error);
    }
  }

  /**
   * Broadcast alert to WebSocket clients
   */
  broadcastAlert(alert) {
    const message = JSON.stringify({
      type: 'alert',
      data: alert
    });

    this.wsClients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(message);
        } catch (error) {
          logger.error('WebSocket send error:', error);
          this.wsClients.delete(client);
        }
      } else {
        this.wsClients.delete(client);
      }
    });
  }

  /**
   * Send alert via Telegram
   */
  async sendTelegramAlert(alert) {
    try {
      const priorityEmoji = {
        [ALERT_PRIORITIES.LOW]: '🔵',
        [ALERT_PRIORITIES.MEDIUM]: '🟡',
        [ALERT_PRIORITIES.HIGH]: '🟠',
        [ALERT_PRIORITIES.CRITICAL]: '🔴'
      };

      const typeEmoji = {
        [ALERT_TYPES.SYSTEM]: '⚙️',
        [ALERT_TYPES.SECURITY]: '🔒',
        [ALERT_TYPES.FINANCIAL]: '💰',
        [ALERT_TYPES.USER_ACTION]: '👤',
        [ALERT_TYPES.PERFORMANCE]: '📊',
        [ALERT_TYPES.ERROR]: '❌'
      };

      const message = `${priorityEmoji[alert.priority]} ${typeEmoji[alert.type]} *GROW5X ALERT*\n\n` +
        `*${alert.title}*\n\n` +
        `${alert.message}\n\n` +
        `*Priority:* ${alert.priority.toUpperCase()}\n` +
        `*Type:* ${alert.type}\n` +
        `*Time:* ${alert.timestamp.toISOString()}\n` +
        `*ID:* \`${alert.id}\``;

      await this.notify(message);

    } catch (error) {
      logger.error('AlertService.sendTelegramAlert error:', error);
    }
  }

  /**
   * Send recent alerts to new client
   */
  async sendRecentAlerts(ws) {
    try {
      const recentAlerts = await this.getRecentAlerts(10);
      
      const message = JSON.stringify({
        type: 'recent_alerts',
        data: recentAlerts
      });

      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      }

    } catch (error) {
      logger.error('AlertService.sendRecentAlerts error:', error);
    }
  }

  /**
   * Get recent alerts from Redis
   */
  async getRecentAlerts(limit = 50) {
    try {
      const alertIds = await redis.lrange('alerts:recent', 0, limit - 1);
      const alerts = [];

      for (const id of alertIds) {
        const alertData = await redis.get(`alert:${id}`);
        if (alertData) {
          alerts.push(JSON.parse(alertData));
        }
      }

      return alerts;

    } catch (error) {
      logger.error('AlertService.getRecentAlerts error:', error);
      return [];
    }
  }

  /**
   * Acknowledge an alert
   */
  async acknowledgeAlert(alertId, adminUserId) {
    try {
      const key = `alert:${alertId}`;
      const alertData = await redis.get(key);
      
      if (!alertData) {
        throw new Error('Alert not found');
      }

      const alert = JSON.parse(alertData);
      alert.acknowledged = true;
      alert.acknowledgedBy = adminUserId;
      alert.acknowledgedAt = new Date();

      await redis.setex(key, 7 * 24 * 60 * 60, JSON.stringify(alert));
      this.broadcastAlert(alert);

      logger.info('Alert acknowledged:', {
        alertId,
        adminUserId
      });

      return alert;

    } catch (error) {
      logger.error('AlertService.acknowledgeAlert error:', error);
      throw error;
    }
  }

  /**
   * Generate unique alert ID
   */
  generateAlertId() {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Predefined alert methods
  async securityAlert(title, message, metadata = {}) {
    return this.createAlert(ALERT_TYPES.SECURITY, ALERT_PRIORITIES.HIGH, title, message, metadata);
  }

  async financialAlert(title, message, metadata = {}) {
    return this.createAlert(ALERT_TYPES.FINANCIAL, ALERT_PRIORITIES.HIGH, title, message, metadata);
  }

  async systemErrorAlert(title, message, metadata = {}) {
    return this.createAlert(ALERT_TYPES.ERROR, ALERT_PRIORITIES.CRITICAL, title, message, metadata);
  }

  async performanceAlert(title, message, metadata = {}) {
    return this.createAlert(ALERT_TYPES.PERFORMANCE, ALERT_PRIORITIES.MEDIUM, title, message, metadata);
  }

  async userActionAlert(title, message, metadata = {}) {
    return this.createAlert(ALERT_TYPES.USER_ACTION, ALERT_PRIORITIES.LOW, title, message, metadata);
  }
}

// Export singleton instance
const alertService = new AlertService();
module.exports = alertService;
module.exports.ALERT_TYPES = ALERT_TYPES;
module.exports.ALERT_PRIORITIES = ALERT_PRIORITIES;