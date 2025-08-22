const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const { DecimalCalc } = require('../utils/decimal');

const withdrawalSchema = new mongoose.Schema({
  // Withdrawal Identification
  withdrawalId: {
    type: String,
    unique: true,
    default: () => `WTH_${uuidv4().replace(/-/g, '').substring(0, 12).toUpperCase()}`
  },
  
  // User Information
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Withdrawal Details
  amount: {
    type: mongoose.Schema.Types.Decimal128,
    required: true,
    min: 10 // Minimum withdrawal amount $10 USDT
  },
  currency: {
    type: String,
    required: true,
    default: 'USDT'
  },
  
  // Destination Information
  destinationAddress: {
    type: String,
    required: true,
    trim: true,
    validate: {
      validator: function(v) {
        // Strict BEP20/EVM address validation (0x + 40 hex chars)
        return /^0x[a-fA-F0-9]{40}$/.test(v);
      },
      message: 'Invalid BEP20 address format. Must be 0x followed by 40 hexadecimal characters'
    }
  },
  
  network: {
    type: String,
    required: true,
    enum: ['BEP20', 'ETH', 'POLYGON', 'BTC'],
    default: 'BEP20'
  },
  
  // Fee Information
  networkFee: {
    type: mongoose.Schema.Types.Decimal128,
    required: true,
    min: 0,
    default: 1 // Default 1 USDT fee
  },
  processingFee: {
    type: mongoose.Schema.Types.Decimal128,
    min: 0,
    default: 0
  },
  totalFees: {
    type: mongoose.Schema.Types.Decimal128,
    min: 0
  },
  netAmount: {
    type: mongoose.Schema.Types.Decimal128,
    min: 0
  },
  
  // Status Tracking
  status: {
    type: String,
    enum: [
      'pending',           // Waiting for admin approval
      'approved',          // Approved by admin, ready for processing
      'processing',        // Being processed
      'completed',         // Successfully completed
      'rejected',          // Rejected by admin
      'failed',           // Failed during processing
      'cancelled'         // Cancelled by user or system
    ],
    default: 'pending'
  },
  
  // Timestamps
  requestedAt: {
    type: Date,
    default: Date.now
  },
  approvedAt: {
    type: Date
  },
  processedAt: {
    type: Date
  },
  completedAt: {
    type: Date
  },
  
  // Blockchain Information
  txHash: {
    type: String,
    sparse: true,
    unique: true,
    trim: true
  },
  blockNumber: {
    type: Number
  },
  confirmations: {
    type: Number,
    default: 0
  },
  
  // Security and Verification
  otpCode: {
    type: String,
    select: false // Don't include in queries by default
  },
  otpExpires: {
    type: Date,
    select: false
  },
  otpVerified: {
    type: Boolean,
    default: false
  },
  
  // Telegram Integration
  telegramMessageId: {
    type: String
  },
  telegramVerified: {
    type: Boolean,
    default: false
  },
  
  // Admin Information
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  processedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // ETA and Manual Processing
  processingTargetMinutes: {
    type: Number,
    min: 0
  },
  processingETA: {
    type: Date
  },
  manualProcessing: {
    type: Boolean,
    default: true
  },
  failureReason: {
    type: String,
    trim: true
  },
  
  // Notes and Comments
  userNotes: {
    type: String,
    trim: true,
    maxlength: 500
  },
  adminNotes: {
    type: String,
    trim: true
  },
  rejectionReason: {
    type: String,
    trim: true
  },
  
  // Balance Information
  balanceBefore: {
    type: mongoose.Schema.Types.Decimal128,
    required: true,
    min: 0
  },
  balanceAfter: {
    type: mongoose.Schema.Types.Decimal128,
    min: 0
  },
  
  // Related Transaction
  transactionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Transaction'
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
  ipAddress: {
    type: String
  },
  userAgent: {
    type: String
  },
  
  // Priority
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal'
  }
}, {
  timestamps: true
});

// Indexes
withdrawalSchema.index({ withdrawalId: 1 });
withdrawalSchema.index({ userId: 1, status: 1 });
withdrawalSchema.index({ status: 1, createdAt: 1 });
withdrawalSchema.index({ txHash: 1 }, { unique: true, sparse: true });
withdrawalSchema.index({ requestedAt: 1 });
withdrawalSchema.index({ approvedAt: 1 });
withdrawalSchema.index({ priority: 1, status: 1 });

// Virtual for processing time
withdrawalSchema.virtual('processingTime').get(function() {
  if (this.completedAt && this.requestedAt) {
    return this.completedAt - this.requestedAt;
  }
  return null;
});

// Virtual for is expired OTP
withdrawalSchema.virtual('isOtpExpired').get(function() {
  return this.otpExpires && this.otpExpires < new Date();
});

// Method to calculate fees and net amount
withdrawalSchema.methods.calculateFees = function() {
  const networkFee = parseFloat(this.networkFee.toString());
  const processingFee = parseFloat(this.processingFee.toString());
  const amount = parseFloat(this.amount.toString());
  
  this.totalFees = DecimalCalc.add(networkFee, processingFee);
  this.netAmount = DecimalCalc.subtract(amount, this.totalFees);
  
  if (this.netAmount < 0) {
    throw new Error('Withdrawal amount is less than fees');
  }
  
  return this;
};

// Method to generate OTP
withdrawalSchema.methods.generateOTP = function() {
  const otp = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit OTP
  this.otpCode = otp;
  this.otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
  this.otpVerified = false;
  
  return otp;
};

// Method to verify OTP
withdrawalSchema.methods.verifyOTP = function(providedOtp) {
  if (this.isOtpExpired) {
    throw new Error('OTP has expired');
  }
  
  if (this.otpCode !== providedOtp) {
    throw new Error('Invalid OTP');
  }
  
  this.otpVerified = true;
  return true;
};

// Method to approve withdrawal
withdrawalSchema.methods.approve = function(adminUserId, notes = '') {
  if (this.status !== 'pending') {
    throw new Error('Withdrawal is not in pending status');
  }
  
  this.status = 'approved';
  this.approvedAt = new Date();
  this.approvedBy = adminUserId;
  this.adminNotes = notes;
  
  return this.save();
};

// Method to reject withdrawal
withdrawalSchema.methods.reject = function(adminUserId, reason) {
  if (this.status !== 'pending') {
    throw new Error('Withdrawal is not in pending status');
  }
  
  this.status = 'rejected';
  this.approvedBy = adminUserId;
  this.rejectionReason = reason;
  
  return this.save();
};

// Method to start processing
withdrawalSchema.methods.startProcessing = function(adminUserId) {
  if (this.status !== 'approved') {
    throw new Error('Withdrawal is not approved');
  }
  
  this.status = 'processing';
  this.processedAt = new Date();
  this.processedBy = adminUserId;
  
  return this.save();
};

// Method to complete withdrawal
withdrawalSchema.methods.complete = function(txHash, blockNumber = null) {
  if (this.status !== 'processing') {
    throw new Error('Withdrawal is not being processed');
  }
  
  this.status = 'completed';
  this.completedAt = new Date();
  this.txHash = txHash;
  this.blockNumber = blockNumber;
  
  return this.save();
};

// Method to mark as failed
withdrawalSchema.methods.markAsFailed = function(errorMessage) {
  this.status = 'failed';
  this.errorMessage = errorMessage;
  this.retryCount += 1;
  
  return this.save();
};

// Static method to find pending withdrawals
withdrawalSchema.statics.findPending = function() {
  return this.find({ status: 'pending' })
    .populate('userId', 'firstName lastName email')
    .sort({ priority: -1, requestedAt: 1 });
};

// Static method to find approved withdrawals
withdrawalSchema.statics.findApproved = function() {
  return this.find({ status: 'approved' })
    .populate('userId', 'firstName lastName email')
    .sort({ priority: -1, approvedAt: 1 });
};

// Static method to get user withdrawal history
withdrawalSchema.statics.getUserHistory = function(userId, options = {}) {
  const {
    status,
    limit = 50,
    skip = 0,
    startDate,
    endDate
  } = options;
  
  const query = { userId };
  
  if (status) query.status = status;
  
  if (startDate || endDate) {
    query.requestedAt = {};
    if (startDate) query.requestedAt.$gte = new Date(startDate);
    if (endDate) query.requestedAt.$lte = new Date(endDate);
  }
  
  return this.find(query)
    .sort({ requestedAt: -1 })
    .limit(limit)
    .skip(skip);
};

// Static method to get withdrawal statistics
withdrawalSchema.statics.getStatistics = function(options = {}) {
  const {
    startDate,
    endDate,
    status
  } = options;
  
  const matchStage = {};
  
  if (status) matchStage.status = status;
  
  if (startDate || endDate) {
    matchStage.requestedAt = {};
    if (startDate) matchStage.requestedAt.$gte = new Date(startDate);
    if (endDate) matchStage.requestedAt.$lte = new Date(endDate);
  }
  
  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: '$status',
        totalAmount: { $sum: '$amount' },
        totalNetAmount: { $sum: '$netAmount' },
        totalFees: { $sum: '$totalFees' },
        count: { $sum: 1 },
        avgAmount: { $avg: '$amount' }
      }
    }
  ]);
};

// Static method to create withdrawal
withdrawalSchema.statics.createWithdrawal = function(userId, amount, currency, destinationAddress, network) {
  const withdrawalId = 'WD' + Date.now() + Math.random().toString(36).substr(2, 5).toUpperCase();
  
  const withdrawal = new this({
    withdrawalId,
    userId,
    amount,
    currency,
    destinationAddress,
    network,
    status: 'pending',
    requestedAt: new Date(),
    networkFee: 1, // Default BEP20 fee
    processingFee: 0, // No processing fee for now
    priority: 'normal'
  });
  
  return withdrawal.save();
};

// Pre-save middleware to calculate fees
withdrawalSchema.pre('save', function(next) {
  if (this.isModified('amount') || this.isModified('networkFee') || this.isModified('processingFee')) {
    this.calculateFees();
  }
  
  // Calculate balance after
  if (this.isModified('balanceBefore') || this.isModified('amount')) {
    const balanceBefore = parseFloat(this.balanceBefore.toString());
    const amount = parseFloat(this.amount.toString());
    this.balanceAfter = DecimalCalc.subtract(balanceBefore, amount);
  }
  
  next();
});

module.exports = mongoose.model('Withdrawal', withdrawalSchema);