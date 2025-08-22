const EventEmitter = require('events');
const logger = require('../config/logger');

/**
 * Gestor de conexiones SSE (Server-Sent Events)
 * Maneja las conexiones de usuarios y emisión de eventos en tiempo real
 */
class SocketManager extends EventEmitter {
  constructor() {
    super();
    this.connections = new Map(); // userId -> Set of response objects
    this.userSessions = new Map(); // userId -> Set of sessionIds
    this.sessionConnections = new Map(); // sessionId -> { userId, res, connectedAt }
  }

  /**
   * Registra una nueva conexión SSE
   */
  addConnection(userId, res, sessionId = null) {
    try {
      const actualSessionId = sessionId || this.generateSessionId();
      
      // Configurar headers SSE
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
      });

      // Enviar evento de conexión inicial
      this.sendEvent(res, 'connected', {
        sessionId: actualSessionId,
        timestamp: new Date().toISOString(),
        message: 'Conexión SSE establecida'
      });

      // Registrar conexión por usuario
      if (!this.connections.has(userId)) {
        this.connections.set(userId, new Set());
      }
      this.connections.get(userId).add(res);

      // Registrar sesión
      if (!this.userSessions.has(userId)) {
        this.userSessions.set(userId, new Set());
      }
      this.userSessions.get(userId).add(actualSessionId);

      // Registrar conexión de sesión
      this.sessionConnections.set(actualSessionId, {
        userId,
        res,
        connectedAt: new Date()
      });

      // Configurar limpieza al cerrar conexión
      res.on('close', () => {
        this.removeConnection(userId, res, actualSessionId);
      });

      res.on('error', (error) => {
        logger.error('SSE connection error:', {
          userId,
          sessionId: actualSessionId,
          error: error.message
        });
        this.removeConnection(userId, res, actualSessionId);
      });

      logger.info('SSE connection established', {
        userId,
        sessionId: actualSessionId,
        totalConnections: this.getTotalConnections()
      });

      return actualSessionId;

    } catch (error) {
      logger.error('Error adding SSE connection:', error);
      throw error;
    }
  }

  /**
   * Remueve una conexión SSE
   */
  removeConnection(userId, res, sessionId) {
    try {
      // Remover de conexiones de usuario
      if (this.connections.has(userId)) {
        this.connections.get(userId).delete(res);
        if (this.connections.get(userId).size === 0) {
          this.connections.delete(userId);
        }
      }

      // Remover sesión
      if (this.userSessions.has(userId)) {
        this.userSessions.get(userId).delete(sessionId);
        if (this.userSessions.get(userId).size === 0) {
          this.userSessions.delete(userId);
        }
      }

      // Remover conexión de sesión
      this.sessionConnections.delete(sessionId);

      logger.info('SSE connection removed', {
        userId,
        sessionId,
        totalConnections: this.getTotalConnections()
      });

    } catch (error) {
      logger.error('Error removing SSE connection:', error);
    }
  }

  /**
   * Emite un evento a un usuario específico
   */
  emitToUser(userId, eventType, data) {
    try {
      const userConnections = this.connections.get(userId);
      if (!userConnections || userConnections.size === 0) {
        logger.debug('No active connections for user', { userId, eventType });
        return false;
      }

      let successCount = 0;
      const deadConnections = [];

      for (const res of userConnections) {
        try {
          if (res.destroyed || res.writableEnded) {
            deadConnections.push(res);
            continue;
          }

          this.sendEvent(res, eventType, data);
          successCount++;

        } catch (error) {
          logger.error('Error sending event to connection:', {
            userId,
            eventType,
            error: error.message
          });
          deadConnections.push(res);
        }
      }

      // Limpiar conexiones muertas
      deadConnections.forEach(res => {
        userConnections.delete(res);
      });

      logger.debug('Event emitted to user', {
        userId,
        eventType,
        successCount,
        deadConnections: deadConnections.length
      });

      return successCount > 0;

    } catch (error) {
      logger.error('Error emitting to user:', error);
      return false;
    }
  }

  /**
   * Emite un evento a todos los usuarios conectados
   */
  emitToAll(eventType, data) {
    try {
      let totalSent = 0;
      
      for (const [userId, connections] of this.connections) {
        if (this.emitToUser(userId, eventType, data)) {
          totalSent++;
        }
      }

      logger.info('Event emitted to all users', {
        eventType,
        totalUsers: totalSent,
        totalConnections: this.getTotalConnections()
      });

      return totalSent;

    } catch (error) {
      logger.error('Error emitting to all users:', error);
      return 0;
    }
  }

  /**
   * Emite un evento a múltiples usuarios
   */
  emitToUsers(userIds, eventType, data) {
    try {
      let successCount = 0;
      
      for (const userId of userIds) {
        if (this.emitToUser(userId, eventType, data)) {
          successCount++;
        }
      }

      logger.debug('Event emitted to multiple users', {
        eventType,
        targetUsers: userIds.length,
        successCount
      });

      return successCount;

    } catch (error) {
      logger.error('Error emitting to multiple users:', error);
      return 0;
    }
  }

  /**
   * Envía un evento SSE a una conexión específica
   */
  sendEvent(res, eventType, data) {
    try {
      const eventData = {
        type: eventType,
        data,
        timestamp: new Date().toISOString()
      };

      const sseData = `event: ${eventType}\ndata: ${JSON.stringify(eventData)}\n\n`;
      res.write(sseData);

    } catch (error) {
      logger.error('Error sending SSE event:', error);
      throw error;
    }
  }

  /**
   * Envía un ping para mantener la conexión viva
   */
  sendPing(userId) {
    return this.emitToUser(userId, 'ping', {
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Obtiene el número total de conexiones activas
   */
  getTotalConnections() {
    let total = 0;
    for (const connections of this.connections.values()) {
      total += connections.size;
    }
    return total;
  }

  /**
   * Obtiene estadísticas del gestor
   */
  getStats() {
    return {
      totalUsers: this.connections.size,
      totalConnections: this.getTotalConnections(),
      totalSessions: this.sessionConnections.size,
      userConnections: Array.from(this.connections.entries()).map(([userId, connections]) => ({
        userId,
        connections: connections.size
      }))
    };
  }

  /**
   * Verifica si un usuario está conectado
   */
  isUserConnected(userId) {
    const connections = this.connections.get(userId);
    return connections && connections.size > 0;
  }

  /**
   * Obtiene las sesiones activas de un usuario
   */
  getUserSessions(userId) {
    return Array.from(this.userSessions.get(userId) || []);
  }

  /**
   * Desconecta todas las sesiones de un usuario
   */
  disconnectUser(userId) {
    try {
      const connections = this.connections.get(userId);
      if (!connections) {
        return false;
      }

      for (const res of connections) {
        try {
          res.end();
        } catch (error) {
          logger.error('Error closing connection:', error);
        }
      }

      this.connections.delete(userId);
      this.userSessions.delete(userId);

      // Limpiar sesiones
      for (const [sessionId, session] of this.sessionConnections) {
        if (session.userId === userId) {
          this.sessionConnections.delete(sessionId);
        }
      }

      logger.info('User disconnected', { userId });
      return true;

    } catch (error) {
      logger.error('Error disconnecting user:', error);
      return false;
    }
  }

  /**
   * Limpia conexiones muertas
   */
  cleanupDeadConnections() {
    try {
      let cleanedCount = 0;
      
      for (const [userId, connections] of this.connections) {
        const deadConnections = [];
        
        for (const res of connections) {
          if (res.destroyed || res.writableEnded) {
            deadConnections.push(res);
          }
        }
        
        deadConnections.forEach(res => {
          connections.delete(res);
          cleanedCount++;
        });
        
        if (connections.size === 0) {
          this.connections.delete(userId);
        }
      }

      if (cleanedCount > 0) {
        logger.info('Cleaned up dead connections', { cleanedCount });
      }

      return cleanedCount;

    } catch (error) {
      logger.error('Error cleaning up connections:', error);
      return 0;
    }
  }

  /**
   * Genera un ID de sesión único
   */
  generateSessionId() {
    return `sse_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  /**
   * Inicia el limpiador automático de conexiones
   */
  startCleanupInterval(intervalMs = 60000) { // 1 minuto
    setInterval(() => {
      this.cleanupDeadConnections();
    }, intervalMs);
  }
}

// Instancia singleton
const socketManager = new SocketManager();

// Iniciar limpieza automática
socketManager.startCleanupInterval();

// Funciones de conveniencia
const emitToUser = (userId, eventType, data) => {
  return socketManager.emitToUser(userId, eventType, data);
};

const emitToAll = (eventType, data) => {
  return socketManager.emitToAll(eventType, data);
};

const emitToUsers = (userIds, eventType, data) => {
  return socketManager.emitToUsers(userIds, eventType, data);
};

module.exports = {
  SocketManager,
  socketManager,
  emitToUser,
  emitToAll,
  emitToUsers
};