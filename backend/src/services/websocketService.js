const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const logger = require('../config/logger');
const { sessionService } = require('./redisSessionService');

/**
 * Servicio de WebSocket para actualizaciones en tiempo real
 * Maneja conexiones WebSocket, autenticación y broadcasting de eventos
 */
class WebSocketService {
  constructor() {
    this.wss = null;
    this.clients = new Map(); // Map<userId, Set<WebSocket>>
    this.adminClients = new Set(); // Set<WebSocket>
    this.connectionStats = {
      total: 0,
      authenticated: 0,
      admin: 0,
      lastReset: new Date()
    };
  }

  /**
   * Inicializa el servidor WebSocket
   * @param {Object} server - Servidor HTTP
   * @param {Object} options - Opciones de configuración
   */
  initialize(server, options = {}) {
    const wsOptions = {
      server,
      path: '/ws',
      clientTracking: true,
      maxPayload: 16 * 1024, // 16KB
      ...options
    };

    this.wss = new WebSocket.Server(wsOptions);

    this.wss.on('connection', (ws, req) => {
      this.handleConnection(ws, req);
    });

    this.wss.on('error', (error) => {
      logger.error('WebSocket server error', { error: error.message });
    });

    // Cleanup interval para conexiones muertas
    setInterval(() => {
      this.cleanupDeadConnections();
    }, 30000); // Cada 30 segundos

    // Reset de estadísticas cada hora
    setInterval(() => {
      this.resetStats();
    }, 3600000); // Cada hora

    logger.info('WebSocket server initialized', {
      path: wsOptions.path,
      maxPayload: wsOptions.maxPayload
    });
  }

  /**
   * Maneja una nueva conexión WebSocket
   * @param {WebSocket} ws - Conexión WebSocket
   * @param {Object} req - Request HTTP
   */
  async handleConnection(ws, req) {
    const clientIp = req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];
    
    this.connectionStats.total++;
    
    logger.debug('New WebSocket connection', {
      ip: clientIp,
      userAgent,
      total: this.connectionStats.total
    });

    // Configurar propiedades de la conexión
    ws.isAlive = true;
    ws.clientIp = clientIp;
    ws.userAgent = userAgent;
    ws.connectedAt = new Date();
    ws.lastPing = new Date();
    ws.isAuthenticated = false;
    ws.userId = null;
    ws.isAdmin = false;

    // Configurar heartbeat
    ws.on('pong', () => {
      ws.isAlive = true;
      ws.lastPing = new Date();
    });

    // Manejar mensajes
    ws.on('message', async (data) => {
      try {
        await this.handleMessage(ws, data);
      } catch (error) {
        logger.error('Error handling WebSocket message', {
          error: error.message,
          userId: ws.userId,
          ip: ws.clientIp
        });
        
        this.sendError(ws, 'MESSAGE_ERROR', 'Error procesando mensaje');
      }
    });

    // Manejar cierre de conexión
    ws.on('close', (code, reason) => {
      this.handleDisconnection(ws, code, reason);
    });

    // Manejar errores
    ws.on('error', (error) => {
      logger.error('WebSocket connection error', {
        error: error.message,
        userId: ws.userId,
        ip: ws.clientIp
      });
    });

    // Enviar mensaje de bienvenida
    this.sendMessage(ws, {
      type: 'welcome',
      data: {
        message: 'Conectado al servidor WebSocket',
        timestamp: new Date().toISOString(),
        requiresAuth: true
      }
    });
  }

  /**
   * Maneja mensajes recibidos del cliente
   * @param {WebSocket} ws - Conexión WebSocket
   * @param {Buffer} data - Datos del mensaje
   */
  async handleMessage(ws, data) {
    let message;
    
    try {
      message = JSON.parse(data.toString());
    } catch (error) {
      this.sendError(ws, 'INVALID_JSON', 'Formato de mensaje inválido');
      return;
    }

    const { type, data: messageData } = message;

    switch (type) {
      case 'auth':
        await this.handleAuth(ws, messageData);
        break;
        
      case 'ping':
        this.handlePing(ws, messageData);
        break;
        
      case 'subscribe':
        await this.handleSubscribe(ws, messageData);
        break;
        
      case 'unsubscribe':
        await this.handleUnsubscribe(ws, messageData);
        break;
        
      default:
        this.sendError(ws, 'UNKNOWN_MESSAGE_TYPE', `Tipo de mensaje desconocido: ${type}`);
    }
  }

  /**
   * Maneja autenticación de WebSocket
   * @param {WebSocket} ws - Conexión WebSocket
   * @param {Object} data - Datos de autenticación
   */
  async handleAuth(ws, data) {
    try {
      const { token } = data;
      
      if (!token) {
        this.sendError(ws, 'AUTH_REQUIRED', 'Token de autenticación requerido');
        return;
      }

      // Verificar JWT
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const { userId, role } = decoded;

      // Verificar sesión activa (opcional)
      if (process.env.ENABLE_SESSION_VALIDATION === 'true') {
        const sessions = await sessionService.getUserSessions(userId);
        if (sessions.length === 0) {
          this.sendError(ws, 'SESSION_EXPIRED', 'Sesión expirada');
          return;
        }
      }

      // Configurar conexión autenticada
      ws.isAuthenticated = true;
      ws.userId = userId;
      ws.isAdmin = role === 'admin';
      ws.authenticatedAt = new Date();

      // Agregar a mapas de clientes
      if (!this.clients.has(userId)) {
        this.clients.set(userId, new Set());
      }
      this.clients.get(userId).add(ws);

      if (ws.isAdmin) {
        this.adminClients.add(ws);
        this.connectionStats.admin++;
      }

      this.connectionStats.authenticated++;

      logger.info('WebSocket authenticated', {
        userId,
        isAdmin: ws.isAdmin,
        ip: ws.clientIp,
        authenticatedConnections: this.connectionStats.authenticated
      });

      // Enviar confirmación de autenticación
      this.sendMessage(ws, {
        type: 'auth_success',
        data: {
          userId,
          isAdmin: ws.isAdmin,
          timestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      logger.warn('WebSocket authentication failed', {
        error: error.message,
        ip: ws.clientIp
      });
      
      this.sendError(ws, 'AUTH_FAILED', 'Autenticación fallida');
    }
  }

  /**
   * Maneja ping del cliente
   * @param {WebSocket} ws - Conexión WebSocket
   * @param {Object} data - Datos del ping
   */
  handlePing(ws, data) {
    ws.lastPing = new Date();
    
    this.sendMessage(ws, {
      type: 'pong',
      data: {
        timestamp: new Date().toISOString(),
        ...data
      }
    });
  }

  /**
   * Maneja suscripción a eventos
   * @param {WebSocket} ws - Conexión WebSocket
   * @param {Object} data - Datos de suscripción
   */
  async handleSubscribe(ws, data) {
    if (!ws.isAuthenticated) {
      this.sendError(ws, 'AUTH_REQUIRED', 'Autenticación requerida para suscribirse');
      return;
    }

    const { events } = data;
    
    if (!Array.isArray(events)) {
      this.sendError(ws, 'INVALID_EVENTS', 'Lista de eventos debe ser un array');
      return;
    }

    // Validar eventos permitidos
    const allowedEvents = this.getAllowedEvents(ws);
    const validEvents = events.filter(event => allowedEvents.includes(event));
    
    if (!ws.subscriptions) {
      ws.subscriptions = new Set();
    }
    
    validEvents.forEach(event => ws.subscriptions.add(event));

    logger.debug('WebSocket subscribed to events', {
      userId: ws.userId,
      events: validEvents
    });

    this.sendMessage(ws, {
      type: 'subscription_success',
      data: {
        subscribedEvents: validEvents,
        timestamp: new Date().toISOString()
      }
    });
  }

  /**
   * Maneja cancelación de suscripción
   * @param {WebSocket} ws - Conexión WebSocket
   * @param {Object} data - Datos de cancelación
   */
  async handleUnsubscribe(ws, data) {
    if (!ws.isAuthenticated || !ws.subscriptions) {
      return;
    }

    const { events } = data;
    
    if (Array.isArray(events)) {
      events.forEach(event => ws.subscriptions.delete(event));
    } else {
      ws.subscriptions.clear();
    }

    this.sendMessage(ws, {
      type: 'unsubscription_success',
      data: {
        timestamp: new Date().toISOString()
      }
    });
  }

  /**
   * Obtiene eventos permitidos para una conexión
   * @param {WebSocket} ws - Conexión WebSocket
   * @returns {Array} Lista de eventos permitidos
   */
  getAllowedEvents(ws) {
    const userEvents = [
      'benefit_earned',
      'commission_earned',
      'withdrawal_status',
      'license_purchased',
      'balance_updated',
      'notification'
    ];

    const adminEvents = [
      ...userEvents,
      'new_user_registered',
      'new_purchase',
      'new_withdrawal_request',
      'system_alert',
      'admin_notification'
    ];

    return ws.isAdmin ? adminEvents : userEvents;
  }

  /**
   * Maneja desconexión de WebSocket
   * @param {WebSocket} ws - Conexión WebSocket
   * @param {number} code - Código de cierre
   * @param {string} reason - Razón del cierre
   */
  handleDisconnection(ws, code, reason) {
    logger.debug('WebSocket disconnected', {
      userId: ws.userId,
      code,
      reason: reason?.toString(),
      ip: ws.clientIp,
      duration: ws.connectedAt ? Date.now() - ws.connectedAt.getTime() : 0
    });

    // Remover de mapas de clientes
    if (ws.userId && this.clients.has(ws.userId)) {
      const userConnections = this.clients.get(ws.userId);
      userConnections.delete(ws);
      
      if (userConnections.size === 0) {
        this.clients.delete(ws.userId);
      }
    }

    if (ws.isAdmin) {
      this.adminClients.delete(ws);
      this.connectionStats.admin--;
    }

    if (ws.isAuthenticated) {
      this.connectionStats.authenticated--;
    }

    this.connectionStats.total--;
  }

  /**
   * Envía un mensaje a una conexión WebSocket
   * @param {WebSocket} ws - Conexión WebSocket
   * @param {Object} message - Mensaje a enviar
   */
  sendMessage(ws, message) {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify(message));
      } catch (error) {
        logger.error('Error sending WebSocket message', {
          error: error.message,
          userId: ws.userId
        });
      }
    }
  }

  /**
   * Envía un mensaje de error
   * @param {WebSocket} ws - Conexión WebSocket
   * @param {string} code - Código de error
   * @param {string} message - Mensaje de error
   */
  sendError(ws, code, message) {
    this.sendMessage(ws, {
      type: 'error',
      data: {
        code,
        message,
        timestamp: new Date().toISOString()
      }
    });
  }

  /**
   * Envía un evento a un usuario específico
   * @param {string} userId - ID del usuario
   * @param {string} eventType - Tipo de evento
   * @param {Object} eventData - Datos del evento
   */
  sendToUser(userId, eventType, eventData) {
    const userConnections = this.clients.get(userId);
    
    if (!userConnections || userConnections.size === 0) {
      return;
    }

    const message = {
      type: 'event',
      data: {
        eventType,
        ...eventData,
        timestamp: new Date().toISOString()
      }
    };

    userConnections.forEach(ws => {
      if (ws.subscriptions && ws.subscriptions.has(eventType)) {
        this.sendMessage(ws, message);
      }
    });

    logger.debug('Event sent to user', {
      userId,
      eventType,
      connections: userConnections.size
    });
  }

  /**
   * Envía un evento a todos los administradores
   * @param {string} eventType - Tipo de evento
   * @param {Object} eventData - Datos del evento
   */
  sendToAdmins(eventType, eventData) {
    if (this.adminClients.size === 0) {
      return;
    }

    const message = {
      type: 'event',
      data: {
        eventType,
        ...eventData,
        timestamp: new Date().toISOString()
      }
    };

    this.adminClients.forEach(ws => {
      if (ws.subscriptions && ws.subscriptions.has(eventType)) {
        this.sendMessage(ws, message);
      }
    });

    logger.debug('Event sent to admins', {
      eventType,
      connections: this.adminClients.size
    });
  }

  /**
   * Envía un evento a todos los usuarios conectados
   * @param {string} eventType - Tipo de evento
   * @param {Object} eventData - Datos del evento
   */
  broadcast(eventType, eventData) {
    const message = {
      type: 'event',
      data: {
        eventType,
        ...eventData,
        timestamp: new Date().toISOString()
      }
    };

    let sentCount = 0;

    this.clients.forEach(userConnections => {
      userConnections.forEach(ws => {
        if (ws.subscriptions && ws.subscriptions.has(eventType)) {
          this.sendMessage(ws, message);
          sentCount++;
        }
      });
    });

    logger.debug('Event broadcasted', {
      eventType,
      sentTo: sentCount
    });
  }

  /**
   * Limpia conexiones muertas
   */
  cleanupDeadConnections() {
    if (!this.wss) return;

    let cleanedCount = 0;

    this.wss.clients.forEach(ws => {
      if (!ws.isAlive) {
        ws.terminate();
        cleanedCount++;
      } else {
        ws.isAlive = false;
        ws.ping();
      }
    });

    if (cleanedCount > 0) {
      logger.debug('Cleaned dead WebSocket connections', { count: cleanedCount });
    }
  }

  /**
   * Resetea estadísticas de conexión
   */
  resetStats() {
    this.connectionStats.lastReset = new Date();
    
    logger.info('WebSocket stats reset', {
      previousStats: { ...this.connectionStats },
      currentConnections: {
        total: this.connectionStats.total,
        authenticated: this.connectionStats.authenticated,
        admin: this.connectionStats.admin
      }
    });
  }

  /**
   * Obtiene estadísticas de conexiones
   * @returns {Object} Estadísticas de conexiones
   */
  getStats() {
    return {
      ...this.connectionStats,
      connectedUsers: this.clients.size,
      totalUserConnections: Array.from(this.clients.values())
        .reduce((sum, connections) => sum + connections.size, 0),
      adminConnections: this.adminClients.size
    };
  }

  /**
   * Cierra el servidor WebSocket
   */
  close() {
    if (this.wss) {
      this.wss.close(() => {
        logger.info('WebSocket server closed');
      });
    }
  }
}

// Crear instancia singleton
const websocketService = new WebSocketService();

module.exports = {
  WebSocketService,
  websocketService
};