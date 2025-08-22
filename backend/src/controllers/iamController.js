const Role = require('../models/Role');
const User = require('../models/User');
const { clearRoleCache } = require('../middleware/rbac');
const logger = require('../config/logger');
const { validationResult } = require('express-validator');
const CacheInvalidationService = require('../services/cacheInvalidationService');

/**
 * Controlador IAM - Gestión de roles y permisos
 */

/**
 * GET /api/v1/iam/roles
 * Obtener todos los roles activos
 */
const getRoles = async (req, res) => {
  try {
    const roles = await Role.getActiveRoles();
    
    res.json({
      success: true,
      data: roles,
      total: roles.length
    });
    
  } catch (error) {
    logger.error('Error fetching roles:', {
      adminId: req.user?.userId,
      error: error.message,
      stack: error.stack
    });
    
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      code: 'FETCH_ROLES_ERROR'
    });
  }
};

/**
 * GET /api/v1/iam/roles/:name
 * Obtener un rol específico por nombre
 */
const getRoleByName = async (req, res) => {
  try {
    const { name } = req.params;
    
    const role = await Role.findByName(name);
    
    if (!role) {
      return res.status(404).json({
        success: false,
        error: 'Rol no encontrado',
        code: 'ROLE_NOT_FOUND'
      });
    }
    
    res.json({
      success: true,
      data: role
    });
    
  } catch (error) {
    logger.error('Error fetching role:', {
      adminId: req.user?.userId,
      roleName: req.params.name,
      error: error.message
    });
    
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      code: 'FETCH_ROLE_ERROR'
    });
  }
};

/**
 * POST /api/v1/iam/roles
 * Crear un nuevo rol
 */
const createRole = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Datos de entrada inválidos',
        code: 'VALIDATION_ERROR',
        details: errors.array()
      });
    }
    
    const { name, displayName, description, permissions } = req.body;
    
    // Verificar si el rol ya existe
    const existingRole = await Role.findOne({ name: name.toLowerCase() });
    if (existingRole) {
      return res.status(409).json({
        success: false,
        error: 'Ya existe un rol con ese nombre',
        code: 'ROLE_ALREADY_EXISTS'
      });
    }
    
    const role = new Role({
      name,
      displayName,
      description,
      permissions: permissions || [],
      createdBy: req.user.userId
    });
    
    await role.save();
    
    logger.info('Role created:', {
      adminId: req.user.userId,
      roleId: role._id,
      roleName: role.name,
      ip: req.ip
    });
    
    res.status(201).json({
      success: true,
      data: role,
      message: 'Rol creado exitosamente'
    });
    
  } catch (error) {
    logger.error('Error creating role:', {
      adminId: req.user?.userId,
      roleData: req.body,
      error: error.message,
      stack: error.stack
    });
    
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        error: 'Ya existe un rol con ese nombre',
        code: 'DUPLICATE_ROLE_NAME'
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      code: 'CREATE_ROLE_ERROR'
    });
  }
};

/**
 * PUT /api/v1/iam/roles/:name
 * Actualizar un rol existente
 */
const updateRole = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Datos de entrada inválidos',
        code: 'VALIDATION_ERROR',
        details: errors.array()
      });
    }
    
    const { name } = req.params;
    const { displayName, description, permissions, isActive } = req.body;
    
    const role = await Role.findOne({ name: name.toLowerCase() });
    
    if (!role) {
      return res.status(404).json({
        success: false,
        error: 'Rol no encontrado',
        code: 'ROLE_NOT_FOUND'
      });
    }
    
    // No permitir modificar roles del sistema
    if (role.isSystem) {
      return res.status(403).json({
        success: false,
        error: 'No se pueden modificar roles del sistema',
        code: 'SYSTEM_ROLE_MODIFICATION'
      });
    }
    
    // Actualizar campos
    if (displayName !== undefined) role.displayName = displayName;
    if (description !== undefined) role.description = description;
    if (permissions !== undefined) role.permissions = permissions;
    if (isActive !== undefined) role.isActive = isActive;
    
    role.updatedBy = req.user.userId;
    
    await role.save();
    
    // Limpiar cache de roles
    clearRoleCache();
    
    logger.info('Role updated:', {
      adminId: req.user.userId,
      roleId: role._id,
      roleName: role.name,
      changes: { displayName, description, permissions, isActive },
      ip: req.ip
    });
    
    res.json({
      success: true,
      data: role,
      message: 'Rol actualizado exitosamente'
    });
    
  } catch (error) {
    logger.error('Error updating role:', {
      adminId: req.user?.userId,
      roleName: req.params.name,
      updateData: req.body,
      error: error.message,
      stack: error.stack
    });
    
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      code: 'UPDATE_ROLE_ERROR'
    });
  }
};

/**
 * DELETE /api/v1/iam/roles/:name
 * Eliminar un rol
 */
const deleteRole = async (req, res) => {
  try {
    const { name } = req.params;
    
    const role = await Role.findOne({ name: name.toLowerCase() });
    
    if (!role) {
      return res.status(404).json({
        success: false,
        error: 'Rol no encontrado',
        code: 'ROLE_NOT_FOUND'
      });
    }
    
    // No permitir eliminar roles del sistema
    if (role.isSystem) {
      return res.status(403).json({
        success: false,
        error: 'No se pueden eliminar roles del sistema',
        code: 'SYSTEM_ROLE_DELETE'
      });
    }
    
    // Verificar si hay usuarios con este rol
    const usersWithRole = await User.countDocuments({ role: role.name });
    
    if (usersWithRole > 0) {
      return res.status(409).json({
        success: false,
        error: `No se puede eliminar el rol. ${usersWithRole} usuario(s) lo tienen asignado`,
        code: 'ROLE_IN_USE',
        usersCount: usersWithRole
      });
    }
    
    await role.deleteOne();
    
    // Limpiar cache de roles
    clearRoleCache();
    
    logger.info('Role deleted:', {
      adminId: req.user.userId,
      roleId: role._id,
      roleName: role.name,
      ip: req.ip
    });
    
    res.json({
      success: true,
      message: 'Rol eliminado exitosamente'
    });
    
  } catch (error) {
    logger.error('Error deleting role:', {
      adminId: req.user?.userId,
      roleName: req.params.name,
      error: error.message,
      stack: error.stack
    });
    
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      code: 'DELETE_ROLE_ERROR'
    });
  }
};

/**
 * POST /api/v1/iam/users/:userId/role
 * Asignar rol a un usuario
 */
const assignUserRole = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Datos de entrada inválidos',
        code: 'VALIDATION_ERROR',
        details: errors.array()
      });
    }
    
    const { userId } = req.params;
    const { role: roleName } = req.body;
    
    // Verificar que el usuario existe
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Usuario no encontrado',
        code: 'USER_NOT_FOUND'
      });
    }
    
    // Verificar que el rol existe
    const role = await Role.findByName(roleName);
    if (!role) {
      return res.status(404).json({
        success: false,
        error: 'Rol no encontrado',
        code: 'ROLE_NOT_FOUND'
      });
    }
    
    const previousRole = user.role;
    user.role = role.name;
    
    // Invalidar tokens existentes si el rol cambió
    if (previousRole !== role.name) {
      await user.invalidateTokens();
    } else {
      await user.save();
    }
    
    // Invalidar cache del usuario después del cambio de rol
    CacheInvalidationService.invalidateRoleCache(userId);
    
    logger.info('User role assigned:', {
      adminId: req.user.userId,
      userId: user._id,
      userEmail: user.email,
      previousRole,
      newRole: role.name,
      ip: req.ip
    });
    
    res.json({
      success: true,
      data: {
        userId: user._id,
        email: user.email,
        previousRole,
        newRole: role.name
      },
      message: 'Rol asignado exitosamente'
    });
    
  } catch (error) {
    logger.error('Error assigning user role:', {
      adminId: req.user?.userId,
      userId: req.params.userId,
      roleData: req.body,
      error: error.message,
      stack: error.stack
    });
    
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      code: 'ASSIGN_ROLE_ERROR'
    });
  }
};

/**
 * GET /api/v1/iam/users/:userId/role
 * Obtener el rol de un usuario
 */
const getUserRole = async (req, res) => {
  try {
    const { userId } = req.params;
    
    const user = await User.findById(userId).select('email role').lean();
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Usuario no encontrado',
        code: 'USER_NOT_FOUND'
      });
    }
    
    let roleDetails = null;
    if (user.role) {
      roleDetails = await Role.findByName(user.role);
    }
    
    res.json({
      success: true,
      data: {
        userId: user._id,
        email: user.email,
        role: user.role,
        roleDetails
      }
    });
    
  } catch (error) {
    logger.error('Error fetching user role:', {
      adminId: req.user?.userId,
      userId: req.params.userId,
      error: error.message
    });
    
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      code: 'FETCH_USER_ROLE_ERROR'
    });
  }
};

/**
 * POST /api/v1/iam/init
 * Inicializar roles por defecto del sistema
 */
const initializeDefaultRoles = async (req, res) => {
  try {
    const defaultRoles = Role.getDefaultRoles();
    const results = [];
    
    for (const roleData of defaultRoles) {
      const existingRole = await Role.findOne({ name: roleData.name });
      
      if (!existingRole) {
        const role = new Role({
          ...roleData,
          createdBy: req.user.userId
        });
        
        await role.save();
        results.push({ action: 'created', role: role.name });
      } else {
        results.push({ action: 'exists', role: roleData.name });
      }
    }
    
    logger.info('Default roles initialized:', {
      adminId: req.user.userId,
      results,
      ip: req.ip
    });
    
    res.json({
      success: true,
      data: results,
      message: 'Roles por defecto inicializados'
    });
    
  } catch (error) {
    logger.error('Error initializing default roles:', {
      adminId: req.user?.userId,
      error: error.message,
      stack: error.stack
    });
    
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      code: 'INIT_ROLES_ERROR'
    });
  }
};

module.exports = {
  getRoles,
  getRoleByName,
  createRole,
  updateRole,
  deleteRole,
  assignUserRole,
  getUserRole,
  initializeDefaultRoles
};