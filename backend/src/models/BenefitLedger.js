const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const benefitLedgerSchema = new mongoose.Schema({
  // Benefit Identification
  benefitId: {
    type: String,
    unique: true,
    default: () => `BEN_${uuidv4().replace(/-/g, '').substring(0, 12).toUpperCase()}`
  },
  
  // User and Purchase Information
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
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
  
  // Benefit Details
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    required: true,
    default: 'USDT'
  },
  
  // Cycle and Day Information
  cycle: {
    type: Number,
    required: true,
    min: 1
  },
  day: {
    type: Number,
    required: true,
    min: 1
  },
  
  // Benefit Configuration
  dailyRate: {
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
  
  // Status and Processing
  status: {
    type: String,
    enum: ['pending', 'processed', 'failed', 'cancelled'],
    default: 'processed'
  },
  
  processedAt: {
    type: Date,
    default: Date.now
  },
  
  // Related Transaction
  transactionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Transaction'
  },
  
  // Scheduled Information
  scheduledDate: {
    type: Date,
    required: true
  },
  
  // Processing Information
  processedBy: {
    type: String,
    enum: ['system', 'admin', 'cron'],
    default: 'cron'
  },
  
  // Error Information
  errorMessage: {
    type: String
  },
  retryCount: {
    type: Number,
    default: 0,
    min: 0
  },
  
  // Metadata
  notes: {
    type: String,
    trim: true
  },
  
  // Balance Information
  balanceBefore: {
    type: Number,
    min: 0
  },
  balanceAfter: {
    type: Number,
    min: 0
  }
}, {
  timestamps: true
});

// Indexes
benefitLedgerSchema.index({ benefitId: 1 });
benefitLedgerSchema.index({ userId: 1, createdAt: -1 });
benefitLedgerSchema.index({ purchaseId: 1, cycle: 1, day: 1 });
benefitLedgerSchema.index({ status: 1 });
benefitLedgerSchema.index({ scheduledDate: 1 });
benefitLedgerSchema.index({ processedAt: 1 });
benefitLedgerSchema.index({ transactionId: 1 });

// Compound index for unique benefit per purchase/cycle/day
benefitLedgerSchema.index(
  { purchaseId: 1, cycle: 1, day: 1 },
  { unique: true }
);

// Virtual for benefit description
benefitLedgerSchema.virtual('description').get(function() {
  return `Cycle ${this.cycle}, Day ${this.day} benefit`;
});

// Virtual for is overdue
benefitLedgerSchema.virtual('isOverdue').get(function() {
  return this.status === 'pending' && this.scheduledDate < new Date();
});

// Method to mark as processed
benefitLedgerSchema.methods.markAsProcessed = function(transactionId, balanceBefore, balanceAfter) {
  this.status = 'processed';
  this.processedAt = new Date();
  this.transactionId = transactionId;
  this.balanceBefore = balanceBefore;
  this.balanceAfter = balanceAfter;
  
  return this.save();
};

// Method to mark as failed
benefitLedgerSchema.methods.markAsFailed = function(errorMessage) {
  this.status = 'failed';
  this.errorMessage = errorMessage;
  this.retryCount += 1;
  
  return this.save();
};

// Method to retry processing
benefitLedgerSchema.methods.retry = function() {
  if (this.retryCount >= 3) {
    throw new Error('Maximum retry attempts reached');
  }
  
  this.status = 'pending';
  this.errorMessage = undefined;
  
  return this.save();
};

// Static method to create benefit entry
benefitLedgerSchema.statics.createBenefit = function(data) {
  const {
    userId,
    purchaseId,
    packageId,
    amount,
    cycle,
    day,
    dailyRate,
    baseAmount,
    scheduledDate
  } = data;
  
  return this.create({
    userId,
    purchaseId,
    packageId,
    amount,
    cycle,
    day,
    dailyRate,
    baseAmount,
    scheduledDate: scheduledDate || new Date()
  });
};

// Static method to find pending benefits
benefitLedgerSchema.statics.findPending = function(beforeDate = new Date()) {
  return this.find({
    status: 'pending',
    scheduledDate: { $lte: beforeDate }
  }).populate('userId purchaseId packageId');
};

// Static method to find failed benefits that can be retried
benefitLedgerSchema.statics.findRetryable = function() {
  return this.find({
    status: 'failed',
    retryCount: { $lt: 3 }
  }).populate('userId purchaseId packageId');
};

// Static method to get user benefit history
benefitLedgerSchema.statics.getUserHistory = function(userId, options = {}) {
  const {
    purchaseId,
    status,
    limit = 50,
    skip = 0,
    startDate,
    endDate
  } = options;
  
  const query = { userId };
  
  if (purchaseId) query.purchaseId = purchaseId;
  if (status) query.status = status;
  
  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) query.createdAt.$lte = new Date(endDate);
  }
  
  return this.find(query)
    .populate('purchaseId', 'purchaseId totalAmount')
    .populate('packageId', 'name')
    .sort({ cycle: -1, day: -1 })
    .limit(limit)
    .skip(skip);
};

// Static method to get benefit statistics
benefitLedgerSchema.statics.getStatistics = function(options = {}) {
  const {
    userId,
    purchaseId,
    startDate,
    endDate,
    status = 'processed'
  } = options;
  
  const matchStage = { status };
  
  if (userId) matchStage.userId = new mongoose.Types.ObjectId(userId);
  if (purchaseId) matchStage.purchaseId = new mongoose.Types.ObjectId(purchaseId);
  
  if (startDate || endDate) {
    matchStage.processedAt = {};
    if (startDate) matchStage.processedAt.$gte = new Date(startDate);
    if (endDate) matchStage.processedAt.$lte = new Date(endDate);
  }
  
  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalAmount: { $sum: '$amount' },
        count: { $sum: 1 },
        avgAmount: { $avg: '$amount' },
        minAmount: { $min: '$amount' },
        maxAmount: { $max: '$amount' }
      }
    }
  ]);
};

// Static method to get daily benefit summary
benefitLedgerSchema.statics.getDailySummary = function(date = new Date()) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);
  
  return this.aggregate([
    {
      $match: {
        processedAt: {
          $gte: startOfDay,
          $lte: endOfDay
        },
        status: 'processed'
      }
    },
    {
      $group: {
        _id: null,
        totalBenefits: { $sum: '$amount' },
        totalUsers: { $addToSet: '$userId' },
        totalTransactions: { $sum: 1 }
      }
    },
    {
      $project: {
        totalBenefits: 1,
        totalUsers: { $size: '$totalUsers' },
        totalTransactions: 1
      }
    }
  ]);
};

// Pre-save middleware to calculate amount if not provided
benefitLedgerSchema.pre('save', function(next) {
  if (!this.amount && this.baseAmount && this.dailyRate) {
    this.amount = this.baseAmount * this.dailyRate;
  }
  next();
});

module.exports = mongoose.model('BenefitLedger', benefitLedgerSchema);