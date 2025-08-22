/**
 * Real-time Routes
 * Handles Server-Sent Events (SSE) for real-time updates
 */

const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const requireAdmin = require('../middleware/requireAdmin');
const realtimeSyncService = require('../services/realtimeSyncService');
const logger = require('../config/logger');

const router = express.Router();

/**
 * SSE endpoint for user real-time updates
 * GET /api/rt/stream
 */
router.get('/stream', authenticateToken, (req, res) => {
  const userId = req.user.userId;
  
  // Set SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': process.env.FRONTEND_URL || 'http://localhost:3000',
    'Access-Control-Allow-Credentials': 'true'
  });

  // Send initial connection event
  res.write(`data: ${JSON.stringify({
    type: 'CONNECTION_ESTABLISHED',
    timestamp: new Date().toISOString(),
    userId
  })}\n\n`);

  // Register user connection
  realtimeSyncService.addUserConnection(userId, res);

  logger.info('User connected to SSE stream', { userId });

  // Handle client disconnect
  req.on('close', () => {
    realtimeSyncService.removeUserConnection(userId);
    logger.info('User disconnected from SSE stream', { userId });
  });

  req.on('error', (error) => {
    logger.error('SSE connection error', { userId, error: error.message });
    realtimeSyncService.removeUserConnection(userId);
  });
});

/**
 * SSE endpoint for admin real-time updates
 * GET /api/rt/admin/stream
 */
router.get('/admin/stream', authenticateToken, requireAdmin, (req, res) => {
  const adminId = req.user.userId;
  
  // Set SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': process.env.FRONTEND_URL || 'http://localhost:3000',
    'Access-Control-Allow-Credentials': 'true'
  });

  // Send initial connection event
  res.write(`data: ${JSON.stringify({
    type: 'ADMIN_CONNECTION_ESTABLISHED',
    timestamp: new Date().toISOString(),
    adminId
  })}\n\n`);

  // Register admin connection
  realtimeSyncService.addAdminConnection(adminId, res);

  logger.info('Admin connected to SSE stream', { adminId });

  // Handle client disconnect
  req.on('close', () => {
    realtimeSyncService.removeAdminConnection(adminId);
    logger.info('Admin disconnected from SSE stream', { adminId });
  });

  req.on('error', (error) => {
    logger.error('Admin SSE connection error', { adminId, error: error.message });
    realtimeSyncService.removeAdminConnection(adminId);
  });
});

/**
 * Get real-time connection status
 * GET /api/rt/status
 */
router.get('/status', authenticateToken, (req, res) => {
  const stats = realtimeSyncService.getConnectionStats();
  
  res.json({
    success: true,
    data: {
      ...stats,
      userConnected: realtimeSyncService.isUserConnected(req.user.userId),
      timestamp: new Date().toISOString()
    }
  });
});

/**
 * Get admin real-time connection status
 * GET /api/rt/admin/status
 */
router.get('/admin/status', authenticateToken, requireAdmin, (req, res) => {
  const stats = realtimeSyncService.getConnectionStats();
  
  res.json({
    success: true,
    data: {
      ...stats,
      adminConnected: realtimeSyncService.isAdminConnected(req.user.userId),
      timestamp: new Date().toISOString()
    }
  });
});

/**
 * Test endpoint to send a test message (admin only)
 * POST /api/rt/admin/test
 */
router.post('/admin/test', authenticateToken, requireAdmin, (req, res) => {
  const { userId, message, type = 'TEST_MESSAGE' } = req.body;
  
  if (!userId || !message) {
    return res.status(400).json({
      success: false,
      error: 'userId and message are required'
    });
  }

  try {
    realtimeSyncService.sendUserUpdate(userId, {
      type,
      message,
      timestamp: new Date().toISOString(),
      sentBy: req.user.userId
    });

    res.json({
      success: true,
      message: 'Test message sent successfully',
      data: {
        userId,
        type,
        message
      }
    });
  } catch (error) {
    logger.error('Failed to send test message', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to send test message'
    });
  }
});

module.exports = router;