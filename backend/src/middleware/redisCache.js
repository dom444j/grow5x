const Redis = require('ioredis');
const logger = require('../config/logger');
const crypto = require('crypto');

// Redis client para cache
const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD,
  db: process.env.REDIS_CACHE_DB || 0,
  retryDelayOnFailover: 100,
  enableReadyCheck: true,
  maxRetriesPerRequest: 3,
  lazyConnect: true,
  keyPrefix: 'grow5x:cache:'
});

/**
 * Middleware de cache Redis
 * Proporciona funcionalidades de cache para mejorar el rendimiento
 */
class RedisCacheMiddleware {
  constructor() {
    this.DEFAULT_TTL = 300; // 5 minutos
    this.SHORT_TTL = 60; // 1 minuto
    this.MEDIUM_TTL = 900; // 15 minutos
    this.LONG_TTL = 3600; // 1 hora
    this.VERY_LONG_TTL = 86400; // 24 horas
  }

  /**
   * Genera una clave de cache basada en la ruta y parámetros
   * @param {Object} req - Request object
   * @param {string} prefix - Prefijo para la clave
   * @returns {string} Clave de cache
   */
  generateCacheKey(req, prefix = 'api') {
    const userId = req.user?.userId || 'anonymous';
    const method = req.method;
    const path = req.route?.path || req.path;
    const query = JSON.stringify(req.query || {});
    const params = JSON.stringify(req.params || {});
    
    const keyData = `${prefix}:${method}:${path}:${userId}:${query}:${params}`;
    return crypto.createHash('md5').update(keyData).digest('hex');
  }

  /**
   * Middleware de cache para respuestas GET
   * @param {number} ttl - Tiempo de vida en segundos
   * @param {string} keyPrefix - Prefijo para la clave de cache
   * @returns {Function} Middleware function
   */
  cacheResponse(ttl = this.DEFAULT_TTL, keyPrefix = 'response') {
    return async (req, res, next) => {
      // Solo cachear requests GET
      if (req.method !== 'GET') {
        return next();
      }

      try {
        const cacheKey = this.generateCacheKey(req, keyPrefix);
        
        // Intentar obtener desde cache
        const cachedData = await redis.get(cacheKey);
        
        if (cachedData) {
          const parsed = JSON.parse(cachedData);
          
          logger.debug('Cache hit', {
            key: cacheKey,
            path: req.path,
            userId: req.user?.userId
          });
          
          // Agregar headers de cache
          res.set({
            'X-Cache': 'HIT',
            'X-Cache-Key': cacheKey.substring(0, 16) + '...',
            'Cache-Control': `public, max-age=${ttl}`
          });
          
          return res.status(parsed.statusCode || 200).json(parsed.data);
        }
        
        // Cache miss - interceptar la respuesta
        const originalJson = res.json;
        const originalStatus = res.status;
        let statusCode = 200;
        
        res.status = function(code) {
          statusCode = code;
          return originalStatus.call(this, code);
        };
        
        res.json = async function(data) {
          // Solo cachear respuestas exitosas
          if (statusCode >= 200 && statusCode < 300) {
            try {
              const cacheData = {
                statusCode,
                data,
                cachedAt: new Date().toISOString()
              };
              
              await redis.setex(cacheKey, ttl, JSON.stringify(cacheData));
              
              logger.debug('Response cached', {
                key: cacheKey,
                path: req.path,
                statusCode,
                ttl
              });
              
              // Agregar headers de cache
              res.set({
                'X-Cache': 'MISS',
                'X-Cache-Key': cacheKey.substring(0, 16) + '...',
                'Cache-Control': `public, max-age=${ttl}`
              });
              
            } catch (cacheError) {
              logger.warn('Failed to cache response', {
                error: cacheError.message,
                key: cacheKey
              });
            }
          }
          
          return originalJson.call(this, data);
        };
        
        next();
        
      } catch (error) {
        logger.warn('Cache middleware error', {
          error: error.message,
          path: req.path
        });
        next();
      }
    };
  }

  /**
   * Middleware para invalidar cache
   * @param {string|Array} patterns - Patrones de claves a invalidar
   * @returns {Function} Middleware function
   */
  invalidateCache(patterns) {
    return async (req, res, next) => {
      const originalJson = res.json;
      
      res.json = async function(data) {
        // Solo invalidar en respuestas exitosas
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const patternsArray = Array.isArray(patterns) ? patterns : [patterns];
            
            for (const pattern of patternsArray) {
              await invalidateCachePattern(pattern, req);
            }
            
            logger.debug('Cache invalidated', {
              patterns: patternsArray,
              path: req.path,
              method: req.method
            });
            
          } catch (invalidateError) {
            logger.warn('Failed to invalidate cache', {
              error: invalidateError.message,
              patterns
            });
          }
        }
        
        return originalJson.call(this, data);
      };
      
      next();
    };
  }

  /**
   * Cache para datos de usuario
   * @param {number} ttl - Tiempo de vida
   * @returns {Function} Middleware function
   */
  cacheUserData(ttl = this.MEDIUM_TTL) {
    return this.cacheResponse(ttl, 'user');
  }

  /**
   * Cache para datos administrativos
   * @param {number} ttl - Tiempo de vida
   * @returns {Function} Middleware function
   */
  cacheAdminData(ttl = this.SHORT_TTL) {
    return this.cacheResponse(ttl, 'admin');
  }

  /**
   * Cache para estadísticas
   * @param {number} ttl - Tiempo de vida
   * @returns {Function} Middleware function
   */
  cacheStats(ttl = this.LONG_TTL) {
    return this.cacheResponse(ttl, 'stats');
  }

  /**
   * Cache para datos públicos
   * @param {number} ttl - Tiempo de vida
   * @returns {Function} Middleware function
   */
  cachePublicData(ttl = this.VERY_LONG_TTL) {
    return this.cacheResponse(ttl, 'public');
  }

  /**
   * Invalidar cache de usuario específico
   * @param {string} userId - ID del usuario
   * @returns {Function} Middleware function
   */
  invalidateUserCache(userId) {
    return this.invalidateCache(`user:*:${userId}:*`);
  }

  /**
   * Invalidar cache de administración
   * @returns {Function} Middleware function
   */
  invalidateAdminCache() {
    return this.invalidateCache(['admin:*', 'stats:*']);
  }
}

/**
 * Funciones utilitarias de cache
 */

/**
 * Invalida patrones de cache
 * @param {string} pattern - Patrón de claves
 * @param {Object} req - Request object para contexto
 */
async function invalidateCachePattern(pattern, req = {}) {
  try {
    // Reemplazar placeholders en el patrón
    let resolvedPattern = pattern;
    
    if (req.user?.userId) {
      resolvedPattern = resolvedPattern.replace(':userId:', req.user.userId);
    }
    
    if (req.params?.id) {
      resolvedPattern = resolvedPattern.replace(':id:', req.params.id);
    }
    
    // Buscar claves que coincidan con el patrón
    const keys = await redis.keys(resolvedPattern);
    
    if (keys.length > 0) {
      await redis.del(...keys);
      logger.debug('Cache keys deleted', {
        pattern: resolvedPattern,
        count: keys.length
      });
    }
    
  } catch (error) {
    logger.warn('Error invalidating cache pattern', {
      pattern,
      error: error.message
    });
  }
}

/**
 * Obtiene datos desde cache
 * @param {string} key - Clave de cache
 * @returns {Promise<any>} Datos cacheados o null
 */
async function getFromCache(key) {
  try {
    const data = await redis.get(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    logger.warn('Error getting from cache', {
      key,
      error: error.message
    });
    return null;
  }
}

/**
 * Guarda datos en cache
 * @param {string} key - Clave de cache
 * @param {any} data - Datos a cachear
 * @param {number} ttl - Tiempo de vida en segundos
 * @returns {Promise<boolean>} Éxito de la operación
 */
async function setCache(key, data, ttl = 300) {
  try {
    await redis.setex(key, ttl, JSON.stringify(data));
    return true;
  } catch (error) {
    logger.warn('Error setting cache', {
      key,
      error: error.message
    });
    return false;
  }
}

/**
 * Elimina datos del cache
 * @param {string|Array} keys - Clave(s) a eliminar
 * @returns {Promise<number>} Número de claves eliminadas
 */
async function deleteFromCache(keys) {
  try {
    const keysArray = Array.isArray(keys) ? keys : [keys];
    return await redis.del(...keysArray);
  } catch (error) {
    logger.warn('Error deleting from cache', {
      keys,
      error: error.message
    });
    return 0;
  }
}

/**
 * Obtiene estadísticas del cache
 * @returns {Promise<Object>} Estadísticas del cache
 */
async function getCacheStats() {
  try {
    const info = await redis.info('memory');
    const keyspace = await redis.info('keyspace');
    const stats = await redis.info('stats');
    
    // Parsear información básica
    const memoryUsed = info.match(/used_memory_human:(.+)/)?.[1]?.trim();
    const totalKeys = keyspace.match(/keys=(\d+)/)?.[1];
    const hits = stats.match(/keyspace_hits:(\d+)/)?.[1];
    const misses = stats.match(/keyspace_misses:(\d+)/)?.[1];
    
    const hitRate = hits && misses ? 
      ((parseInt(hits) / (parseInt(hits) + parseInt(misses))) * 100).toFixed(2) : '0';
    
    return {
      memoryUsed: memoryUsed || 'N/A',
      totalKeys: parseInt(totalKeys) || 0,
      hits: parseInt(hits) || 0,
      misses: parseInt(misses) || 0,
      hitRate: `${hitRate}%`,
      connected: redis.status === 'ready'
    };
    
  } catch (error) {
    logger.warn('Error getting cache stats', { error: error.message });
    return {
      memoryUsed: 'N/A',
      totalKeys: 0,
      hits: 0,
      misses: 0,
      hitRate: '0%',
      connected: false
    };
  }
}

/**
 * Limpia todo el cache
 * @returns {Promise<boolean>} Éxito de la operación
 */
async function flushCache() {
  try {
    await redis.flushdb();
    logger.info('Cache flushed successfully');
    return true;
  } catch (error) {
    logger.error('Error flushing cache', { error: error.message });
    return false;
  }
}

// Manejo de eventos Redis
redis.on('connect', () => {
  logger.info('Redis connected for cache middleware');
});

redis.on('ready', () => {
  logger.info('Redis ready for cache operations');
});

redis.on('error', (err) => {
  logger.error('Redis cache connection error', { error: err.message });
});

redis.on('close', () => {
  logger.warn('Redis cache connection closed');
});

// Crear instancia del middleware
const cacheMiddleware = new RedisCacheMiddleware();

module.exports = {
  // Middleware class
  RedisCacheMiddleware,
  
  // Instancia principal
  cache: cacheMiddleware,
  
  // Métodos de middleware
  cacheResponse: cacheMiddleware.cacheResponse.bind(cacheMiddleware),
  invalidateCache: cacheMiddleware.invalidateCache.bind(cacheMiddleware),
  cacheUserData: cacheMiddleware.cacheUserData.bind(cacheMiddleware),
  cacheAdminData: cacheMiddleware.cacheAdminData.bind(cacheMiddleware),
  cacheStats: cacheMiddleware.cacheStats.bind(cacheMiddleware),
  cachePublicData: cacheMiddleware.cachePublicData.bind(cacheMiddleware),
  invalidateUserCache: cacheMiddleware.invalidateUserCache.bind(cacheMiddleware),
  invalidateAdminCache: cacheMiddleware.invalidateAdminCache.bind(cacheMiddleware),
  
  // Funciones utilitarias
  getFromCache,
  setCache,
  deleteFromCache,
  getCacheStats,
  flushCache,
  invalidateCachePattern,
  
  // Cliente Redis directo
  redis
};