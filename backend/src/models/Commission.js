const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const commissionSchema = new mongoose.Schema({
  // Commission Identification
  commissionId: {
    type: String,
    unique: true,
    default: () => `COM_${uuidv4().replace(/-/g, '').substring(0, 12).toUpperCase()}`
  },
  
  // Commission Recipients and Source
  recipientUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  sourceUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Purchase Information
  purchaseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Purchase',
    required: true
  },
  packageId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Package',
    required: true
  },
  
  // Commission Details
  type: {
    type: String,
    required: true,
    enum: ['direct_referral', 'parent_bonus']
  },
  rate: {
    type: Number,
    required: true,
    min: 0,
    max: 1 // Percentage as decimal
  },
  baseAmount: {
    type: Number,
    required: true,
    min: 0
  },
  commissionAmount: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    required: true,
    default: 'USDT'
  },
  
  // Status and Timing
  status: {
    type: String,
    enum: ['pending', 'available', 'paid', 'cancelled'],
    default: 'pending'
  },
  
  // Unlock timing (D+9 for level 1, D+17 for levels 2-5)
  unlockDate: {
    type: Date,
    required: true
  },
  paidDate: {
    type: Date
  },
  
  // Related Transaction
  transactionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Transaction'
  },
  
  // Processing Information
  processedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // Metadata
  notes: {
    type: String,
    trim: true
  },
  
  // Referral Chain Information
  // Información adicional para debugging
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

// Indexes
commissionSchema.index({ commissionId: 1 });
commissionSchema.index({ recipientUserId: 1, status: 1 });
commissionSchema.index({ sourceUserId: 1 });
commissionSchema.index({ purchaseId: 1 });
commissionSchema.index({ type: 1 });
commissionSchema.index({ status: 1, unlockDate: 1 });
commissionSchema.index({ createdAt: 1 });
commissionSchema.index({ unlockDate: 1 });

// Virtual for days until unlock
commissionSchema.virtual('daysUntilUnlock').get(function() {
  if (this.status !== 'pending') return 0;
  const now = new Date();
  const diffTime = this.unlockDate - now;
  return Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
});

// Virtual for is unlocked
commissionSchema.virtual('isUnlocked').get(function() {
  return this.unlockDate <= new Date();
});

// Method to unlock commission
commissionSchema.methods.unlock = function() {
  if (this.status !== 'pending') {
    throw new Error('Commission is not in pending status');
  }
  
  if (!this.isUnlocked) {
    throw new Error('Commission unlock date has not been reached');
  }
  
  this.status = 'available';
  return this.save();
};

// Method to mark as paid
commissionSchema.methods.markAsPaid = function(transactionId) {
  if (this.status !== 'available') {
    throw new Error('Commission is not available for payment');
  }
  
  this.status = 'paid';
  this.paidDate = new Date();
  this.transactionId = transactionId;
  
  return this.save();
};

// Method to cancel commission
commissionSchema.methods.cancel = function(reason) {
  this.status = 'cancelled';
  this.notes = reason;
  
  return this.save();
};

// Static method to create commission
commissionSchema.statics.createCommission = function(data) {
  const {
    recipientUserId,
    sourceUserId,
    purchaseId,
    packageId,
    level,
    rate,
    baseAmount,
    referralChain = []
  } = data;
  
  // Calculate unlock date based on level
  const unlockDays = level === 1 ? 9 : 17;
  const unlockDate = new Date(Date.now() + unlockDays * 24 * 60 * 60 * 1000);
  
  return this.create({
    recipientUserId,
    sourceUserId,
    purchaseId,
    packageId,
    level,
    rate,
    baseAmount,
    commissionAmount: baseAmount * rate,
    unlockDate,
    referralChain
  });
};

// Static method to find commissions ready to unlock
commissionSchema.statics.findReadyToUnlock = function() {
  return this.find({
    status: 'pending',
    unlockDate: { $lte: new Date() }
  }).populate('recipientUserId sourceUserId purchaseId packageId');
};

// Static method to get user commission summary
commissionSchema.statics.getUserSummary = function(userId) {
  return this.aggregate([
    { $match: { recipientUserId: new mongoose.Types.ObjectId(userId) } },
    {
      $group: {
        _id: '$status',
        totalAmount: { $sum: '$commissionAmount' },
        count: { $sum: 1 }
      }
    }
  ]);
};

// Static method to get commission history for user
commissionSchema.statics.getUserHistory = function(userId, options = {}) {
  const {
    status,
    level,
    limit = 50,
    skip = 0,
    startDate,
    endDate
  } = options;
  
  const query = { recipientUserId: userId };
  
  if (status) query.status = status;
  if (level) query.level = level;
  
  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) query.createdAt.$lte = new Date(endDate);
  }
  
  return this.find(query)
    .populate('sourceUserId', 'firstName lastName email')
    .populate('packageId', 'name price')
    .populate('purchaseId', 'purchaseId totalAmount')
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip(skip);
};

// Static method to get commission statistics
commissionSchema.statics.getStatistics = function(options = {}) {
  const {
    startDate,
    endDate,
    level,
    status
  } = options;
  
  const matchStage = {};
  
  if (startDate || endDate) {
    matchStage.createdAt = {};
    if (startDate) matchStage.createdAt.$gte = new Date(startDate);
    if (endDate) matchStage.createdAt.$lte = new Date(endDate);
  }
  
  if (level) matchStage.level = level;
  if (status) matchStage.status = status;
  
  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: {
          level: '$level',
          status: '$status'
        },
        totalAmount: { $sum: '$commissionAmount' },
        count: { $sum: 1 },
        avgAmount: { $avg: '$commissionAmount' }
      }
    },
    {
      $sort: {
        '_id.level': 1,
        '_id.status': 1
      }
    }
  ]);
};

// Pre-save middleware to calculate commission amount
commissionSchema.pre('save', function(next) {
  if (this.isModified('baseAmount') || this.isModified('rate')) {
    this.commissionAmount = this.baseAmount * this.rate;
  }
  next();
});

module.exports = mongoose.model('Commission', commissionSchema);