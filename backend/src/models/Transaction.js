const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const transactionSchema = new mongoose.Schema({
  // Transaction Identification
  transactionId: {
    type: String,
    unique: true,
    default: () => `TXN_${uuidv4().replace(/-/g, '').substring(0, 12).toUpperCase()}`
  },
  
  // User Information
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Transaction Details
  type: {
    type: String,
    required: true,
    enum: [
      'purchase',           // License purchase
      'daily_benefit',      // Daily benefit payment
      'commission',         // Referral commission
      'withdrawal',         // User withdrawal
      'bonus',             // Special bonus
      'adjustment',        // Manual adjustment
      'refund'             // Refund
    ]
  },
  
  subtype: {
    type: String,
    enum: [
      'level1_commission',
      'level2_commission', 
      'level3_commission',
      'level4_commission',
      'level5_commission',
      'cycle_benefit',
      'special_bonus',
      'admin_adjustment'
    ]
  },
  
  // Amount Information
  amount: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    required: true,
    default: 'USDT'
  },
  
  // Balance Impact
  balanceType: {
    type: String,
    required: true,
    enum: ['available', 'commission', 'total']
  },
  
  balanceBefore: {
    type: Number,
    required: true,
    min: 0
  },
  balanceAfter: {
    type: Number,
    required: true,
    min: 0
  },
  
  // Status
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'cancelled'],
    default: 'completed'
  },
  
  // Reference Information
  referenceId: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'referenceModel'
  },
  referenceModel: {
    type: String,
    enum: ['Purchase', 'Commission', 'Withdrawal', 'BenefitLedger']
  },
  
  // Related Purchase (for benefits and commissions)
  relatedPurchase: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Purchase'
  },
  
  // Commission Specific Fields
  commissionLevel: {
    type: Number,
    min: 1,
    max: 5
  },
  commissionFromUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // Withdrawal Specific Fields
  withdrawalAddress: {
    type: String,
    trim: true
  },
  withdrawalTxHash: {
    type: String,
    trim: true
  },
  withdrawalFee: {
    type: Number,
    min: 0,
    default: 0
  },
  
  // Processing Information
  processedAt: {
    type: Date,
    default: Date.now
  },
  processedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // Metadata
  description: {
    type: String,
    trim: true
  },
  adminNotes: {
    type: String,
    trim: true
  },
  
  // System Information
  ipAddress: {
    type: String
  },
  userAgent: {
    type: String
  },
  
  // Blockchain Information (for withdrawals)
  blockchainNetwork: {
    type: String,
    enum: ['BEP20', 'ETH', 'POLYGON']
  },
  confirmationBlocks: {
    type: Number,
    min: 0
  },
  
  // Error Information
  errorMessage: {
    type: String
  },
  retryCount: {
    type: Number,
    default: 0,
    min: 0
  }
}, {
  timestamps: true
});

// Indexes
transactionSchema.index({ transactionId: 1 });
transactionSchema.index({ userId: 1, createdAt: -1 });
transactionSchema.index({ type: 1, status: 1 });
transactionSchema.index({ referenceId: 1, referenceModel: 1 });
transactionSchema.index({ relatedPurchase: 1 });
transactionSchema.index({ commissionFromUser: 1 });
transactionSchema.index({ processedAt: 1 });
transactionSchema.index({ withdrawalTxHash: 1 }, { sparse: true });
transactionSchema.index({ createdAt: 1 });

// Virtual for net amount (amount minus fees)
transactionSchema.virtual('netAmount').get(function() {
  return this.amount - (this.withdrawalFee || 0);
});

// Virtual for transaction direction
transactionSchema.virtual('direction').get(function() {
  const creditTypes = ['daily_benefit', 'commission', 'bonus', 'refund'];
  const debitTypes = ['purchase', 'withdrawal', 'adjustment'];
  
  if (creditTypes.includes(this.type)) return 'credit';
  if (debitTypes.includes(this.type)) return 'debit';
  return 'neutral';
});

// Method to mark as failed
transactionSchema.methods.markAsFailed = function(errorMessage) {
  this.status = 'failed';
  this.errorMessage = errorMessage;
  this.processedAt = new Date();
  
  return this.save();
};

// Method to mark as completed
transactionSchema.methods.markAsCompleted = function(txHash = null) {
  this.status = 'completed';
  this.processedAt = new Date();
  
  if (txHash) {
    this.withdrawalTxHash = txHash;
  }
  
  return this.save();
};

// Method to retry transaction
transactionSchema.methods.retry = function() {
  this.retryCount += 1;
  this.status = 'pending';
  this.errorMessage = undefined;
  
  return this.save();
};

// Static method to create benefit transaction
transactionSchema.statics.createBenefitTransaction = function(userId, amount, purchase, balanceBefore) {
  return this.create({
    userId,
    type: 'daily_benefit',
    subtype: 'cycle_benefit',
    amount,
    balanceType: 'available',
    balanceBefore,
    balanceAfter: balanceBefore + amount,
    relatedPurchase: purchase._id,
    description: `Daily benefit from ${purchase.packageId?.name || 'package'} license`,
    status: 'completed'
  });
};

// Static method to create commission transaction
transactionSchema.statics.createCommissionTransaction = function(userId, amount, level, fromUser, purchase, balanceBefore) {
  return this.create({
    userId,
    type: 'commission',
    subtype: `level${level}_commission`,
    amount,
    balanceType: 'commission',
    balanceBefore,
    balanceAfter: balanceBefore + amount,
    commissionLevel: level,
    commissionFromUser: fromUser,
    relatedPurchase: purchase._id,
    description: `Level ${level} commission from ${fromUser.firstName} ${fromUser.lastName}`,
    status: 'completed'
  });
};

// Static method to create withdrawal transaction
transactionSchema.statics.createWithdrawalTransaction = function(userId, amount, address, fee, balanceBefore) {
  return this.create({
    userId,
    type: 'withdrawal',
    amount: -(amount + fee), // Negative for debit
    balanceType: 'available',
    balanceBefore,
    balanceAfter: balanceBefore - amount - fee,
    withdrawalAddress: address,
    withdrawalFee: fee,
    description: `Withdrawal to ${address}`,
    status: 'pending'
  });
};

// Static method to get user transaction history
transactionSchema.statics.getUserHistory = function(userId, options = {}) {
  const {
    type,
    status,
    limit = 50,
    skip = 0,
    startDate,
    endDate
  } = options;
  
  const query = { userId };
  
  if (type) query.type = type;
  if (status) query.status = status;
  
  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) query.createdAt.$lte = new Date(endDate);
  }
  
  return this.find(query)
    .populate('commissionFromUser', 'firstName lastName')
    .populate('relatedPurchase', 'packageId')
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip(skip);
};

// Static method to get transaction summary
transactionSchema.statics.getUserSummary = function(userId) {
  return this.aggregate([
    { $match: { userId: new mongoose.Types.ObjectId(userId), status: 'completed' } },
    {
      $group: {
        _id: '$type',
        totalAmount: { $sum: '$amount' },
        count: { $sum: 1 }
      }
    }
  ]);
};

module.exports = mongoose.model('Transaction', transactionSchema);