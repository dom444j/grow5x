const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

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
    type: Number,
    required: true,
    min: 0
  },
  totalAmount: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    required: true,
    default: 'USDT'
  },
  
  // Payment Information
  assignedWallet: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Wallet'
  },
  paymentAddress: {
    type: String,
    trim: true
  },
  txHash: {
    type: String,
    sparse: true,
    unique: true,
    trim: true
  },
  
  // Status Tracking
  status: {
    type: String,
    enum: [
      'pending_payment',    // Waiting for user payment
      'payment_submitted',  // User submitted tx hash
      'payment_confirmed',  // Admin confirmed payment
      'active',            // Purchase is active and generating benefits
      'completed',         // All benefits paid out
      'cancelled',         // Purchase cancelled
      'expired'           // Payment window expired
    ],
    default: 'pending_payment'
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
      type: Number,
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
    type: Number,
    default: 0,
    min: 0
  },
  
  nextBenefitDate: {
    type: Date
  },
  
  // Commission Information
  commissionsGenerated: {
    type: Boolean,
    default: false
  },
  totalCommissionAmount: {
    type: Number,
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
purchaseSchema.index({ txHash: 1 }, { sparse: true });
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
  return this.totalAmount * this.benefitPlan.dailyRate;
});

// Method to activate purchase
purchaseSchema.methods.activate = function() {
  this.status = 'active';
  this.activatedAt = new Date();
  this.currentCycle = 1;
  this.currentDay = 0;
  this.nextBenefitDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // Next day
  
  return this.save();
};

// Method to process daily benefit
purchaseSchema.methods.processDailyBenefit = function() {
  if (this.status !== 'active') {
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
      this.status = 'completed';
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
  return this.status === 'active' && 
         this.nextBenefitDate && 
         this.nextBenefitDate <= new Date();
};

// Static method to find purchases ready for benefits
purchaseSchema.statics.findReadyForBenefits = function() {
  return this.find({
    status: 'active',
    nextBenefitDate: { $lte: new Date() }
  }).populate('userId packageId');
};

// Static method to find expired payments
purchaseSchema.statics.findExpiredPayments = function() {
  return this.find({
    status: 'pending_payment',
    paymentDeadline: { $lt: new Date() }
  });
};

// Static method to find by transaction hash
purchaseSchema.statics.findByTxHash = function(txHash) {
  return this.findOne({ txHash: txHash.toLowerCase() });
};

// Pre-save middleware to calculate total amount
purchaseSchema.pre('save', function(next) {
  if (this.isModified('quantity') || this.isModified('unitPrice')) {
    this.totalAmount = this.quantity * this.unitPrice;
  }
  
  // Normalize txHash
  if (this.isModified('txHash') && this.txHash) {
    this.txHash = this.txHash.toLowerCase();
  }
  
  next();
});

module.exports = mongoose.model('Purchase', purchaseSchema);