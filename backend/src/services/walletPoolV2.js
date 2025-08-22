const Wallet = require('../models/Wallet');
const logger = require('../config/logger');
const Redis = require('ioredis');

// Redis client para cache de wallets
const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD,
  db: process.env.REDIS_WALLET_DB || 2,
  retryDelayOnFailover: 100,
  enableReadyCheck: true,
  maxRetriesPerRequest: 3,
  lazyConnect: true
});

/**
 * Servicio mejorado de pool de wallets con algoritmo LRS y cache Redis
 * Versión 2.0 con mejoras de rendimiento y monitoreo
 */
class WalletPoolServiceV2 {
  constructor() {
    this.CACHE_TTL = 300; // 5 minutos
    this.ROTATION_THRESHOLD = 5; // Umbral para rotación automática
    this.MIN_AVAILABLE_WALLETS = 3;
  }

  /**
   * Selecciona una wallet del pool usando algoritmo LRS mejorado
   * @param {Object} params - Parámetros de selección
   * @param {string} params.userId - ID del usuario
   * @param {number} params.amountUSDT - Cantidad en USDT
   * @param {string} params.network - Red (default: 'BEP20')
   * @param {string} params.currency - Moneda (default: 'USDT')
   * @param {boolean} params.useCache - Usar cache Redis (default: true)
   * @returns {Promise<Object>} - {address, network, currency, walletId}
   */
  async pick({ userId, amountUSDT, network = 'BEP20', currency = 'USDT', useCache = true }) {
    const cacheKey = `wallet_pool:${network}:${currency}`;
    const now = new Date();

    try {
      // Intentar obtener wallet desde cache Redis
      if (useCache) {
        const cachedWallet = await this.getWalletFromCache(cacheKey);
        if (cachedWallet) {
          await this.updateWalletUsage(cachedWallet.walletId, now);
          return cachedWallet;
        }
      }

      // Buscar wallet disponible usando LRS mejorado
      const wallet = await Wallet.findOneAndUpdate(
        {
          status: 'AVAILABLE',
          isActive: true,
          network,
          currency
        },
        {
          $set: {
            lastShownAt: now,
            lastUsedBy: userId
          },
          $inc: {
            shownCount: 1,
            usageCount: 1
          }
        },
        {
          sort: {
            shownCount: 1,
            lastShownAt: 1,
            usageCount: 1,
            _id: 1
          },
          new: true
        }
      ).lean();

      if (!wallet) {
        logger.error('No wallets available in pool', {
          network,
          currency,
          userId,
          amountUSDT
        });
        throw new Error('NO_WALLETS_AVAILABLE');
      }

      const result = {
        address: wallet.address,
        network: wallet.network,
        currency: wallet.currency,
        walletId: wallet._id.toString()
      };

      // Cache la wallet seleccionada
      if (useCache) {
        await this.cacheWallet(cacheKey, result);
      }

      // Log de selección
      logger.info('Wallet selected from pool', {
        walletId: wallet._id,
        address: wallet.address,
        shownCount: wallet.shownCount,
        usageCount: wallet.usageCount,
        userId,
        network,
        currency
      });

      // Verificar si necesita rotación automática
      await this.checkAndRotateIfNeeded(network, currency);

      return result;

    } catch (error) {
      logger.error('Error selecting wallet from pool', {
        error: error.message,
        userId,
        network,
        currency,
        amountUSDT
      });
      throw error;
    }
  }

  /**
   * Obtiene wallet desde cache Redis
   */
  async getWalletFromCache(cacheKey) {
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        const wallet = JSON.parse(cached);
        // Verificar que la wallet sigue disponible
        const isAvailable = await Wallet.findOne({
          _id: wallet.walletId,
          status: 'AVAILABLE',
          isActive: true
        }).lean();
        
        if (isAvailable) {
          return wallet;
        } else {
          // Limpiar cache si la wallet ya no está disponible
          await redis.del(cacheKey);
        }
      }
    } catch (error) {
      logger.warn('Error getting wallet from cache', { error: error.message });
    }
    return null;
  }

  /**
   * Cachea una wallet en Redis
   */
  async cacheWallet(cacheKey, wallet) {
    try {
      await redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(wallet));
    } catch (error) {
      logger.warn('Error caching wallet', { error: error.message });
    }
  }

  /**
   * Actualiza el uso de una wallet
   */
  async updateWalletUsage(walletId, timestamp) {
    try {
      await Wallet.findByIdAndUpdate(walletId, {
        $set: {
          lastShownAt: timestamp
        },
        $inc: {
          shownCount: 1,
          usageCount: 1
        }
      });
    } catch (error) {
      logger.warn('Error updating wallet usage', {
        walletId,
        error: error.message
      });
    }
  }

  /**
   * Verifica y rota wallets automáticamente si es necesario
   */
  async checkAndRotateIfNeeded(network, currency) {
    try {
      const stats = await this.getRotationStats(network, currency);
      
      if (stats.rotationBalance > this.ROTATION_THRESHOLD) {
        logger.info('Auto-rotating wallets due to imbalance', {
          network,
          currency,
          rotationBalance: stats.rotationBalance,
          threshold: this.ROTATION_THRESHOLD
        });
        
        await this.performAutoRotation(network, currency);
      }
    } catch (error) {
      logger.warn('Error in auto-rotation check', {
        error: error.message,
        network,
        currency
      });
    }
  }

  /**
   * Obtiene estadísticas de rotación
   */
  async getRotationStats(network, currency) {
    const [leastUsed, mostUsed] = await Promise.all([
      Wallet.findOne(
        { status: 'AVAILABLE', isActive: true, network, currency },
        { shownCount: 1, usageCount: 1 },
        { sort: { shownCount: 1, usageCount: 1, _id: 1 } }
      ).lean(),
      Wallet.findOne(
        { status: 'AVAILABLE', isActive: true, network, currency },
        { shownCount: 1, usageCount: 1 },
        { sort: { shownCount: -1, usageCount: -1, _id: -1 } }
      ).lean()
    ]);

    return {
      leastUsedCount: leastUsed?.shownCount || 0,
      mostUsedCount: mostUsed?.shownCount || 0,
      rotationBalance: (mostUsed?.shownCount || 0) - (leastUsed?.shownCount || 0)
    };
  }

  /**
   * Realiza rotación automática de wallets
   */
  async performAutoRotation(network, currency) {
    try {
      // Resetear contadores de las wallets más usadas
      const result = await Wallet.updateMany(
        {
          status: 'AVAILABLE',
          isActive: true,
          network,
          currency,
          shownCount: { $gte: this.ROTATION_THRESHOLD }
        },
        {
          $set: {
            shownCount: 0,
            lastShownAt: new Date(0) // Epoch para priorizar en próxima selección
          }
        }
      );

      logger.info('Auto-rotation completed', {
        network,
        currency,
        walletsRotated: result.modifiedCount
      });

      // Limpiar cache después de rotación
      const cacheKey = `wallet_pool:${network}:${currency}`;
      await redis.del(cacheKey);

    } catch (error) {
      logger.error('Error performing auto-rotation', {
        error: error.message,
        network,
        currency
      });
    }
  }

  /**
   * Obtiene estadísticas avanzadas del pool
   */
  async getAdvancedStats(network = 'BEP20', currency = 'USDT') {
    const [basicStats, rotationStats, recentUsage] = await Promise.all([
      this.getBasicStats(network, currency),
      this.getRotationStats(network, currency),
      this.getRecentUsageStats(network, currency)
    ]);

    return {
      ...basicStats,
      ...rotationStats,
      ...recentUsage,
      health: await this.checkAdvancedHealth(network, currency)
    };
  }

  /**
   * Obtiene estadísticas básicas
   */
  async getBasicStats(network, currency) {
    const stats = await Wallet.aggregate([
      {
        $match: {
          network,
          currency,
          isActive: true
        }
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalShown: { $sum: '$shownCount' },
          totalUsage: { $sum: '$usageCount' }
        }
      }
    ]);

    const result = {
      AVAILABLE: 0,
      DISABLED: 0,
      total: 0,
      totalShown: 0,
      totalUsage: 0
    };

    stats.forEach(stat => {
      result[stat._id] = stat.count;
      result.total += stat.count;
      result.totalShown += stat.totalShown || 0;
      result.totalUsage += stat.totalUsage || 0;
    });

    return result;
  }

  /**
   * Obtiene estadísticas de uso reciente
   */
  async getRecentUsageStats(network, currency) {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    
    const recentUsage = await Wallet.countDocuments({
      network,
      currency,
      isActive: true,
      lastShownAt: { $gte: oneHourAgo }
    });

    return {
      recentUsage,
      usageRate: recentUsage > 0 ? 'active' : 'low'
    };
  }

  /**
   * Verifica la salud avanzada del pool
   */
  async checkAdvancedHealth(network, currency) {
    const stats = await this.getBasicStats(network, currency);
    const rotationStats = await this.getRotationStats(network, currency);
    
    const health = {
      status: 'healthy',
      issues: [],
      recommendations: []
    };

    // Verificar wallets disponibles
    if (stats.AVAILABLE === 0) {
      health.status = 'critical';
      health.issues.push('NO_AVAILABLE_WALLETS');
      health.recommendations.push('Add new wallets to the pool immediately');
    } else if (stats.AVAILABLE < this.MIN_AVAILABLE_WALLETS) {
      health.status = health.status === 'critical' ? 'critical' : 'warning';
      health.issues.push('LOW_AVAILABLE_WALLETS');
      health.recommendations.push(`Add more wallets (minimum ${this.MIN_AVAILABLE_WALLETS})`);
    }

    // Verificar balance de rotación
    if (rotationStats.rotationBalance > this.ROTATION_THRESHOLD) {
      health.status = health.status === 'critical' ? 'critical' : 'warning';
      health.issues.push('UNBALANCED_ROTATION');
      health.recommendations.push('Consider manual rotation or adjust rotation threshold');
    }

    return health;
  }

  /**
   * Limpia cache de wallets
   */
  async clearCache(network = '*', currency = '*') {
    try {
      const pattern = `wallet_pool:${network}:${currency}`;
      const keys = await redis.keys(pattern);
      
      if (keys.length > 0) {
        await redis.del(...keys);
        logger.info('Wallet cache cleared', {
          pattern,
          keysCleared: keys.length
        });
      }
    } catch (error) {
      logger.error('Error clearing wallet cache', {
        error: error.message,
        network,
        currency
      });
    }
  }

  /**
   * Método de compatibilidad con versión anterior
   */
  async assign(params) {
    logger.warn('[WalletPoolV2] assign() is deprecated, use pick() instead');
    return this.pick(params);
  }
}

// Manejo de eventos Redis
redis.on('connect', () => {
  logger.info('Redis connected for wallet pool cache');
});

redis.on('error', (err) => {
  logger.error('Redis connection error for wallet pool', { error: err.message });
});

module.exports = new WalletPoolServiceV2();