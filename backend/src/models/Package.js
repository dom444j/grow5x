const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const packageSchema = new mongoose.Schema({
  // Package Identification
  packageId: {
    type: String,
    unique: true,
    default: () => `PKG_${uuidv4().replace(/-/g, '').substring(0, 12).toUpperCase()}`
  },
  name: {
    type: String,
    required: true,
    enum: ['Starter', 'Basic', 'Standard', 'Premium', 'Gold', 'Platinum', 'Diamond'],
    unique: true
  },
  slug: {
    type: String,
    unique: true,
    trim: true,
    lowercase: true
  },
  
  // Pricing
  price: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    default: 'USDT',
    enum: ['USDT', 'USD']
  },
  network: {
    type: String,
    default: 'BEP20',
    enum: ['BEP20', 'ERC20', 'TRC20']
  },
  
  // Benefits Configuration
  dailyBenefitRate: {
    type: Number,
    required: true,
    min: 0,
    max: 1, // Percentage as decimal (0.125 = 12.5%)
    default: 0.125 // 12.5%
  },
  benefitDays: {
    type: Number,
    required: true,
    min: 1,
    default: 8 // 8 days per cycle
  },
  totalCycles: {
    type: Number,
    required: true,
    min: 1,
    default: 5 // 5 cycles total
  },
  
  // Cashback Configuration
  cashbackRate: {
    type: Number,
    default: 0.125, // 12.5% diario
    min: 0,
    max: 1
  },
  cashbackDays: {
    type: Number,
    default: 8, // 8 días fijos
    min: 1
  },
  
  // Withdrawal SLA (objetivo para UI)
  withdrawalSlaTargetMinutes: {
    type: Number,
    required: true,
    min: 1 // En minutos
  },
  
  // Referral Commission
  referralCommissionRate: {
    type: Number,
    default: 0.10, // 10%
    min: 0,
    max: 1
  },
  commissionLevels: {
    type: Number,
    default: 1, // Solo directo
    min: 1
  },
  
  // Target Audience
  targetAudience: {
    type: String,
    trim: true
  },
  
  // Popular Badge
  isPopular: {
    type: Boolean,
    default: false
  },
  
  // Commission Structure (MVP: solo 2 niveles)
  commissionRates: {
    directReferralRate: {
      type: Number,
      default: 0.10, // 10%
      min: 0,
      max: 1
    },
    parentBonusRate: {
      type: Number,
      default: 0.10, // 10%
      min: 0,
      max: 1
    }
  },
  
  // Package Status
  isActive: {
    type: Boolean,
    default: true
  },
  isVisible: {
    type: Boolean,
    default: true
  },
  
  // Display Information
  description: {
    type: String,
    trim: true
  },
  features: [{
    type: String,
    trim: true
  }],
  
  // Limits and Requirements
  minPurchase: {
    type: Number,
    default: 1,
    min: 1
  },
  maxPurchase: {
    type: Number,
    default: 1,
    min: 1
  },
  
  // Metadata
  totalSold: {
    type: Number,
    default: 0,
    min: 0
  },
  totalRevenue: {
    type: Number,
    default: 0,
    min: 0
  },
  
  // Display Order
  sortOrder: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Indexes
packageSchema.index({ name: 1 });
packageSchema.index({ packageId: 1 });
packageSchema.index({ slug: 1 });
packageSchema.index({ isActive: 1, isVisible: 1 });
packageSchema.index({ sortOrder: 1 });

// Virtual for total benefit amount
packageSchema.virtual('totalBenefitAmount').get(function() {
  return this.price * this.dailyBenefitRate * this.benefitDays * this.totalCycles;
});

// Virtual for total ROI percentage
packageSchema.virtual('totalROI').get(function() {
  return (this.totalBenefitAmount / this.price) * 100;
});

// Virtual for total duration in days
packageSchema.virtual('totalDurationDays').get(function() {
  return this.benefitDays * this.totalCycles;
});

// Method to calculate commission for a specific type
packageSchema.methods.getCommissionForType = function(type) {
  if (type === 'direct_referral') {
    return this.price * this.commissionRates.directReferralRate;
  }
  if (type === 'parent_bonus') {
    return this.price * this.commissionRates.parentBonusRate;
  }
  return 0;
};

// Method to get all commission amounts
packageSchema.methods.getAllCommissions = function() {
  return {
    direct_referral: this.getCommissionForType('direct_referral'),
    parent_bonus: this.getCommissionForType('parent_bonus')
  };
};

// Static method to find active packages
packageSchema.statics.findActive = function() {
  return this.find({ isActive: true, isVisible: true }).sort({ sortOrder: 1 });
};

// Static method to find by name
packageSchema.statics.findByName = function(name) {
  return this.findOne({ name, isActive: true });
};

// Pre-save middleware to update revenue when totalSold changes and auto-generate slug
packageSchema.pre('save', function(next) {
  // Auto-generate slug if not provided
  if (!this.slug && this.name) {
    this.slug = this.name.toLowerCase().replace(/\s+/g, '-');
  }
  
  // Update revenue when totalSold changes
  if (this.isModified('totalSold')) {
    this.totalRevenue = this.totalSold * this.price;
  }
  next();
});

module.exports = mongoose.model('Package', packageSchema);