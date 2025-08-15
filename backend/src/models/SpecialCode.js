const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const specialCodeSchema = new mongoose.Schema({
  // Code Identification
  codeId: {
    type: String,
    unique: true,
    default: () => `CODE_${uuidv4().replace(/-/g, '').substring(0, 12).toUpperCase()}`
  },
  
  // Code Information
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true,
    minlength: 6,
    maxlength: 20
  },
  
  // Code Type and Purpose
  type: {
    type: String,
    required: true,
    enum: [
      'admin_referral',     // Special referral code for admin
      'bonus_code',         // Bonus activation code
      'discount_code',      // Discount code
      'special_access',     // Special access code
      'promotion_code'      // Promotional code
    ]
  },
  
  // Code Status
  isActive: {
    type: Boolean,
    default: true
  },
  
  // Usage Limits
  maxUses: {
    type: Number,
    default: null // null = unlimited
  },
  currentUses: {
    type: Number,
    default: 0,
    min: 0
  },
  
  // Validity Period
  validFrom: {
    type: Date,
    default: Date.now
  },
  validUntil: {
    type: Date,
    default: null // null = no expiration
  },
  
  // Code Benefits
  benefits: {
    // Discount percentage (0-1)
    discountPercentage: {
      type: Number,
      min: 0,
      max: 1,
      default: 0
    },
    
    // Fixed discount amount
    discountAmount: {
      type: Number,
      min: 0,
      default: 0
    },
    
    // Bonus amount
    bonusAmount: {
      type: Number,
      min: 0,
      default: 0
    },
    
    // Special commission rates
    specialCommissionRates: {
      level1: { type: Number, min: 0, max: 1 },
      level2: { type: Number, min: 0, max: 1 },
      level3: { type: Number, min: 0, max: 1 },
      level4: { type: Number, min: 0, max: 1 },
      level5: { type: Number, min: 0, max: 1 }
    },
    
    // Special access permissions
    specialAccess: [{
      type: String,
      enum: ['early_access', 'vip_support', 'premium_features']
    }]
  },
  
  // Applicable Packages
  applicablePackages: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Package'
  }],
  
  // User Restrictions
  allowedUsers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  
  // Usage Tracking
  usageHistory: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    usedAt: {
      type: Date,
      default: Date.now
    },
    purchaseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Purchase'
    },
    benefitApplied: {
      discountAmount: Number,
      bonusAmount: Number
    },
    ipAddress: String,
    userAgent: String
  }],
  
  // Creator Information
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Metadata
  description: {
    type: String,
    trim: true
  },
  internalNotes: {
    type: String,
    trim: true
  },
  
  // Analytics
  totalDiscountGiven: {
    type: Number,
    default: 0,
    min: 0
  },
  totalBonusGiven: {
    type: Number,
    default: 0,
    min: 0
  },
  totalRevenueLoss: {
    type: Number,
    default: 0,
    min: 0
  }
}, {
  timestamps: true
});

// Indexes
specialCodeSchema.index({ code: 1 });
specialCodeSchema.index({ codeId: 1 });
specialCodeSchema.index({ type: 1, isActive: 1 });
specialCodeSchema.index({ validFrom: 1, validUntil: 1 });
specialCodeSchema.index({ createdBy: 1 });
specialCodeSchema.index({ 'usageHistory.userId': 1 });

// Virtual for remaining uses
specialCodeSchema.virtual('remainingUses').get(function() {
  if (this.maxUses === null) return null; // Unlimited
  return Math.max(0, this.maxUses - this.currentUses);
});

// Virtual for is expired
specialCodeSchema.virtual('isExpired').get(function() {
  return this.validUntil && this.validUntil < new Date();
});

// Virtual for is valid
specialCodeSchema.virtual('isValid').get(function() {
  const now = new Date();
  return this.isActive && 
         this.validFrom <= now && 
         (!this.validUntil || this.validUntil >= now) &&
         (this.maxUses === null || this.currentUses < this.maxUses);
});

// Method to check if code can be used by user
specialCodeSchema.methods.canBeUsedBy = function(userId, packageId = null) {
  // Check if code is valid
  if (!this.isValid) {
    return { valid: false, reason: 'Code is not valid or has expired' };
  }
  
  // Check user restrictions
  if (this.allowedUsers.length > 0 && !this.allowedUsers.includes(userId)) {
    return { valid: false, reason: 'Code is not available for this user' };
  }
  
  // Check package restrictions
  if (packageId && this.applicablePackages.length > 0 && !this.applicablePackages.includes(packageId)) {
    return { valid: false, reason: 'Code is not applicable to this package' };
  }
  
  // Check if user has already used this code
  const userUsage = this.usageHistory.find(usage => usage.userId.toString() === userId.toString());
  if (userUsage && this.type !== 'admin_referral') {
    return { valid: false, reason: 'Code has already been used by this user' };
  }
  
  return { valid: true };
};

// Method to use code
specialCodeSchema.methods.useCode = function(userId, purchaseId, benefitApplied, metadata = {}) {
  // Add to usage history
  this.usageHistory.push({
    userId,
    purchaseId,
    benefitApplied,
    ipAddress: metadata.ipAddress,
    userAgent: metadata.userAgent
  });
  
  // Increment usage count
  this.currentUses += 1;
  
  // Update analytics
  if (benefitApplied.discountAmount) {
    this.totalDiscountGiven += benefitApplied.discountAmount;
    this.totalRevenueLoss += benefitApplied.discountAmount;
  }
  
  if (benefitApplied.bonusAmount) {
    this.totalBonusGiven += benefitApplied.bonusAmount;
  }
  
  return this.save();
};

// Method to calculate discount for amount
specialCodeSchema.methods.calculateDiscount = function(amount) {
  let discount = 0;
  
  // Apply percentage discount
  if (this.benefits.discountPercentage > 0) {
    discount += amount * this.benefits.discountPercentage;
  }
  
  // Apply fixed discount
  if (this.benefits.discountAmount > 0) {
    discount += this.benefits.discountAmount;
  }
  
  // Ensure discount doesn't exceed the amount
  return Math.min(discount, amount);
};

// Static method to find valid codes
specialCodeSchema.statics.findValidCodes = function(type = null) {
  const now = new Date();
  const query = {
    isActive: true,
    validFrom: { $lte: now },
    $or: [
      { validUntil: null },
      { validUntil: { $gte: now } }
    ],
    $or: [
      { maxUses: null },
      { $expr: { $lt: ['$currentUses', '$maxUses'] } }
    ]
  };
  
  if (type) {
    query.type = type;
  }
  
  return this.find(query);
};

// Static method to find by code
specialCodeSchema.statics.findByCode = function(code) {
  return this.findOne({ code: code.toUpperCase() });
};

// Static method to create admin referral code
specialCodeSchema.statics.createAdminReferralCode = function(adminUserId, code) {
  return this.create({
    code: code.toUpperCase(),
    type: 'admin_referral',
    createdBy: adminUserId,
    description: 'Admin referral code',
    maxUses: null, // Unlimited uses
    validUntil: null // No expiration
  });
};

// Static method to get usage statistics
specialCodeSchema.statics.getUsageStatistics = function(options = {}) {
  const {
    startDate,
    endDate,
    type,
    codeId
  } = options;
  
  const matchStage = {};
  
  if (type) matchStage.type = type;
  if (codeId) matchStage.codeId = codeId;
  
  const pipeline = [
    { $match: matchStage },
    { $unwind: '$usageHistory' }
  ];
  
  if (startDate || endDate) {
    const dateMatch = {};
    if (startDate) dateMatch.$gte = new Date(startDate);
    if (endDate) dateMatch.$lte = new Date(endDate);
    pipeline.push({ $match: { 'usageHistory.usedAt': dateMatch } });
  }
  
  pipeline.push({
    $group: {
      _id: '$code',
      totalUses: { $sum: 1 },
      totalDiscount: { $sum: '$usageHistory.benefitApplied.discountAmount' },
      totalBonus: { $sum: '$usageHistory.benefitApplied.bonusAmount' },
      uniqueUsers: { $addToSet: '$usageHistory.userId' }
    }
  });
  
  pipeline.push({
    $project: {
      code: '$_id',
      totalUses: 1,
      totalDiscount: 1,
      totalBonus: 1,
      uniqueUsers: { $size: '$uniqueUsers' }
    }
  });
  
  return this.aggregate(pipeline);
};

// Pre-save middleware to normalize code
specialCodeSchema.pre('save', function(next) {
  if (this.isModified('code')) {
    this.code = this.code.toUpperCase().trim();
  }
  next();
});

module.exports = mongoose.model('SpecialCode', specialCodeSchema);