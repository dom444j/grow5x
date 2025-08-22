const { requireRole, requirePermission, requireAdmin, requireAdminOrSupport } = require('./rbac');
const logger = require('../config/logger');

/**
 * Middleware RBAC específico para rutas /api/v1/*
 * Solo aplica control de acceso a las nuevas rutas v1 sin afectar funcionalidad existente
 */

/**
 * Middleware condicional que aplica RBAC solo a rutas v1
 */
function applyV1Rbac(rbacMiddleware) {
  return (req, res, next) => {
    // Solo aplicar RBAC a rutas que empiecen con /api/v1/
    if (req.originalUrl.startsWith('/api/v1/')) {
      return rbacMiddleware(req, res, next);
    }
    
    // Para todas las demás rutas, continuar sin verificación RBAC
    next();
  };
}

/**
 * Middleware para rutas v1 que requieren rol admin
 */
const requireV1Admin = applyV1Rbac(requireAdmin);

/**
 * Middleware para rutas v1 que requieren rol admin o support
 */
const requireV1AdminOrSupport = applyV1Rbac(requireAdminOrSupport);

/**
 * Middleware para rutas v1 que requieren roles específicos
 */
function requireV1Role(roles) {
  return applyV1Rbac(requireRole(roles));
}

/**
 * Middleware para rutas v1 que requieren permisos específicos
 */
function requireV1Permission(resource, action) {
  return applyV1Rbac(requirePermission(resource, action));
}

/**
 * Matriz de permisos para rutas v1 específicas
 */
const V1_ROUTE_PERMISSIONS = {
  // Importación de usuarios
  'POST /api/v1/users-import/upload': { roles: ['admin'], resource: 'users-import', action: 'create' },
  'POST /api/v1/users-import/:jobId/run': { roles: ['admin'], resource: 'users-import', action: 'execute' },
  'GET /api/v1/users-import/:jobId/status': { roles: ['admin', 'support'], resource: 'users-import', action: 'read' },
  'GET /api/v1/users-import/:jobId/report': { roles: ['admin', 'support'], resource: 'users-import', action: 'read' },
  'GET /api/v1/users-import/jobs': { roles: ['admin', 'support'], resource: 'users-import', action: 'read' },
  'GET /api/v1/users-import/health': { roles: ['admin', 'support'], resource: 'users-import', action: 'read' },
  
  // IAM
  'GET /api/v1/iam/roles': { roles: ['admin'], resource: 'iam', action: 'read' },
  'POST /api/v1/iam/roles': { roles: ['admin'], resource: 'iam', action: 'create' },
  'PUT /api/v1/iam/roles/:name': { roles: ['admin'], resource: 'iam', action: 'update' },
  'DELETE /api/v1/iam/roles/:name': { roles: ['admin'], resource: 'iam', action: 'delete' },
  'POST /api/v1/iam/users/:userId/role': { roles: ['admin'], resource: 'iam', action: 'update' },
  'GET /api/v1/iam/users/:userId/role': { roles: ['admin', 'support'], resource: 'iam', action: 'read' },
  'POST /api/v1/iam/init': { roles: ['admin'], resource: 'iam', action: 'execute' },
  
  // Cohortes
  'GET /api/v1/cohorts': { roles: ['admin', 'support'], resource: 'cohorts', action: 'read' },
  'GET /api/v1/cohorts/:batchId': { roles: ['admin', 'support'], resource: 'cohorts', action: 'read' },
  'POST /api/v1/cohorts': { roles: ['admin'], resource: 'cohorts', action: 'create' },
  'PUT /api/v1/cohorts/:batchId': { roles: ['admin'], resource: 'cohorts', action: 'update' },
  'DELETE /api/v1/cohorts/:batchId': { roles: ['admin'], resource: 'cohorts', action: 'delete' },
  'POST /api/v1/cohorts/:batchId/flags': { roles: ['admin'], resource: 'cohorts', action: 'update' },
  
  // Configuración centralizada
  'GET /api/v1/config': { roles: ['admin', 'support'], resource: 'config', action: 'read' },
  'PUT /api/v1/config': { roles: ['admin'], resource: 'config', action: 'update' },
  'POST /api/v1/config/reload': { roles: ['admin'], resource: 'config', action: 'execute' }
};

/**
 * Middleware automático que aplica permisos basado en la ruta y método
 */
function autoV1Rbac(req, res, next) {
  // Solo aplicar a rutas v1
  if (!req.originalUrl.startsWith('/api/v1/')) {
    return next();
  }
  
  const routeKey = `${req.method} ${req.route?.path || req.originalUrl}`;
  const permission = V1_ROUTE_PERMISSIONS[routeKey];
  
  if (!permission) {
    // Si no hay permisos definidos para esta ruta, permitir acceso
    logger.warn('No RBAC rules defined for v1 route:', {
      method: req.method,
      path: req.originalUrl,
      userId: req.user?.userId
    });
    return next();
  }
  
  // Aplicar verificación de rol
  const roleMiddleware = requireRole(permission.roles);
  roleMiddleware(req, res, next);
}

module.exports = {
  applyV1Rbac,
  requireV1Admin,
  requireV1AdminOrSupport,
  requireV1Role,
  requireV1Permission,
  autoV1Rbac,
  V1_ROUTE_PERMISSIONS
};