const Cohort = require('../models/Cohort');
const logger = require('../config/logger');
const NodeCache = require('node-cache');

/**
 * Servicio de Cohortes - Gestión de feature flags y configuración por batch-id
 */

// Cache para cohortes (TTL: 5 minutos)
const cohortCache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

class CohortService {
  /**
   * Obtener cohorte por batch-id con cache
   * @param {string} batchId - ID del batch
   * @returns {Object|null} Cohorte o null si no existe
   */
  static async getCohortByBatchId(batchId) {
    try {
      if (!batchId) return null;
      
      const cacheKey = `cohort:${batchId.toLowerCase()}`;
      
      // Verificar cache
      let cohort = cohortCache.get(cacheKey);
      if (cohort) {
        return cohort;
      }
      
      // Buscar en base de datos
      cohort = await Cohort.findByBatchId(batchId);
      
      if (cohort) {
        // Guardar en cache
        cohortCache.set(cacheKey, cohort);
      }
      
      return cohort;
      
    } catch (error) {
      logger.error('Error fetching cohort by batch ID:', {
        batchId,
        error: error.message,
        stack: error.stack
      });
      return null;
    }
  }
  
  /**
   * Verificar si un feature flag está habilitado para una cohorte
   * @param {string} batchId - ID del batch
   * @param {string} flagName - Nombre del feature flag
   * @returns {boolean} True si está habilitado, false en caso contrario
   */
  static async isFeatureEnabled(batchId, flagName) {
    try {
      if (!batchId || !flagName) return false;
      
      const cohort = await this.getCohortByBatchId(batchId);
      
      if (!cohort || !cohort.isActive) {
        return false;
      }
      
      return cohort.featureFlags[flagName] === true;
      
    } catch (error) {
      logger.error('Error checking feature flag:', {
        batchId,
        flagName,
        error: error.message,
        stack: error.stack
      });
      return false;
    }
  }
  
  /**
   * Verificar si los packages están habilitados para una cohorte
   * @param {string} batchId - ID del batch
   * @returns {boolean} True si están habilitados
   */
  static async arePackagesEnabled(batchId) {
    return await this.isFeatureEnabled(batchId, 'FEATURE_COHORT_PACKAGES');
  }
  
  /**
   * Verificar si los withdrawals están habilitados para una cohorte
   * @param {string} batchId - ID del batch
   * @returns {boolean} True si están habilitados
   */
  static async areWithdrawalsEnabled(batchId) {
    return await this.isFeatureEnabled(batchId, 'FEATURE_COHORT_WITHDRAWALS');
  }
  
  /**
   * Obtener configuración de referidos para una cohorte
   * @param {string} batchId - ID del batch
   * @returns {Object|null} Configuración de referidos o null
   */
  static async getReferralConfig(batchId) {
    try {
      const cohort = await this.getCohortByBatchId(batchId);
      
      if (!cohort || !cohort.isActive) {
        return null;
      }
      
      return cohort.referralConfig;
      
    } catch (error) {
      logger.error('Error getting referral config:', {
        batchId,
        error: error.message,
        stack: error.stack
      });
      return null;
    }
  }
  
  /**
   * Obtener todos los feature flags de una cohorte
   * @param {string} batchId - ID del batch
   * @returns {Object|null} Feature flags o null
   */
  static async getFeatureFlags(batchId) {
    try {
      const cohort = await this.getCohortByBatchId(batchId);
      
      if (!cohort || !cohort.isActive) {
        return null;
      }
      
      return cohort.featureFlags;
      
    } catch (error) {
      logger.error('Error getting feature flags:', {
        batchId,
        error: error.message,
        stack: error.stack
      });
      return null;
    }
  }
  
  /**
   * Invalidar cache de una cohorte específica
   * @param {string} batchId - ID del batch
   */
  static invalidateCohortCache(batchId) {
    if (batchId) {
      const cacheKey = `cohort:${batchId.toLowerCase()}`;
      cohortCache.del(cacheKey);
      
      logger.info('Cohort cache invalidated:', { batchId });
    }
  }
  
  /**
   * Limpiar todo el cache de cohortes
   */
  static clearAllCache() {
    cohortCache.flushAll();
    logger.info('All cohort cache cleared');
  }
  
  /**
   * Obtener estadísticas del cache
   * @returns {Object} Estadísticas del cache
   */
  static getCacheStats() {
    return cohortCache.getStats();
  }
  
  /**
   * Middleware para verificar feature flags en rutas
   * @param {string} flagName - Nombre del feature flag a verificar
   * @returns {Function} Middleware de Express
   */
  static requireFeatureFlag(flagName) {
    return async (req, res, next) => {
      try {
        // Obtener batch-id del usuario o de los parámetros
        const batchId = req.user?.batchId || req.body?.batchId || req.params?.batchId || req.query?.batchId;
        
        if (!batchId) {
          return res.status(400).json({
            success: false,
            error: 'Batch ID requerido para verificar feature flags',
            code: 'BATCH_ID_REQUIRED'
          });
        }
        
        const isEnabled = await this.isFeatureEnabled(batchId, flagName);
        
        if (!isEnabled) {
          logger.warn('Feature flag disabled for cohort:', {
            userId: req.user?.userId,
            batchId,
            flagName,
            ip: req.ip
          });
          
          return res.status(403).json({
            success: false,
            error: 'Funcionalidad no disponible para esta cohorte',
            code: 'FEATURE_DISABLED_FOR_COHORT'
          });
        }
        
        // Añadir información de la cohorte al request
        req.cohort = await this.getCohortByBatchId(batchId);
        
        next();
        
      } catch (error) {
        logger.error('Error in feature flag middleware:', {
          userId: req.user?.userId,
          flagName,
          error: error.message,
          stack: error.stack
        });
        
        res.status(500).json({
          success: false,
          error: 'Error interno del servidor',
          code: 'FEATURE_FLAG_CHECK_ERROR'
        });
      }
    };
  }
  
  /**
   * Middleware para verificar packages habilitados
   * @returns {Function} Middleware de Express
   */
  static requirePackagesEnabled() {
    return this.requireFeatureFlag('FEATURE_COHORT_PACKAGES');
  }
  
  /**
   * Middleware para verificar withdrawals habilitados
   * @returns {Function} Middleware de Express
   */
  static requireWithdrawalsEnabled() {
    return this.requireFeatureFlag('FEATURE_COHORT_WITHDRAWALS');
  }
}

module.exports = CohortService;