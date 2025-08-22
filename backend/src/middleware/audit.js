/**
 * Audit Middleware
 * Automatically logs sensitive admin actions
 */

const AuditLog = require('../models/AuditLog');
const logger = require('../config/logger');

/**
 * Middleware to capture and log admin actions
 * @param {string} action - The action being performed
 * @param {string} targetType - Type of target entity
 * @param {function} getTargetId - Function to extract target ID from req
 * @param {function} getDiff - Function to extract before/after diff
 */
function auditAction(action, targetType, getTargetId, getDiff = null) {
  return async (req, res, next) => {
    // Store original res.json to intercept response
    const originalJson = res.json;
    
    res.json = function(data) {
      // Call original json method first
      originalJson.call(this, data);
      
      // Only log if the operation was successful
      if (res.statusCode >= 200 && res.statusCode < 300) {
        // Extract audit information
        const actorId = req.user?._id;
        const targetId = getTargetId(req, data);
        const ip = req.ip || req.connection.remoteAddress;
        const userAgent = req.get('User-Agent') || 'Unknown';
        const notes = req.body?.notes || req.body?.reason || null;
        const requestId = req.headers['x-request-id'] || null;
        
        // Get diff if function provided
        let diff = {};
        if (getDiff && typeof getDiff === 'function') {
          try {
            diff = getDiff(req, data);
          } catch (error) {
            logger.warn('Failed to generate audit diff:', error.message);
          }
        }
        
        // Log the action asynchronously
        setImmediate(async () => {
          try {
            await AuditLog.logAction({
              actorId,
              action,
              targetId,
              targetType,
              diff,
              ip,
              userAgent,
              notes,
              requestId
            });
            
            logger.info('Audit log created', {
              action,
              targetId,
              targetType,
              actorId: req.user?.userId
            });
          } catch (error) {
            logger.error('Failed to create audit log:', {
              error: error.message,
              action,
              targetId,
              actorId: req.user?.userId
            });
          }
        });
      }
    };
    
    next();
  };
}

/**
 * Pre-built audit middleware for common actions
 */
const auditMiddleware = {
  // Payment confirmation/rejection
  paymentAction: auditAction(
    'payment_action',
    'Purchase',
    (req) => req.body.purchaseId,
    (req, data) => ({
      before: { status: 'CONFIRMING' },
      after: { 
        status: req.body.action === 'confirm' ? 'ACTIVE' : 'REJECTED',
        action: req.body.action,
        notes: req.body.notes
      }
    })
  ),
  
  // Withdrawal approval/completion/rejection
  withdrawalAction: (action) => auditAction(
    `withdrawal_${action}`,
    'Withdrawal',
    (req) => req.params.id,
    (req, data) => ({
      before: { status: 'pending' },
      after: { 
        status: action,
        notes: req.body.notes || req.body.reason
      }
    })
  ),
  
  // User role/status changes
  userChange: (changeType) => auditAction(
    `user_${changeType}_change`,
    'User',
    (req) => req.params.userId || req.body.userId,
    (req, data) => ({
      before: req.originalUser || {},
      after: req.body
    })
  ),
  
  // Package creation/updates
  packageAction: (action) => auditAction(
    `package_${action}`,
    'Package',
    (req, data) => data?.data?.package?.packageId || req.params.packageId,
    (req, data) => ({
      before: req.originalPackage || {},
      after: req.body
    })
  ),
  
  // Wallet creation/updates
  walletAction: (action) => auditAction(
    `wallet_${action}`,
    'Wallet',
    (req, data) => data?.data?.wallet?.walletId || req.params.walletId,
    (req, data) => ({
      before: req.originalWallet || {},
      after: req.body
    })
  )
};

/**
 * Middleware to capture original entity state before modification
 * Use this before the main handler to store the "before" state
 */
function captureOriginalState(Model, idField = 'id') {
  return async (req, res, next) => {
    try {
      const id = req.params[idField] || req.body[idField];
      if (id) {
        let original;
        if (idField === 'purchaseId') {
          original = await Model.findOne({ purchaseId: id }).lean();
        } else {
          original = await Model.findById(id).lean();
        }
        req.originalEntity = original;
        
        // Store in specific property based on model name
        const modelName = Model.modelName.toLowerCase();
        req[`original${Model.modelName}`] = original;
      }
    } catch (error) {
      logger.warn('Failed to capture original state:', error.message);
    }
    next();
  };
}

module.exports = {
  auditAction,
  auditMiddleware,
  captureOriginalState
};