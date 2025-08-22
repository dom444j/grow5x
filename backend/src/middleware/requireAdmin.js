const User = require('../models/User');
const logger = require('../config/logger');

/**
 * Middleware unificado para requerir permisos de administrador
 * Maneja las tres formas de ser admin: isAdmin === true, role === 'admin', roles.includes('admin')
 * Busca al usuario por userId (no por _id)
 */
module.exports = async (req, res, next) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ 
        error: 'UNAUTHENTICATED',
        message: 'Authentication required'
      });
    }

    const user = await User.findOne({ userId: req.userId })
      .select('userId email isAdmin role roles');

    if (!user) {
      return res.status(401).json({ 
        error: 'UNAUTHENTICATED',
        message: 'User not found'
      });
    }

    // Verificar las tres formas de ser admin según las instrucciones
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
        error: 'FORBIDDEN', 
        code: 'NO_ROLE_ASSIGNED',
        message: 'Insufficient permissions - admin access required'
      });
    }

    // Agregar información del admin al request
    req.admin = { 
      userId: user.userId, 
      email: user.email 
    };

    logger.info('Admin access granted:', {
      userId: user.userId,
      email: user.email,
      endpoint: req.originalUrl,
      method: req.method
    });

    next();
  } catch (error) {
    logger.error('Error in requireAdmin middleware:', {
      error: error.message,
      stack: error.stack,
      userId: req.userId
    });
    next(error);
  }
};