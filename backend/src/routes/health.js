const express = require('express');
const router = express.Router();
const { client: redisClient } = require('../config/redis');
const logger = require('../config/logger');

/**
 * Redis Health Check Endpoint
 * GET /api/health/redis
 */
router.get('/redis', async (req, res) => {
  try {
    // Check if Redis is configured
    if (process.env.NODE_ENV === 'development' && !process.env.REDIS_URL) {
      return res.json({
        ok: true,
        status: 'mock',
        message: 'Redis disabled in development mode',
        timestamp: new Date().toISOString(),
        config: {
          mode: 'mock',
          namespace: process.env.REDIS_NAMESPACE || 'grow5x'
        }
      });
    }

    // Test Redis connection
    if (!redisClient || typeof redisClient.ping !== 'function') {
      throw new Error('Redis client not available');
    }

    const startTime = Date.now();
    const pingResult = await redisClient.ping();
    const responseTime = Date.now() - startTime;

    if (pingResult !== 'PONG') {
      throw new Error(`Unexpected ping response: ${pingResult}`);
    }

    // Test basic operations
    const testKey = `${process.env.REDIS_NAMESPACE || 'grow5x'}:health:test:${Date.now()}`;
    await redisClient.set(testKey, 'test-value', 'EX', 10); // Expire in 10 seconds
    const testValue = await redisClient.get(testKey);
    await redisClient.del(testKey);

    if (testValue !== 'test-value') {
      throw new Error('Redis read/write test failed');
    }

    // Get Redis info
    let redisInfo = {};
    try {
      const info = await redisClient.info('server');
      const lines = info.split('\r\n');
      for (const line of lines) {
        if (line.includes(':')) {
          const [key, value] = line.split(':');
          if (key === 'redis_version' || key === 'uptime_in_seconds' || key === 'connected_clients') {
            redisInfo[key] = value;
          }
        }
      }
    } catch (infoError) {
      logger.warn('Could not get Redis info:', infoError.message);
    }

    res.json({
      ok: true,
      status: 'connected',
      message: 'Redis is healthy',
      timestamp: new Date().toISOString(),
      responseTime: `${responseTime}ms`,
      config: {
        namespace: process.env.REDIS_NAMESPACE || 'grow5x',
        tls: process.env.REDIS_TLS === 'true',
        maxRetries: process.env.REDIS_MAX_RETRIES || 20
      },
      info: redisInfo
    });

  } catch (error) {
    logger.error('Redis health check failed:', error);
    
    res.status(503).json({
      ok: false,
      status: 'error',
      message: 'Redis health check failed',
      error: error.message,
      timestamp: new Date().toISOString(),
      config: {
        namespace: process.env.REDIS_NAMESPACE || 'grow5x',
        tls: process.env.REDIS_TLS === 'true',
        configured: !!process.env.REDIS_URL
      }
    });
  }
});

/**
 * Redis Stats Endpoint
 * GET /api/health/redis/stats
 */
router.get('/redis/stats', async (req, res) => {
  try {
    if (process.env.NODE_ENV === 'development' && !process.env.REDIS_URL) {
      return res.json({
        ok: true,
        status: 'mock',
        message: 'Redis stats not available in mock mode',
        timestamp: new Date().toISOString()
      });
    }

    if (!redisClient || typeof redisClient.info !== 'function') {
      throw new Error('Redis client not available');
    }

    const info = await redisClient.info();
    const keyspaceInfo = await redisClient.info('keyspace');
    
    // Parse Redis info
    const stats = {};
    const sections = info.split('# ');
    
    for (const section of sections) {
      const lines = section.split('\r\n');
      const sectionName = lines[0].toLowerCase();
      
      if (['memory', 'stats', 'clients'].includes(sectionName)) {
        stats[sectionName] = {};
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i];
          if (line.includes(':')) {
            const [key, value] = line.split(':');
            stats[sectionName][key] = value;
          }
        }
      }
    }

    // Parse keyspace info
    const keyspace = {};
    const keyspaceLines = keyspaceInfo.split('\r\n');
    for (const line of keyspaceLines) {
      if (line.startsWith('db')) {
        const [db, info] = line.split(':');
        keyspace[db] = info;
      }
    }

    res.json({
      ok: true,
      status: 'connected',
      timestamp: new Date().toISOString(),
      stats,
      keyspace
    });

  } catch (error) {
    logger.error('Redis stats check failed:', error);
    
    res.status(503).json({
      ok: false,
      status: 'error',
      message: 'Redis stats check failed',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;