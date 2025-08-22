const express = require('express');
const { body, param, query } = require('express-validator');
const cohortController = require('../controllers/cohortController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

/**
 * Validaciones para cohortes
 */
const validateBatchId = [
  param('batchId')
    .isLength({ min: 3, max: 50 })
    .matches(/^[a-zA-Z0-9_-]+$/)
    .withMessage('Batch ID debe tener 3-50 caracteres alfanuméricos, guiones o guiones bajos')
];

const validateCreateCohort = [
  body('batchId')
    .isLength({ min: 3, max: 50 })
    .matches(/^[a-zA-Z0-9_-]+$/)
    .withMessage('Batch ID debe tener 3-50 caracteres alfanuméricos, guiones o guiones bajos'),
  
  body('name')
    .isLength({ min: 2, max: 100 })
    .trim()
    .withMessage('Nombre debe tener entre 2 y 100 caracteres'),
  
  body('description')
    .optional()
    .isLength({ max: 500 })
    .trim()
    .withMessage('Descripción no puede exceder 500 caracteres'),
  
  body('featureFlags.FEATURE_COHORT_PACKAGES')
    .optional()
    .isBoolean()
    .withMessage('FEATURE_COHORT_PACKAGES debe ser un booleano'),
  
  body('featureFlags.FEATURE_COHORT_WITHDRAWALS')
    .optional()
    .isBoolean()
    .withMessage('FEATURE_COHORT_WITHDRAWALS debe ser un booleano'),
  
  body('referralConfig.directLevel1Percentage')
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage('Porcentaje de referido directo nivel 1 debe estar entre 0 y 100'),
  
  body('referralConfig.specialParentCodePercentage')
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage('Porcentaje de código especial padre debe estar entre 0 y 100'),
  
  body('referralConfig.specialParentCodeDelayDays')
    .optional()
    .isInt({ min: 0, max: 365 })
    .withMessage('Días de retraso para código especial padre debe estar entre 0 y 365')
];

const validateUpdateCohort = [
  body('name')
    .optional()
    .isLength({ min: 2, max: 100 })
    .trim()
    .withMessage('Nombre debe tener entre 2 y 100 caracteres'),
  
  body('description')
    .optional()
    .isLength({ max: 500 })
    .trim()
    .withMessage('Descripción no puede exceder 500 caracteres'),
  
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive debe ser un booleano'),
  
  body('featureFlags.FEATURE_COHORT_PACKAGES')
    .optional()
    .isBoolean()
    .withMessage('FEATURE_COHORT_PACKAGES debe ser un booleano'),
  
  body('featureFlags.FEATURE_COHORT_WITHDRAWALS')
    .optional()
    .isBoolean()
    .withMessage('FEATURE_COHORT_WITHDRAWALS debe ser un booleano'),
  
  body('referralConfig.directLevel1Percentage')
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage('Porcentaje de referido directo nivel 1 debe estar entre 0 y 100'),
  
  body('referralConfig.specialParentCodePercentage')
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage('Porcentaje de código especial padre debe estar entre 0 y 100'),
  
  body('referralConfig.specialParentCodeDelayDays')
    .optional()
    .isInt({ min: 0, max: 365 })
    .withMessage('Días de retraso para código especial padre debe estar entre 0 y 365')
];

const validateUpdateFlags = [
  body('featureFlags')
    .isObject()
    .withMessage('featureFlags debe ser un objeto'),
  
  body('featureFlags.FEATURE_COHORT_PACKAGES')
    .optional()
    .isBoolean()
    .withMessage('FEATURE_COHORT_PACKAGES debe ser un booleano'),
  
  body('featureFlags.FEATURE_COHORT_WITHDRAWALS')
    .optional()
    .isBoolean()
    .withMessage('FEATURE_COHORT_WITHDRAWALS debe ser un booleano')
];

const validateQuery = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Página debe ser un número entero mayor a 0'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Límite debe ser un número entero entre 1 y 100'),
  
  query('search')
    .optional()
    .isLength({ min: 1, max: 100 })
    .trim()
    .withMessage('Búsqueda debe tener entre 1 y 100 caracteres')
];

/**
 * Rutas de cohortes
 * Todas requieren autenticación y rol de admin
 */

// GET /api/v1/cohorts - Obtener todas las cohortes
router.get('/', 
  authenticateToken,
  requireAdmin,
  validateQuery,
  cohortController.getCohorts
);

// GET /api/v1/cohorts/:batchId - Obtener cohorte por batch-id
router.get('/:batchId',
  authenticateToken,
  requireAdmin,
  validateBatchId,
  cohortController.getCohortByBatchId
);

// POST /api/v1/cohorts - Crear nueva cohorte
router.post('/',
  authenticateToken,
  requireAdmin,
  validateCreateCohort,
  cohortController.createCohort
);

// PUT /api/v1/cohorts/:batchId - Actualizar cohorte
router.put('/:batchId',
  authenticateToken,
  requireAdmin,
  validateBatchId,
  validateUpdateCohort,
  cohortController.updateCohort
);

// POST /api/v1/cohorts/:batchId/flags - Actualizar feature flags
router.post('/:batchId/flags',
  authenticateToken,
  requireAdmin,
  validateBatchId,
  validateUpdateFlags,
  cohortController.updateCohortFlags
);

// DELETE /api/v1/cohorts/:batchId - Desactivar cohorte
router.delete('/:batchId',
  authenticateToken,
  requireAdmin,
  validateBatchId,
  cohortController.deleteCohort
);

module.exports = router;