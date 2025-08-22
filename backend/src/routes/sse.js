const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { socketManager } = require('../utils/socketManager');
const logger = require('../utils/logger');

/**
 * @swagger
 * /api/sse/connect:
 *   get:
 *     summary: Establecer conexión SSE para eventos en tiempo real
 *     tags: [SSE]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: sessionId
 *         schema:
 *           type: string
 *         description: ID de sesión opcional para reconexión
 *     responses:
 *       200:
 *         description: Conexión SSE establecida
 *         content:
 *           text/event-stream:
 *             schema:
 *               type: string
 *       401:
 *         description: No autorizado
 */
router.get('/connect', authenticateToken, (req, res) => {
  try {
    const userId = req.user.userId;
    const sessionId = req.query.sessionId;
    
    logger.info('SSE connection request', {
      userId,
      sessionId,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    // Establecer conexión SSE
    const actualSessionId = socketManager.addConnection(userId, res, sessionId);
    
    // La conexión se mantendrá abierta hasta que el cliente se desconecte
    // Los eventos se enviarán a través del socketManager
    
  } catch (error) {
    logger.error('Error establishing SSE connection:', {
      userId: req.user?.userId,
      error: error.message,
      stack: error.stack
    });
    
    res.status(500).json({
      success: false,
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Error al establecer conexión SSE'
    });
  }
});

/**
 * @swagger
 * /api/sse/stats:
 *   get:
 *     summary: Obtener estadísticas de conexiones SSE
 *     tags: [SSE]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Estadísticas obtenidas exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalUsers:
 *                       type: number
 *                     totalConnections:
 *                       type: number
 *                     totalSessions:
 *                       type: number
 *                     isConnected:
 *                       type: boolean
 *                     userSessions:
 *                       type: array
 */
router.get('/stats', authenticateToken, (req, res) => {
  try {
    const userId = req.user.userId;
    const stats = socketManager.getStats();
    
    res.json({
      success: true,
      data: {
        ...stats,
        isConnected: socketManager.isUserConnected(userId),
        userSessions: socketManager.getUserSessions(userId)
      }
    });
    
  } catch (error) {
    logger.error('Error getting SSE stats:', error);
    res.status(500).json({
      success: false,
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Error al obtener estadísticas SSE'
    });
  }
});

/**
 * @swagger
 * /api/sse/test:
 *   post:
 *     summary: Enviar evento de prueba (solo para desarrollo)
 *     tags: [SSE]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               eventType:
 *                 type: string
 *                 example: "test"
 *               data:
 *                 type: object
 *                 example: { "message": "Test event" }
 *               targetUserId:
 *                 type: string
 *                 description: "ID del usuario objetivo (opcional)"
 *     responses:
 *       200:
 *         description: Evento enviado exitosamente
 */
router.post('/test', authenticateToken, (req, res) => {
  try {
    // Solo permitir en desarrollo
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({
        success: false,
        error: 'FORBIDDEN',
        message: 'Endpoint de prueba no disponible en producción'
      });
    }

    const { eventType = 'test', data = {}, targetUserId } = req.body;
    const userId = req.user.userId;
    
    const eventData = {
      ...data,
      sentBy: userId,
      timestamp: new Date().toISOString()
    };

    let result;
    if (targetUserId) {
      result = socketManager.emitToUser(targetUserId, eventType, eventData);
    } else {
      result = socketManager.emitToUser(userId, eventType, eventData);
    }

    res.json({
      success: true,
      data: {
        eventSent: result,
        eventType,
        targetUser: targetUserId || userId,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    logger.error('Error sending test event:', error);
    res.status(500).json({
      success: false,
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Error al enviar evento de prueba'
    });
  }
});

/**
 * @swagger
 * /api/sse/ping:
 *   post:
 *     summary: Enviar ping para mantener conexión activa
 *     tags: [SSE]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Ping enviado exitosamente
 */
router.post('/ping', authenticateToken, (req, res) => {
  try {
    const userId = req.user.userId;
    const result = socketManager.sendPing(userId);
    
    res.json({
      success: true,
      data: {
        pingSent: result,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    logger.error('Error sending ping:', error);
    res.status(500).json({
      success: false,
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Error al enviar ping'
    });
  }
});

/**
 * @swagger
 * /api/sse/disconnect:
 *   post:
 *     summary: Desconectar todas las sesiones SSE del usuario
 *     tags: [SSE]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Desconexión exitosa
 */
router.post('/disconnect', authenticateToken, (req, res) => {
  try {
    const userId = req.user.userId;
    const result = socketManager.disconnectUser(userId);
    
    res.json({
      success: true,
      data: {
        disconnected: result,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    logger.error('Error disconnecting user:', error);
    res.status(500).json({
      success: false,
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Error al desconectar usuario'
    });
  }
});

module.exports = router;