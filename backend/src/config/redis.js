const Redis = require('ioredis');
const logger = require('./logger');

// Redis configuration
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const REDIS_TLS = process.env.REDIS_TLS === 'true';
const REDIS_NAMESPACE = process.env.REDIS_NAMESPACE || 'grow5x';
const REDIS_MAX_RETRIES = parseInt(process.env.REDIS_MAX_RETRIES) || 20;
const REDIS_RETRY_MS = parseInt(process.env.REDIS_RETRY_MS) || 250;

// Create Redis client or mock for development
let client;

if (process.env.NODE_ENV === 'development' && !process.env.REDIS_URL) {
  // Mock Redis client for development
  client = {
    get: async () => null,
    set: async () => 'OK',
    setex: async () => 'OK',
    del: async () => 1,
    exists: async () => 0,
    expire: async () => 1,
    flushall: async () => 'OK',
    quit: async () => 'OK',
    on: () => {},
    connect: async () => {}
  };
  logger.info('Redis disabled in development mode - using mock client');
} else {
  // Configure Redis client for Redis Cloud
  const redisConfig = {
    lazyConnect: true,
    maxRetriesPerRequest: REDIS_MAX_RETRIES,
    retryDelayOnFailover: REDIS_RETRY_MS,
    enableReadyCheck: false,
    keyPrefix: `${REDIS_NAMESPACE}:`,
    retryStrategy: (times) => {
      const delay = Math.min(times * REDIS_RETRY_MS, 30000);
      logger.warn(`Redis retry attempt ${times}, delay: ${delay}ms`);
      return delay;
    }
  };

  // Add TLS configuration if enabled
  if (REDIS_TLS) {
    redisConfig.tls = {
      rejectUnauthorized: false,
      checkServerIdentity: () => undefined
    };
  }

  // Create client with URL or individual config
  if (REDIS_URL) {
    client = new Redis(REDIS_URL, redisConfig);
  } else {
    client = new Redis({
      ...redisConfig,
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD,
      db: process.env.REDIS_DB || 0
    });
  }
}

// Handle Redis connection events (only for real Redis client)
if (process.env.NODE_ENV !== 'development' || process.env.REDIS_URL) {
  client.on('connect', () => {
    logger.info('Redis client connected');
  });

  client.on('ready', () => {
    logger.info('Redis client ready');
  });

  client.on('error', (err) => {
    logger.error('Redis client error:', err);
  });

  client.on('end', () => {
    logger.info('Redis client disconnected');
  });
}

// Connect to Redis (with fallback for development)
const connectRedis = async () => {
  // Skip Redis connection in development if not configured
  if (process.env.NODE_ENV === 'development' && !process.env.REDIS_URL) {
    logger.info('Redis disabled in development mode');
    return;
  }
  
  try {
    await client.connect();
    logger.info('Connected to Redis successfully');
  } catch (error) {
    logger.warn('Redis connection failed, running without cache:', error.message);
  }
};

// Initialize connection only if Redis is configured
if (process.env.REDIS_URL || process.env.NODE_ENV !== 'development') {
  connectRedis();
}

// Export client with fallback methods
module.exports = {
  client,
  connectRedis,
  // Helper methods
  get: async (key) => {
    try {
      return await client.get(key);
    } catch (error) {
      logger.warn('Redis GET error:', error.message);
      return null;
    }
  },
  set: async (key, value, ttl = null) => {
    try {
      if (ttl) {
        return await client.setex(key, ttl, value);
      }
      return await client.set(key, value);
    } catch (error) {
      logger.warn('Redis SET error:', error.message);
      return 'OK';
    }
  },
  del: async (key) => {
    try {
      return await client.del(key);
    } catch (error) {
      logger.warn('Redis DEL error:', error.message);
      return 1;
    }
  },
  exists: async (key) => {
    try {
      return await client.exists(key);
    } catch (error) {
      logger.warn('Redis EXISTS error:', error.message);
      return 0;
    }
  }
};