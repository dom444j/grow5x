const mongoose = require('mongoose');

const roleSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    enum: ['user', 'admin', 'support', 'moderator', 'padre']
  },
  displayName: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  permissions: [{
    resource: {
      type: String,
      required: true,
      trim: true
    },
    actions: [{
      type: String,
      required: true,
      enum: ['create', 'read', 'update', 'delete', 'execute']
    }]
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  isSystem: {
    type: Boolean,
    default: false // System roles cannot be deleted
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true,
  collection: 'roles'
});

// Índices
roleSchema.index({ name: 1 }, { unique: true });
roleSchema.index({ isActive: 1 });
roleSchema.index({ createdAt: -1 });

// Métodos de instancia
roleSchema.methods.hasPermission = function(resource, action) {
  if (!this.isActive) return false;
  
  const permission = this.permissions.find(p => p.resource === resource);
  return permission && permission.actions.includes(action);
};

roleSchema.methods.addPermission = function(resource, actions) {
  const existingPermission = this.permissions.find(p => p.resource === resource);
  
  if (existingPermission) {
    // Merge actions, avoiding duplicates
    const newActions = [...new Set([...existingPermission.actions, ...actions])];
    existingPermission.actions = newActions;
  } else {
    this.permissions.push({ resource, actions });
  }
  
  return this;
};

roleSchema.methods.removePermission = function(resource, actions = null) {
  const permissionIndex = this.permissions.findIndex(p => p.resource === resource);
  
  if (permissionIndex === -1) return this;
  
  if (!actions) {
    // Remove entire resource permission
    this.permissions.splice(permissionIndex, 1);
  } else {
    // Remove specific actions
    const permission = this.permissions[permissionIndex];
    permission.actions = permission.actions.filter(action => !actions.includes(action));
    
    // If no actions left, remove the permission
    if (permission.actions.length === 0) {
      this.permissions.splice(permissionIndex, 1);
    }
  }
  
  return this;
};

// Métodos estáticos
roleSchema.statics.getDefaultRoles = function() {
  return [
    {
      name: 'user',
      displayName: 'Usuario',
      description: 'Usuario estándar con permisos básicos',
      permissions: [
        { resource: 'profile', actions: ['read', 'update'] },
        { resource: 'packages', actions: ['read'] },
        { resource: 'withdrawals', actions: ['create', 'read'] },
        { resource: 'referrals', actions: ['read'] }
      ],
      isSystem: true
    },
    {
      name: 'admin',
      displayName: 'Administrador',
      description: 'Administrador con acceso completo al sistema',
      permissions: [
        { resource: '*', actions: ['create', 'read', 'update', 'delete', 'execute'] }
      ],
      isSystem: true
    },
    {
      name: 'support',
      displayName: 'Soporte',
      description: 'Personal de soporte con permisos limitados',
      permissions: [
        { resource: 'users', actions: ['read', 'update'] },
        { resource: 'withdrawals', actions: ['read', 'update'] },
        { resource: 'packages', actions: ['read'] },
        { resource: 'referrals', actions: ['read'] }
      ],
      isSystem: true
    },
    {
      name: 'moderator',
      displayName: 'Moderador',
      description: 'Moderador con permisos de gestión de usuarios',
      permissions: [
        { resource: 'users', actions: ['read', 'update'] },
        { resource: 'packages', actions: ['read'] },
        { resource: 'referrals', actions: ['read'] },
        { resource: 'reports', actions: ['read'] }
      ],
      isSystem: true
    },
    {
      name: 'padre',
      displayName: 'Usuario Padre',
      description: 'Usuario especial con permisos de gestión de referidos',
      permissions: [
        { resource: 'profile', actions: ['read', 'update'] },
        { resource: 'packages', actions: ['read'] },
        { resource: 'withdrawals', actions: ['create', 'read'] },
        { resource: 'referrals', actions: ['read', 'create', 'update'] },
        { resource: 'users', actions: ['read'] }
      ],
      isSystem: true
    }
  ];
};

roleSchema.statics.findByName = function(name) {
  return this.findOne({ name: name.toLowerCase(), isActive: true });
};

roleSchema.statics.getActiveRoles = function() {
  return this.find({ isActive: true }).sort({ name: 1 });
};

// Middleware pre-save
roleSchema.pre('save', function(next) {
  if (this.isModified('name')) {
    this.name = this.name.toLowerCase();
  }
  next();
});

// Middleware pre-remove
roleSchema.pre('deleteOne', { document: true, query: false }, function(next) {
  if (this.isSystem) {
    const error = new Error('No se pueden eliminar roles del sistema');
    error.code = 'SYSTEM_ROLE_DELETE';
    return next(error);
  }
  next();
});

module.exports = mongoose.model('Role', roleSchema);