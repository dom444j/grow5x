const CohortService = require('../services/cohortService');
const User = require('../models/User');
const logger = require('../config/logger');

/**
 * Middleware para verificar feature flags por cohorte
 * Integra automáticamente las verificaciones en rutas específicas
 */

/**
 * Middleware para verificar si el feature de packages está habilitado para la cohorte del usuario
 */
const requirePackagesFeature = async (req, res, next) => {
  try {
    // Obtener el usuario de la request
    let userId = req.user?.id || req.user?._id;
    
    // Si no hay usuario en req.user, intentar obtenerlo del token
    if (!userId && req.headers.authorization) {
      const token = req.headers.authorization.replace('Bearer ', '');
      // Aquí deberías decodificar el token para obtener el userId
      // Por ahora, asumimos que req.user ya está disponible
    }
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Usuario no autenticado'
      });
    }
    
    // Obtener información del usuario
    const user = await User.findById(userId).select('cohort isActive');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }
    
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Usuario inactivo'
      });
    }
    
    // Si el usuario no tiene cohorte, permitir acceso (comportamiento por defecto)
    if (!user.cohort) {
      logger.info(`User ${userId} has no cohort, allowing packages access by default`);
      return next();
    }
    
    // Verificar si el feature de packages está habilitado para la cohorte
    const isEnabled = await CohortService.isPackagesEnabled(user.cohort);
    
    if (!isEnabled) {
      logger.warn(`Packages feature disabled for user ${userId} in cohort ${user.cohort}`);
      return res.status(403).json({
        success: false,
        message: 'La funcionalidad de packages no está disponible para tu cohorte',
        feature: 'packages',
        cohort: user.cohort
      });
    }
    
    // Añadir información de cohorte a la request para uso posterior
    req.cohortInfo = {
      batchId: user.cohort,
      packagesEnabled: true
    };
    
    logger.debug(`Packages feature verified for user ${userId} in cohort ${user.cohort}`);
    next();
    
  } catch (error) {
    logger.error('Error checking packages feature flag:', {
      userId: req.user?.id,
      error: error.message,
      stack: error.stack
    });
    
    // En caso de error, permitir acceso para no bloquear la funcionalidad
    logger.warn('Allowing packages access due to feature flag check error');
    next();
  }
};

/**
 * Middleware para verificar si el feature de withdrawals está habilitado para la cohorte del usuario
 */
const requireWithdrawalsFeature = async (req, res, next) => {
  try {
    // Obtener el usuario de la request
    let userId = req.user?.id || req.user?._id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Usuario no autenticado'
      });
    }
    
    // Obtener información del usuario
    const user = await User.findById(userId).select('cohort isActive');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }
    
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Usuario inactivo'
      });
    }
    
    // Si el usuario no tiene cohorte, permitir acceso (comportamiento por defecto)
    if (!user.cohort) {
      logger.info(`User ${userId} has no cohort, allowing withdrawals access by default`);
      return next();
    }
    
    // Verificar si el feature de withdrawals está habilitado para la cohorte
    const isEnabled = await CohortService.isWithdrawalsEnabled(user.cohort);
    
    if (!isEnabled) {
      logger.warn(`Withdrawals feature disabled for user ${userId} in cohort ${user.cohort}`);
      return res.status(403).json({
        success: false,
        message: 'La funcionalidad de retiros no está disponible para tu cohorte',
        feature: 'withdrawals',
        cohort: user.cohort
      });
    }
    
    // Añadir información de cohorte a la request para uso posterior
    req.cohortInfo = {
      ...req.cohortInfo,
      batchId: user.cohort,
      withdrawalsEnabled: true
    };
    
    logger.debug(`Withdrawals feature verified for user ${userId} in cohort ${user.cohort}`);
    next();
    
  } catch (error) {
    logger.error('Error checking withdrawals feature flag:', {
      userId: req.user?.id,
      error: error.message,
      stack: error.stack
    });
    
    // En caso de error, permitir acceso para no bloquear la funcionalidad
    logger.warn('Allowing withdrawals access due to feature flag check error');
    next();
  }
};

/**
 * Middleware genérico para verificar cualquier feature flag
 */
const requireFeatureFlag = (flagName) => {
  return async (req, res, next) => {
    try {
      let userId = req.user?.id || req.user?._id;
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Usuario no autenticado'
        });
      }
      
      const user = await User.findById(userId).select('cohort isActive');
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Usuario no encontrado'
        });
      }
      
      if (!user.isActive) {
        return res.status(403).json({
          success: false,
          message: 'Usuario inactivo'
        });
      }
      
      // Si el usuario no tiene cohorte, permitir acceso por defecto
      if (!user.cohort) {
        logger.info(`User ${userId} has no cohort, allowing ${flagName} access by default`);
        return next();
      }
      
      // Verificar el feature flag específico
      const isEnabled = await CohortService.isFeatureFlagEnabled(user.cohort, flagName);
      
      if (!isEnabled) {
        logger.warn(`Feature ${flagName} disabled for user ${userId} in cohort ${user.cohort}`);
        return res.status(403).json({
          success: false,
          message: `La funcionalidad ${flagName} no está disponible para tu cohorte`,
          feature: flagName,
          cohort: user.cohort
        });
      }
      
      // Añadir información de cohorte a la request
      req.cohortInfo = {
        ...req.cohortInfo,
        batchId: user.cohort,
        [flagName + 'Enabled']: true
      };
      
      logger.debug(`Feature ${flagName} verified for user ${userId} in cohort ${user.cohort}`);
      next();
      
    } catch (error) {
      logger.error(`Error checking feature flag ${flagName}:`, {
        userId: req.user?.id,
        error: error.message,
        stack: error.stack
      });
      
      // En caso de error, permitir acceso para no bloquear la funcionalidad
      logger.warn(`Allowing ${flagName} access due to feature flag check error`);
      next();
    }
  };
};

/**
 * Middleware para añadir información de cohorte sin verificar feature flags
 */
const attachCohortInfo = async (req, res, next) => {
  try {
    let userId = req.user?.id || req.user?._id;
    
    if (!userId) {
      return next(); // Continuar sin información de cohorte
    }
    
    const user = await User.findById(userId).select('cohort');
    if (user && user.cohort) {
      // Obtener configuración completa de la cohorte
      const cohortConfig = await CohortService.getAllFeatureFlags(user.cohort);
      const referralConfig = await CohortService.getReferralConfig(user.cohort);
      
      req.cohortInfo = {
        batchId: user.cohort,
        featureFlags: cohortConfig,
        referralConfig: referralConfig
      };
      
      logger.debug(`Cohort info attached for user ${userId}: ${user.cohort}`);
    }
    
    next();
    
  } catch (error) {
    logger.error('Error attaching cohort info:', {
      userId: req.user?.id,
      error: error.message
    });
    
    // Continuar sin información de cohorte en caso de error
    next();
  }
};

/**
 * Middleware para verificar múltiples feature flags con operador AND/OR
 */
const requireMultipleFlags = (flags, operator = 'AND') => {
  return async (req, res, next) => {
    try {
      let userId = req.user?.id || req.user?._id;
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Usuario no autenticado'
        });
      }
      
      const user = await User.findById(userId).select('cohort isActive');
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Usuario no encontrado'
        });
      }
      
      if (!user.isActive) {
        return res.status(403).json({
          success: false,
          message: 'Usuario inactivo'
        });
      }
      
      // Si el usuario no tiene cohorte, permitir acceso por defecto
      if (!user.cohort) {
        logger.info(`User ${userId} has no cohort, allowing access to ${flags.join(', ')} by default`);
        return next();
      }
      
      // Verificar cada feature flag
      const flagResults = await Promise.all(
        flags.map(async (flag) => {
          const isEnabled = await CohortService.isFeatureFlagEnabled(user.cohort, flag);
          return { flag, enabled: isEnabled };
        })
      );
      
      // Aplicar operador lógico
      let accessGranted;
      if (operator === 'AND') {
        accessGranted = flagResults.every(result => result.enabled);
      } else if (operator === 'OR') {
        accessGranted = flagResults.some(result => result.enabled);
      } else {
        throw new Error(`Invalid operator: ${operator}. Use 'AND' or 'OR'`);
      }
      
      if (!accessGranted) {
        const disabledFlags = flagResults.filter(result => !result.enabled).map(result => result.flag);
        logger.warn(`Multiple flags check failed for user ${userId} in cohort ${user.cohort}. Disabled: ${disabledFlags.join(', ')}`);
        
        return res.status(403).json({
          success: false,
          message: `Acceso denegado. Funcionalidades requeridas no disponibles para tu cohorte`,
          requiredFlags: flags,
          operator: operator,
          disabledFlags: disabledFlags,
          cohort: user.cohort
        });
      }
      
      // Añadir información de cohorte a la request
      req.cohortInfo = {
        ...req.cohortInfo,
        batchId: user.cohort,
        verifiedFlags: flagResults
      };
      
      logger.debug(`Multiple flags verified for user ${userId} in cohort ${user.cohort}: ${flags.join(', ')}`);
      next();
      
    } catch (error) {
      logger.error('Error checking multiple feature flags:', {
        userId: req.user?.id,
        flags: flags,
        operator: operator,
        error: error.message,
        stack: error.stack
      });
      
      // En caso de error, permitir acceso para no bloquear la funcionalidad
      logger.warn(`Allowing access to ${flags.join(', ')} due to feature flag check error`);
      next();
    }
  };
};

module.exports = {
  requirePackagesFeature,
  requireWithdrawalsFeature,
  requireFeatureFlag,
  attachCohortInfo,
  requireMultipleFlags
};