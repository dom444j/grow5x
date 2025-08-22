const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { DecimalCalc } = require('../utils/decimal');
const CacheInvalidationService = require('../services/cacheInvalidationService');

const userSchema = new mongoose.Schema({
  // Basic Information
  userId: {
    type: String,
    unique: true,
    default: () => `USR_${uuidv4().replace(/-/g, '').substring(0, 12).toUpperCase()}`
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  firstName: {
    type: String,
    required: true,
    trim: true
  },
  lastName: {
    type: String,
    required: true,
    trim: true
  },
  phone: {
    type: String,
    trim: true
  },
  country: {
    type: String,
    trim: true
  },
  
  // Account Status
  isActive: {
    type: Boolean,
    default: false
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },
  
  // Special Parent Status (separate from role)
  specialParentStatus: {
    type: String,
    enum: ['none', 'special_parent'],
    default: 'none'
  },
  specialParentCode: {
    type: String,
    sparse: true,
    unique: true
  },
  specialParentAssignedAt: {
    type: Date
  },
  specialParentAssignedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // Telegram Integration
  telegramChatId: {
    type: String,
    sparse: true
  },
  telegramUsername: {
    type: String,
    sparse: true
  },
  telegramVerified: {
    type: Boolean,
    default: false
  },
  telegramVerifiedAt: {
    type: Date
  },
  
  // User Settings
  defaultWithdrawalAddress: {
    type: String,
    trim: true,
    validate: {
      validator: function(v) {
        if (!v) return true; // Optional field
        // BEP20 address validation (42 chars, starts with 0x)
        return /^0x[a-fA-F0-9]{40}$/.test(v);
      },
      message: 'Invalid BEP20 address format'
    }
  },
  network: {
    type: String,
    default: 'BEP20',
    enum: ['BEP20']
  },
  defaultWithdrawalAddress: {
    type: String,
    trim: true,
    validate: {
      validator: function(v) {
        if (!v) return true; // Optional field
        // BEP20 address validation (42 chars, starts with 0x)
        return /^0x[a-fA-F0-9]{40}$/.test(v);
      },
      message: 'Invalid BEP20 address format'
    }
  },
  
  // Referral System
  referralCode: {
    type: String,
    unique: true,
    default: () => `REF_${Math.random().toString(36).substring(2, 10).toUpperCase()}`
  },
  referredBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  referralLevel: {
    type: Number,
    default: 0,
    min: 0,
    max: 10
  },
  
  // Financial Information
  totalInvested: {
    type: mongoose.Schema.Types.Decimal128,
    default: 0,
    min: 0
  },
  totalEarnings: {
    type: mongoose.Schema.Types.Decimal128,
    default: 0,
    min: 0
  },
  availableBalance: {
    type: mongoose.Schema.Types.Decimal128,
    default: 0,
    min: 0
  },
  totalWithdrawn: {
    type: mongoose.Schema.Types.Decimal128,
    default: 0,
    min: 0
  },
  
  // Commission Tracking
  totalCommissions: {
    type: mongoose.Schema.Types.Decimal128,
    default: 0,
    min: 0
  },
  availableCommissions: {
    type: mongoose.Schema.Types.Decimal128,
    default: 0,
    min: 0
  },
  
  // Security
  lastLogin: {
    type: Date
  },
  loginAttempts: {
    type: Number,
    default: 0
  },
  lockUntil: {
    type: Date
  },
  passwordResetToken: {
    type: String
  },
  passwordResetExpires: {
    type: Date
  },
  
  // Verification
  emailVerificationToken: {
    type: String
  },
  emailVerificationExpires: {
    type: Date
  },
  
  // Session Management
  tokenVersion: {
    type: Number,
    default: 0
  },
  
  // Metadata
  registrationIP: {
    type: String
  },
  lastIP: {
    type: String
  },
  userAgent: {
    type: String
  }
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      delete ret.password;
      delete ret.passwordResetToken;
      delete ret.emailVerificationToken;
      delete ret.loginAttempts;
      delete ret.lockUntil;
      return ret;
    }
  }
});

// Indexes
userSchema.index({ email: 1 });
userSchema.index({ userId: 1 });
userSchema.index({ referralCode: 1 });
userSchema.index({ telegramChatId: 1 }, { sparse: true });
userSchema.index({ specialParentStatus: 1 });
userSchema.index({ specialParentCode: 1 }, { sparse: true });
userSchema.index({ createdAt: 1 });

// Virtual for account lock status
userSchema.virtual('isLocked').get(function() {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

// Virtual for full name
userSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Pre-save middleware to hash password
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Method to increment login attempts
userSchema.methods.incLoginAttempts = function() {
  // If we have a previous lock that has expired, restart at 1
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $unset: { lockUntil: 1 },
      $set: { loginAttempts: 1 }
    });
  }
  
  const updates = { $inc: { loginAttempts: 1 } };
  
  // Lock account after 5 failed attempts for 2 hours
  if (this.loginAttempts + 1 >= 5 && !this.isLocked) {
    updates.$set = { lockUntil: Date.now() + 2 * 60 * 60 * 1000 }; // 2 hours
  }
  
  return this.updateOne(updates);
};

// Method to reset login attempts
userSchema.methods.resetLoginAttempts = function() {
  return this.updateOne({
    $unset: { loginAttempts: 1, lockUntil: 1 }
  });
};

// Method to invalidate all user tokens
userSchema.methods.invalidateTokens = function() {
  this.tokenVersion += 1;
  return this.save();
};

// Static method to find by email
userSchema.statics.findByEmail = function(email) {
  return this.findOne({ email: email.toLowerCase() });
};

// Static method to find by referral code
userSchema.statics.findByReferralCode = function(code) {
  return this.findOne({ referralCode: code.toUpperCase() });
};

// Method to update user balance
userSchema.methods.updateBalance = function(currency, amount, reason = 'balance_update') {
  if (currency === 'USDT') {
    // Convert Decimal128 to number for calculation
    const currentBalance = parseFloat(this.availableBalance.toString()) || 0;
    const newBalance = DecimalCalc.max(0, DecimalCalc.add(currentBalance, amount)); // Ensure balance doesn't go negative
    
    this.availableBalance = mongoose.Types.Decimal128.fromString(newBalance.toString());
    
    // Invalidate user cache after balance update
    const userId = this._id.toString();
    CacheInvalidationService.invalidateBalanceCache(userId);
    
    return this.save();
  }
  
  throw new Error(`Unsupported currency: ${currency}`);
};

module.exports = mongoose.model('User', userSchema);