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
    enum: ['Starter', 'Diamond'],
    unique: true
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
  
  // Commission Structure
  commissionRates: {
    level1: {
      type: Number,
      default: 0.10, // 10%
      min: 0,
      max: 1
    },
    level2: {
      type: Number,
      default: 0.05, // 5%
      min: 0,
      max: 1
    },
    level3: {
      type: Number,
      default: 0.03, // 3%
      min: 0,
      max: 1
    },
    level4: {
      type: Number,
      default: 0.02, // 2%
      min: 0,
      max: 1
    },
    level5: {
      type: Number,
      default: 0.01, // 1%
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

// Method to calculate commission for a specific level
packageSchema.methods.getCommissionForLevel = function(level) {
  const levelKey = `level${level}`;
  if (this.commissionRates[levelKey] !== undefined) {
    return this.price * this.commissionRates[levelKey];
  }
  return 0;
};

// Method to get all commission amounts
packageSchema.methods.getAllCommissions = function() {
  const commissions = {};
  for (let i = 1; i <= 5; i++) {
    commissions[`level${i}`] = this.getCommissionForLevel(i);
  }
  return commissions;
};

// Static method to find active packages
packageSchema.statics.findActive = function() {
  return this.find({ isActive: true, isVisible: true }).sort({ sortOrder: 1 });
};

// Static method to find by name
packageSchema.statics.findByName = function(name) {
  return this.findOne({ name, isActive: true });
};

// Pre-save middleware to update revenue when totalSold changes
packageSchema.pre('save', function(next) {
  if (this.isModified('totalSold')) {
    this.totalRevenue = this.totalSold * this.price;
  }
  next();
});

module.exports = mongoose.model('Package', packageSchema);