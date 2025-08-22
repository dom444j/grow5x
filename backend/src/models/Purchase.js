const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const { DecimalCalc } = require('../utils/decimal');

const purchaseSchema = new mongoose.Schema({
  // Purchase Identification
  purchaseId: {
    type: String,
    unique: true,
    default: () => `PUR_${uuidv4().replace(/-/g, '').substring(0, 12).toUpperCase()}`
  },
  
  // User and Package Information
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  packageId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Package',
    required: true
  },
  
  // Purchase Details
  quantity: {
    type: Number,
    required: true,
    min: 1,
    default: 1
  },
  unitPrice: {
    type: mongoose.Schema.Types.Decimal128,
    required: true,
    min: 0
  },
  totalAmount: {
    type: mongoose.Schema.Types.Decimal128,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    required: true,
    default: 'USDT'
  },
  
  // Payment Information (Pool V2)
  assignedWallet: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Wallet'
  },
  // Pool V2: wallet shown to user for UI consistency (not a reservation)
  displayWalletId: {
    type: String
  },
  paymentAddress: {
    type: String,
    trim: true
  },
  txHash: {
    type: String,
    sparse: true,
    unique: true,
    trim: true,
    validate: {
      validator: function(v) {
        if (!v) return true; // Allow null/undefined
        return /^0x[a-fA-F0-9]{64}$/.test(v);
      },
      message: 'Transaction hash must be a valid 0x prefixed 64-character hex string'
    }
  },
  
  // Status Tracking - Unified States
  status: {
    type: String,
    enum: [
      'PENDING_PAYMENT',   // Waiting for user payment
      'CONFIRMING',        // User submitted tx hash, awaiting admin confirmation
      'APPROVED',          // Admin approved payment, ready to activate
      'ACTIVE',           // Purchase is active and generating benefits
      'REJECTED',         // Admin rejected payment
      'EXPIRED'           // Payment window expired
    ],
    default: 'PENDING_PAYMENT'
  },
  
  // Timestamps
  paymentDeadline: {
    type: Date,
    default: () => new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
  },
  paymentSubmittedAt: {
    type: Date
  },
  paymentConfirmedAt: {
    type: Date
  },
  activatedAt: {
    type: Date
  },
  completedAt: {
    type: Date
  },
  
  // Benefit Tracking
  benefitPlan: {
    dailyRate: {
      type: Number,
      required: true
    },
    daysPerCycle: {
      type: Number,
      required: true
    },
    totalCycles: {
      type: Number,
      required: true
    },
    totalBenefitAmount: {
      type: mongoose.Schema.Types.Decimal128,
      required: true
    }
  },
  
  currentCycle: {
    type: Number,
    default: 0,
    min: 0
  },
  currentDay: {
    type: Number,
    default: 0,
    min: 0
  },
  
  totalBenefitsPaid: {
    type: mongoose.Schema.Types.Decimal128,
    default: 0,
    min: 0
  },
  
  nextBenefitDate: {
    type: Date
  },
  
  // Commission Information
  commissionsGenerated: {
    type: Array,
    default: []
  },
  totalCommissionAmount: {
    type: mongoose.Schema.Types.Decimal128,
    default: 0,
    min: 0
  },
  
  // Admin Information
  confirmedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  adminNotes: {
    type: String,
    trim: true
  },
  
  // License Integration
  licenseCreated: {
    type: Boolean,
    default: false
  },
  licenseId: {
    type: String,
    sparse: true
  },
  
  // Worker Processing
  processedByWorker: {
    type: Boolean,
    default: false
  },
  workerProcessedAt: {
    type: Date
  },
  workerError: {
    type: String
  },
  
  // Metadata
  ipAddress: {
    type: String
  },
  userAgent: {
    type: String
  }
}, {
  timestamps: true
});

// Indexes
purchaseSchema.index({ purchaseId: 1 });
purchaseSchema.index({ userId: 1, status: 1 });
purchaseSchema.index({ packageId: 1 });
purchaseSchema.index({ status: 1 });
purchaseSchema.index({ txHash: 1 }, { unique: true, sparse: true });
purchaseSchema.index({ paymentDeadline: 1 });
purchaseSchema.index({ nextBenefitDate: 1 });
purchaseSchema.index({ createdAt: 1 });
purchaseSchema.index({ assignedWallet: 1 });

// Virtual for days remaining in current cycle
purchaseSchema.virtual('daysRemainingInCycle').get(function() {
  if (!this.benefitPlan) return 0;
  return this.benefitPlan.daysPerCycle - this.currentDay;
});

// Virtual for cycles remaining
purchaseSchema.virtual('cyclesRemaining').get(function() {
  if (!this.benefitPlan) return 0;
  return this.benefitPlan.totalCycles - this.currentCycle;
});

// Virtual for total days remaining
purchaseSchema.virtual('totalDaysRemaining').get(function() {
  if (!this.benefitPlan) return 0;
  return (this.cyclesRemaining * this.benefitPlan.daysPerCycle) - this.currentDay;
});

// Virtual for progress percentage
purchaseSchema.virtual('progressPercentage').get(function() {
  if (!this.benefitPlan) return 0;
  const totalDays = this.benefitPlan.totalCycles * this.benefitPlan.daysPerCycle;
  const completedDays = (this.currentCycle * this.benefitPlan.daysPerCycle) + this.currentDay;
  return Math.min((completedDays / totalDays) * 100, 100);
});

// Virtual for daily benefit amount
purchaseSchema.virtual('dailyBenefitAmount').get(function() {
  return DecimalCalc.multiply(this.totalAmount, this.benefitPlan.dailyRate);
});

// Method to submit payment hash
purchaseSchema.methods.submitPayment = function(transactionHash) {
  if (this.status !== 'PENDING_PAYMENT') {
    throw new Error(`Cannot submit payment from status ${this.status}`);
  }
  this.status = 'CONFIRMING';
  this.txHash = transactionHash;
  this.paymentSubmittedAt = new Date();
  return this.save();
};

// Method to approve purchase
purchaseSchema.methods.approve = function(adminId, notes) {
  if (this.status !== 'CONFIRMING') {
    throw new Error(`Cannot approve from status ${this.status}`);
  }
  this.status = 'APPROVED';
  this.paymentConfirmedAt = new Date();
  this.confirmedBy = adminId;
  this.adminNotes = notes;
  return this.save();
};

// Method to mark as processed by worker
purchaseSchema.methods.markAsProcessedByWorker = function(licenseId, error = null) {
  this.processedByWorker = true;
  this.workerProcessedAt = new Date();
  if (licenseId) {
    this.licenseCreated = true;
    this.licenseId = licenseId;
  }
  if (error) {
    this.workerError = error;
  }
  return this.save();
};

// Method to reject purchase
purchaseSchema.methods.reject = function(adminId, reason) {
  if (this.status !== 'CONFIRMING') {
    throw new Error(`Cannot reject from status ${this.status}`);
  }
  this.status = 'REJECTED';
  this.confirmedBy = adminId;
  this.adminNotes = reason;
  return this.save();
};

// Method to activate purchase
purchaseSchema.methods.activate = function() {
  if (this.status !== 'APPROVED') {
    throw new Error(`Cannot activate from status ${this.status}`);
  }
  this.status = 'ACTIVE';
  this.activatedAt = new Date();
  this.currentCycle = 1;
  this.currentDay = 0;
  this.nextBenefitDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // Next day
  
  return this.save();
};

// Method to expire purchase
purchaseSchema.methods.expire = function() {
  if (this.status !== 'PENDING_PAYMENT') {
    throw new Error(`Cannot expire from status ${this.status}`);
  }
  this.status = 'EXPIRED';
  return this.save();
};

// Method to process daily benefit
purchaseSchema.methods.processDailyBenefit = function() {
  if (this.status !== 'ACTIVE') {
    throw new Error('Purchase is not active');
  }
  
  if (this.currentCycle > this.benefitPlan.totalCycles) {
    throw new Error('All cycles completed');
  }
  
  // Increment day
  this.currentDay += 1;
  
  // Calculate benefit amount
  const benefitAmount = this.dailyBenefitAmount;
  this.totalBenefitsPaid += benefitAmount;
  
  // Check if cycle is complete
  if (this.currentDay >= this.benefitPlan.daysPerCycle) {
    this.currentCycle += 1;
    this.currentDay = 0;
    
    // Check if all cycles are complete
    if (this.currentCycle > this.benefitPlan.totalCycles) {
      // Purchase completes but stays ACTIVE (no COMPLETED state in unified model)
      this.completedAt = new Date();
      this.nextBenefitDate = null;
    } else {
      // Set next benefit date for next cycle
      this.nextBenefitDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
    }
  } else {
    // Set next benefit date for next day
    this.nextBenefitDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
  }
  
  return { benefitAmount, purchase: this };
};

// Method to check if ready for next benefit
purchaseSchema.methods.isReadyForBenefit = function() {
  return this.status === 'ACTIVE' && 
         this.nextBenefitDate && 
         this.nextBenefitDate <= new Date();
};

// Static method to find purchases ready for benefits
purchaseSchema.statics.findReadyForBenefits = function() {
  return this.find({
    status: 'ACTIVE',
    nextBenefitDate: { $lte: new Date() }
  }).populate('userId packageId');
};

// Static method to find expired payments
purchaseSchema.statics.findExpiredPayments = function() {
  return this.find({
    status: 'PENDING_PAYMENT',
    paymentDeadline: { $lt: new Date() }
  });
};

// Static method to find purchases pending confirmation
purchaseSchema.statics.findPendingConfirmation = function() {
  return this.find({
    status: 'CONFIRMING'
  }).populate('userId packageId');
};

// Static method to find approved purchases not processed by worker
purchaseSchema.statics.findApprovedNotProcessed = function(limit = 10) {
  return this.find({
    status: 'APPROVED',
    processedByWorker: false
  })
  .populate('userId')
  .limit(limit)
  .sort({ paymentConfirmedAt: 1 });
};

// Static method to find by transaction hash
purchaseSchema.statics.findByTxHash = function(txHash) {
  return this.findOne({ txHash: txHash.toLowerCase() });
};

// Pre-save middleware to calculate total amount
purchaseSchema.pre('save', function(next) {
  if (this.isModified('quantity') || this.isModified('unitPrice')) {
    this.totalAmount = DecimalCalc.calculateTotal(this.quantity, this.unitPrice);
  }
  
  // Normalize txHash
  if (this.isModified('txHash') && this.txHash) {
    this.txHash = this.txHash.toLowerCase();
  }
  
  next();
});

module.exports = mongoose.model('Purchase', purchaseSchema);