const Role = require('../models/Role');
const User = require('../models/User');
const logger = require('../config/logger');

/**
 * Middleware RBAC (Role-Based Access Control)
 * Verifica permisos basados en roles sin modificar controladores existentes
 */

/**
 * Cache de roles para optimizar consultas
 */
const roleCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

/**
 * Obtiene el rol del usuario con cache
 */
async function getUserRole(userId) {
  const cacheKey = `user_role_${userId}`;
  const cached = roleCache.get(cacheKey);
  
  if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
    return cached.role;
  }
  
  try {
    // Buscar por userId (no por _id) como se especifica en las instrucciones
    const user = await User.findOne({ userId: userId })
      .select('userId email isAdmin role roles')
      .lean();
    
    if (!user) {
      return null;
    }
    
    // Verificar las tres formas de ser admin según las instrucciones
    const isAdmin = !!(user.isAdmin || 
                      user.role === 'admin' || 
                      (Array.isArray(user.roles) && user.roles.includes('admin')));
    
    let role = null;
    if (isAdmin) {
      // Si es admin por cualquiera de las tres formas, devolver rol admin
      role = await Role.findByName('admin');
    } else if (user.role) {
      // Si no es admin, usar el rol asignado
      role = await Role.findByName(user.role);
    }
    
    // Cache del resultado
    roleCache.set(cacheKey, {
      role,
      timestamp: Date.now()
    });
    
    return role;
  } catch (error) {
    logger.error('Error fetching user role:', {
        userId,
        error: error.message
      });
    return null;
  }
}

/**
 * Limpia el cache de roles
 */
function clearRoleCache(userId = null) {
  if (userId) {
    roleCache.delete(`user_role_${userId}`);
  } else {
    roleCache.clear();
  }
}

/**
 * Middleware para verificar si el usuario tiene un rol específico
 */
function requireRole(requiredRoles) {
  if (typeof requiredRoles === 'string') {
    requiredRoles = [requiredRoles];
  }
  
  return async (req, res, next) => {
    try {
      if (!req.user || !req.user.userId) {
        return res.status(401).json({
          error: 'Usuario no autenticado',
          code: 'UNAUTHORIZED'
        });
      }
      
      const userRole = await getUserRole(req.user.userId);
      
      if (!userRole) {
        return res.status(403).json({
          error: 'Usuario sin rol asignado',
          code: 'NO_ROLE_ASSIGNED'
        });
      }
      
      if (!requiredRoles.includes(userRole.name)) {
        logger.warn('Access denied - insufficient role:', {
          userId: req.user.userId,
          userRole: userRole.name,
          requiredRoles,
          endpoint: req.originalUrl,
          method: req.method,
          ip: req.ip
        });
        
        return res.status(403).json({
          error: 'Permisos insuficientes',
          code: 'INSUFFICIENT_ROLE',
          required: requiredRoles,
          current: userRole.name
        });
      }
      
      // Añadir información del rol al request
      req.userRole = userRole;
      next();
      
    } catch (error) {
      logger.error('RBAC middleware error:', {
        userId: req.user?.userId,
        error: error.message,
        stack: error.stack
      });
      
      res.status(500).json({
        error: 'Error interno del servidor',
        code: 'RBAC_ERROR'
      });
    }
  };
}

/**
 * Middleware para verificar permisos específicos sobre recursos
 */
function requirePermission(resource, action) {
  return async (req, res, next) => {
    try {
      if (!req.user || !req.user.userId) {
        return res.status(401).json({
          error: 'Usuario no autenticado',
          code: 'UNAUTHORIZED'
        });
      }
      
      const userRole = await getUserRole(req.user.userId);
      
      if (!userRole) {
        return res.status(403).json({
          error: 'Usuario sin rol asignado',
          code: 'NO_ROLE_ASSIGNED'
        });
      }
      
      // Verificar permiso específico o permiso global (*)
      const hasPermission = userRole.hasPermission(resource, action) || 
                           userRole.hasPermission('*', action);
      
      if (!hasPermission) {
        logger.warn('Access denied - insufficient permission:', {
          userId: req.user.userId,
          userRole: userRole.name,
          resource,
          action,
          endpoint: req.originalUrl,
          method: req.method,
          ip: req.ip
        });
        
        return res.status(403).json({
          error: 'Permisos insuficientes para esta acción',
          code: 'INSUFFICIENT_PERMISSION',
          required: { resource, action },
          role: userRole.name
        });
      }
      
      // Añadir información del rol al request
      req.userRole = userRole;
      next();
      
    } catch (error) {
      logger.error('Permission middleware error:', {
        userId: req.user?.userId,
        resource,
        action,
        error: error.message,
        stack: error.stack
      });
      
      res.status(500).json({
        error: 'Error interno del servidor',
        code: 'PERMISSION_ERROR'
      });
    }
  };
}

/**
 * Middleware para verificar si el usuario es administrador
 */
const requireAdmin = requireRole(['admin']);

/**
 * Middleware para verificar si el usuario es admin o support
 */
const requireAdminOrSupport = requireRole(['admin', 'support']);

/**
 * Middleware para verificar si el usuario puede acceder a recursos de usuarios
 */
const requireUserAccess = requirePermission('users', 'read');

/**
 * Función helper para verificar permisos programáticamente
 */
async function checkUserPermission(userId, resource, action) {
  try {
    const userRole = await getUserRole(userId);
    if (!userRole) return false;
    
    return userRole.hasPermission(resource, action) || 
           userRole.hasPermission('*', action);
  } catch (error) {
    logger.error('Error checking user permission:', {
      userId,
      resource,
      action,
      error: error.message
    });
    return false;
  }
}

/**
 * Función helper para verificar roles programáticamente
 */
async function checkUserRole(userId, requiredRoles) {
  if (typeof requiredRoles === 'string') {
    requiredRoles = [requiredRoles];
  }
  
  try {
    const userRole = await getUserRole(userId);
    if (!userRole) return false;
    
    return requiredRoles.includes(userRole.name);
  } catch (error) {
    logger.error('Error checking user role:', {
      userId,
      requiredRoles,
      error: error.message
    });
    return false;
  }
}

/**
 * Middleware simplificado para requerir permisos de administrador
 * Maneja las tres formas de ser admin: isAdmin, role='admin', roles.includes('admin')
 */
function requireAdminSimplified(req, res, next) {
  if (!req.user || !req.user.userId) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }

  // Verificar directamente en el objeto user las tres formas de ser admin
  const user = req.user;
  const isAdmin = !!(user.isAdmin || 
                    user.role === 'admin' || 
                    (Array.isArray(user.roles) && user.roles.includes('admin')));

  if (!isAdmin) {
    logger.warn('Access denied - insufficient permissions:', {
      userId: user.userId,
      email: user.email,
      role: user.role,
      isAdmin: user.isAdmin,
      roles: user.roles,
      endpoint: req.originalUrl,
      method: req.method,
      ip: req.ip
    });
    
    return res.status(403).json({
      success: false,
      message: 'Insufficient permissions - admin access required'
    });
  }

  logger.info('Admin access granted:', {
    userId: user.userId,
    email: user.email,
    endpoint: req.originalUrl,
    method: req.method
  });

  next();
}

module.exports = {
  requireRole,
  requirePermission,
  requireAdmin,
  requireAdminSimplified,
  requireAdminOrSupport,
  requireUserAccess,
  checkUserPermission,
  checkUserRole,
  clearRoleCache,
  getUserRole
};