/**
 * AuditLog Model
 * Tracks all sensitive admin actions for compliance and security
 */

const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  // Actor who performed the action
  actorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  // Action performed
  action: {
    type: String,
    required: true,
    enum: [
      'payment_confirm',
      'payment_reject',
      'withdrawal_approve',
      'withdrawal_complete',
      'withdrawal_reject',
      'user_role_change',
      'user_status_change',
      'package_create',
      'package_update',
      'wallet_create',
      'wallet_update',
      'system_config_change',
      'report_export'
    ],
    index: true
  },
  
  // Target entity affected by the action
  targetId: {
    type: String,
    required: true,
    index: true
  },
  
  // Target entity type
  targetType: {
    type: String,
    required: true,
    enum: ['Purchase', 'Withdrawal', 'User', 'Package', 'Wallet', 'Config', 'Report']
  },
  
  // Changes made (before/after diff)
  diff: {
    before: mongoose.Schema.Types.Mixed,
    after: mongoose.Schema.Types.Mixed
  },
  
  // Request metadata
  metadata: {
    ip: {
      type: String,
      required: true
    },
    userAgent: {
      type: String,
      required: true
    },
    notes: String, // Admin notes/reason
    requestId: String // For tracing
  },
  
  // Timestamp
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true,
  collection: 'audit_logs'
});

// Compound indexes for efficient queries
auditLogSchema.index({ actorId: 1, timestamp: -1 });
auditLogSchema.index({ action: 1, timestamp: -1 });
auditLogSchema.index({ targetId: 1, targetType: 1 });

// Static method to create audit log entry
auditLogSchema.statics.logAction = async function({
  actorId,
  action,
  targetId,
  targetType,
  diff = {},
  ip,
  userAgent,
  notes = null,
  requestId = null
}) {
  try {
    const auditLog = new this({
      actorId,
      action,
      targetId,
      targetType,
      diff,
      metadata: {
        ip,
        userAgent,
        notes,
        requestId
      }
    });
    
    await auditLog.save();
    return auditLog;
  } catch (error) {
    // Log error but don't fail the main operation
    console.error('Failed to create audit log:', error);
    return null;
  }
};

// Static method to get audit trail for a target
auditLogSchema.statics.getAuditTrail = async function(targetId, targetType, limit = 50) {
  return this.find({ targetId, targetType })
    .populate('actorId', 'userId email firstName lastName')
    .sort({ timestamp: -1 })
    .limit(limit)
    .lean();
};

// Static method to get admin activity
auditLogSchema.statics.getAdminActivity = async function(actorId, limit = 100) {
  return this.find({ actorId })
    .sort({ timestamp: -1 })
    .limit(limit)
    .lean();
};

module.exports = mongoose.model('AuditLog', auditLogSchema);