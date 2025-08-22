const logger = require('../config/logger');

// Simple in-memory LRU cache
class LRUCache {
  constructor(maxSize = 100) {
    this.cache = new Map();
    this.maxSize = maxSize;
  }

  get(key) {
    if (this.cache.has(key)) {
      // Move to end (most recently used)
      const value = this.cache.get(key);
      this.cache.delete(key);
      this.cache.set(key, value);
      return value;
    }
    return null;
  }

  set(key, value) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      // Remove least recently used (first item)
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, value);
  }

  clear() {
    this.cache.clear();
  }

  size() {
    return this.cache.size;
  }
}

// Global cache instance
const globalCache = new LRUCache(200);

/**
 * Cache middleware for GET requests
 * @param {number} seconds - Cache duration in seconds
 * @param {object} options - Cache options
 * @returns {Function} Express middleware
 */
function cache(seconds = 10, options = {}) {
  const {
    keyGenerator = (req) => req.originalUrl,
    skipCondition = () => false,
    onHit = () => {},
    onMiss = () => {}
  } = options;

  return (req, res, next) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Skip if condition is met
    if (skipCondition(req)) {
      return next();
    }

    const key = keyGenerator(req);
    const cached = globalCache.get(key);
    const now = Date.now();

    // Check if we have a valid cached response
    if (cached && (now - cached.timestamp) < (seconds * 1000)) {
      logger.debug('Cache hit', { key, age: now - cached.timestamp });
      onHit(req, key);
      
      // Set cache headers
      res.set({
        'X-Cache': 'HIT',
        'X-Cache-Age': Math.floor((now - cached.timestamp) / 1000)
      });
      
      return res.json(cached.data);
    }

    // Cache miss - intercept res.json to cache the response
    logger.debug('Cache miss', { key });
    onMiss(req, key);
    
    const originalJson = res.json.bind(res);
    res.json = (body) => {
      // Only cache successful responses
      if (res.statusCode >= 200 && res.statusCode < 300) {
        globalCache.set(key, {
          data: body,
          timestamp: now
        });
        
        logger.debug('Response cached', { key, size: JSON.stringify(body).length });
      }
      
      // Set cache headers
      res.set({
        'X-Cache': 'MISS',
        'X-Cache-TTL': seconds
      });
      
      return originalJson(body);
    };

    next();
  };
}

/**
 * Cache middleware specifically for admin overview endpoints
 * Caches for 15 seconds with user-specific keys
 */
function adminOverviewCache(seconds = 15) {
  return cache(seconds, {
    keyGenerator: (req) => {
      const userId = req.user?.userId || 'anonymous';
      return `admin:overview:${userId}:${req.originalUrl}`;
    },
    skipCondition: (req) => {
      // Skip caching in development if needed
      return process.env.NODE_ENV === 'development' && process.env.DISABLE_CACHE === 'true';
    },
    onHit: (req, key) => {
      logger.debug('Admin overview cache hit', {
        userId: req.user?.userId,
        path: req.path
      });
    }
  });
}

/**
 * Cache middleware for user dashboard data
 * Caches for 10 seconds with user-specific keys
 */
function userDashboardCache(seconds = 10) {
  return cache(seconds, {
    keyGenerator: (req) => {
      const userId = req.user?.userId || 'anonymous';
      return `user:dashboard:${userId}:${req.originalUrl}`;
    },
    skipCondition: (req) => {
      return process.env.NODE_ENV === 'development' && process.env.DISABLE_CACHE === 'true';
    }
  });
}

/**
 * Clear cache entries matching a pattern
 * @param {string|RegExp} pattern - Pattern to match cache keys
 */
function clearCache(pattern) {
  if (!pattern) {
    globalCache.clear();
    logger.info('All cache cleared');
    return;
  }

  const keys = Array.from(globalCache.cache.keys());
  let cleared = 0;

  keys.forEach(key => {
    if (typeof pattern === 'string' && key.includes(pattern)) {
      globalCache.cache.delete(key);
      cleared++;
    } else if (pattern instanceof RegExp && pattern.test(key)) {
      globalCache.cache.delete(key);
      cleared++;
    }
  });

  logger.info('Cache cleared', { pattern: pattern.toString(), cleared });
}

/**
 * Get cache statistics
 */
function getCacheStats() {
  return {
    size: globalCache.size(),
    maxSize: globalCache.maxSize,
    keys: Array.from(globalCache.cache.keys())
  };
}

module.exports = {
  cache,
  adminOverviewCache,
  userDashboardCache,
  clearCache,
  getCacheStats,
  LRUCache
};