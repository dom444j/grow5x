const express = require('express');
const router = express.Router();
const { z } = require('zod');
const rateLimit = require('express-rate-limit');
const { websocketService } = require('../services/websocketService');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { cacheAdminData } = require('../middleware/redisCache');
const logger = require('../config/logger');

// Rate limiting para operaciones WebSocket
const wsLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // máximo 100 requests por ventana
  message: {
    error: 'Demasiadas operaciones WebSocket. Intenta de nuevo en 15 minutos.',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Esquemas de validación
const sendEventSchema = z.object({
  userId: z.string().min(1).optional(),
  eventType: z.string().min(1).max(50),
  eventData: z.object({}).passthrough(),
  broadcast: z.boolean().optional().default(false),
  adminOnly: z.boolean().optional().default(false)
});

const sendNotificationSchema = z.object({
  userId: z.string().min(1).optional(),
  title: z.string().min(1).max(100),
  message: z.string().min(1).max(500),
  type: z.enum(['info', 'success', 'warning', 'error']).optional().default('info'),
  broadcast: z.boolean().optional().default(false),
  adminOnly: z.boolean().optional().default(false)
});

/**
 * @route GET /api/websocket/stats
 * @desc Obtener estadísticas de conexiones WebSocket
 * @access Admin
 */
router.get('/stats', 
  wsLimit,
  authenticateToken, 
  requireRole(['admin']),
  cacheAdminData(60), // Cache por 1 minuto
  async (req, res) => {
    try {
      const stats = websocketService.getStats();
      
      logger.info('WebSocket stats retrieved', {
        adminId: req.user.userId,
        stats
      });
      
      res.json({
        success: true,
        data: stats
      });
      
    } catch (error) {
      logger.error('Error getting WebSocket stats', {
        adminId: req.user.userId,
        error: error.message
      });
      
      res.status(500).json({
        success: false,
        error: 'Error interno del servidor',
        code: 'WEBSOCKET_STATS_ERROR'
      });
    }
  }
);

/**
 * @route POST /api/websocket/send-event
 * @desc Enviar evento personalizado via WebSocket
 * @access Admin
 */
router.post('/send-event', 
  wsLimit,
  authenticateToken, 
  requireRole(['admin']), 
  async (req, res) => {
    try {
      const validation = sendEventSchema.safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: 'Datos de entrada inválidos',
          details: validation.error.errors,
          code: 'VALIDATION_ERROR'
        });
      }
      
      const { userId, eventType, eventData, broadcast, adminOnly } = validation.data;
      
      let sentTo = 0;
      
      if (broadcast) {
        if (adminOnly) {
          websocketService.sendToAdmins(eventType, eventData);
          sentTo = websocketService.getStats().adminConnections;
        } else {
          websocketService.broadcast(eventType, eventData);
          sentTo = websocketService.getStats().totalUserConnections;
        }
      } else if (userId) {
        websocketService.sendToUser(userId, eventType, eventData);
        sentTo = 1; // Aproximado
      } else {
        return res.status(400).json({
          success: false,
          error: 'Debe especificar userId o broadcast=true',
          code: 'VALIDATION_ERROR'
        });
      }
      
      logger.info('Custom event sent via WebSocket', {
        adminId: req.user.userId,
        eventType,
        userId,
        broadcast,
        adminOnly,
        sentTo
      });
      
      res.json({
        success: true,
        message: 'Evento enviado exitosamente',
        data: {
          eventType,
          sentTo,
          timestamp: new Date().toISOString()
        }
      });
      
    } catch (error) {
      logger.error('Error sending WebSocket event', {
        adminId: req.user.userId,
        error: error.message
      });
      
      res.status(500).json({
        success: false,
        error: 'Error interno del servidor',
        code: 'WEBSOCKET_SEND_ERROR'
      });
    }
  }
);

/**
 * @route POST /api/websocket/send-notification
 * @desc Enviar notificación via WebSocket
 * @access Admin
 */
router.post('/send-notification', 
  wsLimit,
  authenticateToken, 
  requireRole(['admin']), 
  async (req, res) => {
    try {
      const validation = sendNotificationSchema.safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: 'Datos de entrada inválidos',
          details: validation.error.errors,
          code: 'VALIDATION_ERROR'
        });
      }
      
      const { userId, title, message, type, broadcast, adminOnly } = validation.data;
      
      const notificationData = {
        title,
        message,
        type,
        id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        createdAt: new Date().toISOString()
      };
      
      let sentTo = 0;
      
      if (broadcast) {
        if (adminOnly) {
          websocketService.sendToAdmins('notification', notificationData);
          sentTo = websocketService.getStats().adminConnections;
        } else {
          websocketService.broadcast('notification', notificationData);
          sentTo = websocketService.getStats().totalUserConnections;
        }
      } else if (userId) {
        websocketService.sendToUser(userId, 'notification', notificationData);
        sentTo = 1; // Aproximado
      } else {
        return res.status(400).json({
          success: false,
          error: 'Debe especificar userId o broadcast=true',
          code: 'VALIDATION_ERROR'
        });
      }
      
      logger.info('Notification sent via WebSocket', {
        adminId: req.user.userId,
        title,
        type,
        userId,
        broadcast,
        adminOnly,
        sentTo
      });
      
      res.json({
        success: true,
        message: 'Notificación enviada exitosamente',
        data: {
          notification: notificationData,
          sentTo,
          timestamp: new Date().toISOString()
        }
      });
      
    } catch (error) {
      logger.error('Error sending WebSocket notification', {
        adminId: req.user.userId,
        error: error.message
      });
      
      res.status(500).json({
        success: false,
        error: 'Error interno del servidor',
        code: 'WEBSOCKET_NOTIFICATION_ERROR'
      });
    }
  }
);

/**
 * @route GET /api/websocket/connections
 * @desc Obtener información detallada de conexiones activas
 * @access Admin
 */
router.get('/connections', 
  wsLimit,
  authenticateToken, 
  requireRole(['admin']),
  cacheAdminData(30), // Cache por 30 segundos
  async (req, res) => {
    try {
      const stats = websocketService.getStats();
      
      // Información adicional sobre conexiones
      const connectionDetails = {
        summary: stats,
        details: {
          connectedUserIds: Array.from(websocketService.clients.keys()),
          connectionsByUser: {},
          adminConnectionCount: websocketService.adminClients.size
        }
      };
      
      // Agregar detalles por usuario (sin información sensible)
      websocketService.clients.forEach((connections, userId) => {
        connectionDetails.details.connectionsByUser[userId] = {
          connectionCount: connections.size,
          lastActivity: Array.from(connections).map(ws => ({
            connectedAt: ws.connectedAt,
            lastPing: ws.lastPing,
            isAuthenticated: ws.isAuthenticated,
            isAdmin: ws.isAdmin,
            subscriptions: ws.subscriptions ? Array.from(ws.subscriptions) : []
          }))
        };
      });
      
      logger.info('WebSocket connections retrieved', {
        adminId: req.user.userId,
        totalConnections: stats.total
      });
      
      res.json({
        success: true,
        data: connectionDetails
      });
      
    } catch (error) {
      logger.error('Error getting WebSocket connections', {
        adminId: req.user.userId,
        error: error.message
      });
      
      res.status(500).json({
        success: false,
        error: 'Error interno del servidor',
        code: 'WEBSOCKET_CONNECTIONS_ERROR'
      });
    }
  }
);

/**
 * @route POST /api/websocket/cleanup
 * @desc Forzar limpieza de conexiones muertas
 * @access Admin
 */
router.post('/cleanup', 
  wsLimit,
  authenticateToken, 
  requireRole(['admin']), 
  async (req, res) => {
    try {
      const statsBefore = websocketService.getStats();
      
      websocketService.cleanupDeadConnections();
      
      // Esperar un momento para que se procese la limpieza
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const statsAfter = websocketService.getStats();
      
      const cleaned = {
        before: statsBefore.total,
        after: statsAfter.total,
        cleaned: statsBefore.total - statsAfter.total
      };
      
      logger.info('WebSocket cleanup performed', {
        adminId: req.user.userId,
        ...cleaned
      });
      
      res.json({
        success: true,
        message: 'Limpieza de conexiones completada',
        data: cleaned
      });
      
    } catch (error) {
      logger.error('Error performing WebSocket cleanup', {
        adminId: req.user.userId,
        error: error.message
      });
      
      res.status(500).json({
        success: false,
        error: 'Error interno del servidor',
        code: 'WEBSOCKET_CLEANUP_ERROR'
      });
    }
  }
);

/**
 * @route GET /api/websocket/health
 * @desc Verificar el estado de salud del servicio WebSocket
 * @access Admin
 */
router.get('/health', 
  wsLimit,
  authenticateToken, 
  requireRole(['admin']), 
  async (req, res) => {
    try {
      const stats = websocketService.getStats();
      const isHealthy = websocketService.wss && websocketService.wss.readyState === 1;
      
      const health = {
        healthy: isHealthy,
        serverRunning: !!websocketService.wss,
        connections: stats,
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
      };
      
      const statusCode = isHealthy ? 200 : 503;
      
      res.status(statusCode).json({
        success: isHealthy,
        data: health
      });
      
    } catch (error) {
      logger.error('Error checking WebSocket health', {
        adminId: req.user.userId,
        error: error.message
      });
      
      res.status(503).json({
        success: false,
        error: 'Error al verificar el estado del WebSocket',
        code: 'WEBSOCKET_HEALTH_ERROR'
      });
    }
  }
);

/**
 * @route POST /api/websocket/disconnect-user
 * @desc Desconectar todas las conexiones de un usuario específico
 * @access Admin
 */
router.post('/disconnect-user', 
  wsLimit,
  authenticateToken, 
  requireRole(['admin']), 
  async (req, res) => {
    try {
      const { userId } = req.body;
      
      if (!userId) {
        return res.status(400).json({
          success: false,
          error: 'ID de usuario requerido',
          code: 'VALIDATION_ERROR'
        });
      }
      
      const userConnections = websocketService.clients.get(userId);
      
      if (!userConnections || userConnections.size === 0) {
        return res.status(404).json({
          success: false,
          error: 'Usuario no tiene conexiones activas',
          code: 'USER_NOT_CONNECTED'
        });
      }
      
      const connectionCount = userConnections.size;
      
      // Desconectar todas las conexiones del usuario
      userConnections.forEach(ws => {
        websocketService.sendMessage(ws, {
          type: 'disconnect',
          data: {
            reason: 'Desconectado por administrador',
            timestamp: new Date().toISOString()
          }
        });
        
        ws.close(1000, 'Disconnected by admin');
      });
      
      logger.warn('User disconnected by admin', {
        adminId: req.user.userId,
        targetUserId: userId,
        connectionCount
      });
      
      res.json({
        success: true,
        message: `Usuario desconectado (${connectionCount} conexiones cerradas)`,
        data: {
          userId,
          disconnectedConnections: connectionCount
        }
      });
      
    } catch (error) {
      logger.error('Error disconnecting user', {
        adminId: req.user.userId,
        error: error.message
      });
      
      res.status(500).json({
        success: false,
        error: 'Error interno del servidor',
        code: 'WEBSOCKET_DISCONNECT_ERROR'
      });
    }
  }
);

module.exports = router;