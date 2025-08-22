const express = require('express');
const { body, param } = require('express-validator');
const rateLimit = require('express-rate-limit');
const router = express.Router();

const iamController = require('../controllers/iamController');
const { authenticateToken } = require('../middleware/auth');
const { requireAdmin, requirePermission } = require('../middleware/rbac');
const { requireV1Admin, requireV1AdminOrSupport } = require('../middleware/v1Rbac');
const { DecimalCalc } = require('../utils/decimal');
const logger = require('../config/logger');

/**
 * Rate limiting para operaciones IAM
 */
const iamRateLimit = rateLimit({
  windowMs: DecimalCalc.multiply(15, DecimalCalc.multiply(60, 1000)), // 15 minutos
  max: 100, // máximo 100 requests por ventana
  message: {
    error: 'Demasiadas solicitudes IAM, intenta de nuevo más tarde',
    code: 'IAM_RATE_LIMIT'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting en desarrollo
    return process.env.NODE_ENV === 'development';
  }
});

/**
 * Rate limiting más estricto para operaciones críticas
 */
const criticalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 20, // máximo 20 requests por ventana
  message: {
    error: 'Demasiadas operaciones críticas, intenta de nuevo más tarde',
    code: 'CRITICAL_RATE_LIMIT'
  },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * Middleware de logging para auditoría
 */
const auditLogger = (req, res, next) => {
  const originalSend = res.send;
  
  res.send = function(data) {
    logger.info('IAM operation audit:', {
      adminId: req.user?.userId,
      method: req.method,
      endpoint: req.originalUrl,
      params: req.params,
      body: req.method !== 'GET' ? req.body : undefined,
      statusCode: res.statusCode,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    originalSend.call(this, data);
  };
  
  next();
};

/**
 * Validaciones para roles
 */
const roleValidation = [
  body('name')
    .isLength({ min: 2, max: 50 })
    .matches(/^[a-zA-Z0-9_-]+$/)
    .withMessage('El nombre del rol debe tener entre 2-50 caracteres y solo contener letras, números, guiones y guiones bajos'),
  body('displayName')
    .isLength({ min: 2, max: 100 })
    .withMessage('El nombre para mostrar debe tener entre 2-100 caracteres'),
  body('description')
    .optional()
    .isLength({ max: 500 })
    .withMessage('La descripción no puede exceder 500 caracteres'),
  body('permissions')
    .optional()
    .isArray()
    .withMessage('Los permisos deben ser un array'),
  body('permissions.*.resource')
    .optional()
    .isLength({ min: 1, max: 50 })
    .withMessage('El recurso debe tener entre 1-50 caracteres'),
  body('permissions.*.actions')
    .optional()
    .isArray()
    .withMessage('Las acciones deben ser un array'),
  body('permissions.*.actions.*')
    .optional()
    .isIn(['create', 'read', 'update', 'delete', 'execute'])
    .withMessage('Acción inválida')
];

const roleUpdateValidation = [
  body('displayName')
    .optional()
    .isLength({ min: 2, max: 100 })
    .withMessage('El nombre para mostrar debe tener entre 2-100 caracteres'),
  body('description')
    .optional()
    .isLength({ max: 500 })
    .withMessage('La descripción no puede exceder 500 caracteres'),
  body('permissions')
    .optional()
    .isArray()
    .withMessage('Los permisos deben ser un array'),
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive debe ser un booleano')
];

const userRoleValidation = [
  param('userId')
    .isMongoId()
    .withMessage('ID de usuario inválido'),
  body('role')
    .isLength({ min: 2, max: 50 })
    .matches(/^[a-zA-Z0-9_-]+$/)
    .withMessage('Nombre de rol inválido')
];

const roleNameValidation = [
  param('name')
    .isLength({ min: 2, max: 50 })
    .matches(/^[a-zA-Z0-9_-]+$/)
    .withMessage('Nombre de rol inválido')
];

// Aplicar middlewares globales
router.use(authenticateToken);
router.use(iamRateLimit);
router.use(auditLogger);

/**
 * @swagger
 * /api/v1/iam/roles:
 *   get:
 *     summary: Obtener todos los roles activos
 *     tags: [IAM]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de roles obtenida exitosamente
 *       403:
 *         description: Permisos insuficientes
 */
router.get('/roles', 
  requireV1AdminOrSupport,
  iamController.getRoles
);

/**
 * @swagger
 * /api/v1/iam/roles/{name}:
 *   get:
 *     summary: Obtener un rol específico por nombre
 *     tags: [IAM]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: name
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Rol obtenido exitosamente
 *       404:
 *         description: Rol no encontrado
 */
router.get('/roles/:name',
  requireV1AdminOrSupport,
  roleNameValidation,
  iamController.getRoleByName
);

/**
 * @swagger
 * /api/v1/iam/roles:
 *   post:
 *     summary: Crear un nuevo rol
 *     tags: [IAM]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - displayName
 *             properties:
 *               name:
 *                 type: string
 *               displayName:
 *                 type: string
 *               description:
 *                 type: string
 *               permissions:
 *                 type: array
 *     responses:
 *       201:
 *         description: Rol creado exitosamente
 *       409:
 *         description: El rol ya existe
 */
router.post('/roles',
  requireV1Admin,
  criticalRateLimit,
  roleValidation,
  iamController.createRole
);

/**
 * @swagger
 * /api/v1/iam/roles/{name}:
 *   put:
 *     summary: Actualizar un rol existente
 *     tags: [IAM]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: name
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Rol actualizado exitosamente
 *       403:
 *         description: No se pueden modificar roles del sistema
 */
router.put('/roles/:name',
  requireV1Admin,
  criticalRateLimit,
  roleNameValidation,
  roleUpdateValidation,
  iamController.updateRole
);

/**
 * @swagger
 * /api/v1/iam/roles/{name}:
 *   delete:
 *     summary: Eliminar un rol
 *     tags: [IAM]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: name
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Rol eliminado exitosamente
 *       403:
 *         description: No se pueden eliminar roles del sistema
 *       409:
 *         description: El rol está en uso
 */
router.delete('/roles/:name',
  requireV1Admin,
  criticalRateLimit,
  roleNameValidation,
  iamController.deleteRole
);

/**
 * @swagger
 * /api/v1/iam/users/{userId}/role:
 *   post:
 *     summary: Asignar rol a un usuario
 *     tags: [IAM]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - role
 *             properties:
 *               role:
 *                 type: string
 *     responses:
 *       200:
 *         description: Rol asignado exitosamente
 *       404:
 *         description: Usuario o rol no encontrado
 */
router.post('/users/:userId/role',
  requireV1Admin,
  criticalRateLimit,
  userRoleValidation,
  iamController.assignUserRole
);

/**
 * @swagger
 * /api/v1/iam/users/{userId}/role:
 *   get:
 *     summary: Obtener el rol de un usuario
 *     tags: [IAM]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Rol del usuario obtenido exitosamente
 *       404:
 *         description: Usuario no encontrado
 */
router.get('/users/:userId/role',
  requireV1AdminOrSupport,
  param('userId').isMongoId().withMessage('ID de usuario inválido'),
  iamController.getUserRole
);

/**
 * @swagger
 * /api/v1/iam/init:
 *   post:
 *     summary: Inicializar roles por defecto del sistema
 *     tags: [IAM]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Roles por defecto inicializados
 */
router.post('/init',
  requireV1Admin,
  criticalRateLimit,
  iamController.initializeDefaultRoles
);

/**
 * Middleware de manejo de errores específico para IAM
 */
router.use((error, req, res, next) => {
  logger.error('IAM route error:', {
    adminId: req.user?.userId,
    endpoint: req.originalUrl,
    method: req.method,
    error: error.message,
    stack: error.stack,
    ip: req.ip
  });
  
  if (error.code === 'SYSTEM_ROLE_DELETE' || error.code === 'SYSTEM_ROLE_MODIFICATION') {
    return res.status(403).json({
      success: false,
      error: error.message,
      code: error.code
    });
  }
  
  res.status(500).json({
    success: false,
    error: 'Error interno del servidor',
    code: 'IAM_INTERNAL_ERROR'
  });
});

module.exports = router;