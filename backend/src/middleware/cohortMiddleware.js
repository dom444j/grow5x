const CohortService = require('../services/cohortService');
const logger = require('../config/logger');

/**
 * Middleware para verificar feature flags de cohortes
 */

/**
 * Middleware para extraer batchId de diferentes fuentes
 * @param {Object} req - Request object
 * @returns {string|null} batchId encontrado
 */
function extractBatchId(req) {
  // Prioridad: params > body > query > user
  return req.params?.batchId || 
         req.body?.batchId || 
         req.query?.batchId || 
         req.user?.batchId || 
         req.user?.cohort ||
         null;
}

/**
 * Middleware genérico para verificar feature flags
 * @param {string} flagName - Nombre del feature flag
 * @param {Object} options - Opciones adicionales
 * @returns {Function} Middleware de Express
 */
function requireFeatureFlag(flagName, options = {}) {
  const {
    extractBatchIdFrom = 'auto', // 'auto', 'params', 'body', 'query', 'user'
    errorMessage = 'Funcionalidad no disponible para esta cohorte',
    errorCode = 'FEATURE_DISABLED_FOR_COHORT'
  } = options;
  
  return async (req, res, next) => {
    try {
      let batchId;
      
      // Extraer batchId según configuración
      switch (extractBatchIdFrom) {
        case 'params':
          batchId = req.params?.batchId;
          break;
        case 'body':
          batchId = req.body?.batchId;
          break;
        case 'query':
          batchId = req.query?.batchId;
          break;
        case 'user':
          batchId = req.user?.batchId || req.user?.cohort;
          break;
        case 'auto':
        default:
          batchId = extractBatchId(req);
          break;
      }
      
      if (!batchId) {
        return res.status(400).json({
          success: false,
          error: 'Batch ID requerido para verificar feature flags',
          code: 'BATCH_ID_REQUIRED'
        });
      }
      
      // Verificar feature flag
      const isEnabled = await CohortService.isFeatureEnabled(batchId, flagName);
      
      if (!isEnabled) {
        logger.warn('Feature flag disabled for cohort:', {
          userId: req.user?.userId,
          batchId,
          flagName,
          route: req.originalUrl,
          method: req.method,
          ip: req.ip
        });
        
        return res.status(403).json({
          success: false,
          error: errorMessage,
          code: errorCode,
          details: {
            batchId,
            flagName,
            enabled: false
          }
        });
      }
      
      // Obtener información completa de la cohorte y añadirla al request
      const cohort = await CohortService.getCohortByBatchId(batchId);
      req.cohort = cohort;
      req.batchId = batchId;
      
      logger.debug('Feature flag verified:', {
        userId: req.user?.userId,
        batchId,
        flagName,
        enabled: true,
        route: req.originalUrl
      });
      
      next();
      
    } catch (error) {
      logger.error('Error in feature flag middleware:', {
        userId: req.user?.userId,
        flagName,
        route: req.originalUrl,
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
 * Middleware para verificar si los packages están habilitados
 * @param {Object} options - Opciones de configuración
 * @returns {Function} Middleware de Express
 */
function requirePackagesEnabled(options = {}) {
  return requireFeatureFlag('FEATURE_COHORT_PACKAGES', {
    errorMessage: 'Los packages no están disponibles para esta cohorte',
    errorCode: 'PACKAGES_DISABLED_FOR_COHORT',
    ...options
  });
}

/**
 * Middleware para verificar si los withdrawals están habilitados
 * @param {Object} options - Opciones de configuración
 * @returns {Function} Middleware de Express
 */
function requireWithdrawalsEnabled(options = {}) {
  return requireFeatureFlag('FEATURE_COHORT_WITHDRAWALS', {
    errorMessage: 'Los withdrawals no están disponibles para esta cohorte',
    errorCode: 'WITHDRAWALS_DISABLED_FOR_COHORT',
    ...options
  });
}

/**
 * Middleware para añadir información de cohorte al request sin verificar flags
 * @param {Object} options - Opciones de configuración
 * @returns {Function} Middleware de Express
 */
function attachCohortInfo(options = {}) {
  const { required = false } = options;
  
  return async (req, res, next) => {
    try {
      const batchId = extractBatchId(req);
      
      if (!batchId) {
        if (required) {
          return res.status(400).json({
            success: false,
            error: 'Batch ID requerido',
            code: 'BATCH_ID_REQUIRED'
          });
        }
        return next();
      }
      
      // Obtener información de la cohorte
      const cohort = await CohortService.getCohortByBatchId(batchId);
      
      if (!cohort && required) {
        return res.status(400).json({
          success: false,
          error: 'Cohorte no encontrada',
          code: 'COHORT_NOT_FOUND'
        });
      }
      
      req.cohort = cohort;
      req.batchId = batchId;
      
      next();
      
    } catch (error) {
      logger.error('Error in attach cohort info middleware:', {
        userId: req.user?.userId,
        route: req.originalUrl,
        error: error.message,
        stack: error.stack
      });
      
      if (required) {
        res.status(500).json({
          success: false,
          error: 'Error interno del servidor',
          code: 'COHORT_INFO_ERROR'
        });
      } else {
        next();
      }
    }
  };
}

/**
 * Middleware para verificar múltiples feature flags
 * @param {Array} flagNames - Array de nombres de feature flags
 * @param {Object} options - Opciones de configuración
 * @returns {Function} Middleware de Express
 */
function requireMultipleFlags(flagNames, options = {}) {
  const { operator = 'AND' } = options; // 'AND' o 'OR'
  
  return async (req, res, next) => {
    try {
      const batchId = extractBatchId(req);
      
      if (!batchId) {
        return res.status(400).json({
          success: false,
          error: 'Batch ID requerido para verificar feature flags',
          code: 'BATCH_ID_REQUIRED'
        });
      }
      
      const flagResults = await Promise.all(
        flagNames.map(flagName => 
          CohortService.isFeatureEnabled(batchId, flagName)
        )
      );
      
      let isAllowed;
      if (operator === 'AND') {
        isAllowed = flagResults.every(result => result === true);
      } else {
        isAllowed = flagResults.some(result => result === true);
      }
      
      if (!isAllowed) {
        logger.warn('Multiple feature flags check failed:', {
          userId: req.user?.userId,
          batchId,
          flagNames,
          operator,
          results: flagResults,
          route: req.originalUrl,
          ip: req.ip
        });
        
        return res.status(403).json({
          success: false,
          error: 'Funcionalidad no disponible para esta cohorte',
          code: 'MULTIPLE_FLAGS_DISABLED',
          details: {
            batchId,
            flagNames,
            operator,
            results: flagNames.reduce((acc, flag, index) => {
              acc[flag] = flagResults[index];
              return acc;
            }, {})
          }
        });
      }
      
      // Añadir información de la cohorte al request
      const cohort = await CohortService.getCohortByBatchId(batchId);
      req.cohort = cohort;
      req.batchId = batchId;
      
      next();
      
    } catch (error) {
      logger.error('Error in multiple flags middleware:', {
        userId: req.user?.userId,
        flagNames,
        route: req.originalUrl,
        error: error.message,
        stack: error.stack
      });
      
      res.status(500).json({
        success: false,
        error: 'Error interno del servidor',
        code: 'MULTIPLE_FLAGS_CHECK_ERROR'
      });
    }
  };
}

module.exports = {
  requireFeatureFlag,
  requirePackagesEnabled,
  requireWithdrawalsEnabled,
  attachCohortInfo,
  requireMultipleFlags,
  extractBatchId
};