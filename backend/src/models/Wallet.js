const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const walletSchema = new mongoose.Schema({
  // Wallet Identification
  walletId: {
    type: String,
    unique: true,
    default: () => `WAL_${uuidv4().replace(/-/g, '').substring(0, 12).toUpperCase()}`
  },
  
  // Wallet Information
  address: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    validate: {
      validator: function(v) {
        // Basic BEP-20/ERC-20 address validation (42 characters, starts with 0x)
        return /^0x[a-fA-F0-9]{40}$/.test(v);
      },
      message: 'Invalid wallet address format'
    }
  },
  
  // Network Information
  network: {
    type: String,
    required: true,
    enum: ['BSC', 'ETH', 'POLYGON'],
    default: 'BSC'
  },
  tokenContract: {
    type: String,
    required: true,
    default: '0x55d398326f99059fF775485246999027B3197955', // USDT on BSC
    validate: {
      validator: function(v) {
        return /^0x[a-fA-F0-9]{40}$/.test(v);
      },
      message: 'Invalid token contract address'
    }
  },
  tokenSymbol: {
    type: String,
    required: true,
    default: 'USDT',
    uppercase: true
  },
  
  // Wallet Status
  isActive: {
    type: Boolean,
    default: true
  },
  isAvailable: {
    type: Boolean,
    default: true
  },
  
  // Usage Tracking
  totalAssigned: {
    type: Number,
    default: 0,
    min: 0
  },
  totalReceived: {
    type: Number,
    default: 0,
    min: 0
  },
  lastUsed: {
    type: Date
  },
  
  // Assignment Information
  currentAssignment: {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    purchaseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Purchase'
    },
    assignedAt: {
      type: Date
    },
    expectedAmount: {
      type: Number,
      min: 0
    },
    expiresAt: {
      type: Date
    }
  },
  
  // Security and Monitoring
  privateKeyEncrypted: {
    type: String,
    select: false // Never include in queries by default
  },
  monitoringEnabled: {
    type: Boolean,
    default: true
  },
  
  // Metadata
  label: {
    type: String,
    trim: true
  },
  notes: {
    type: String,
    trim: true
  },
  
  // Performance Metrics
  averageConfirmationTime: {
    type: Number, // in minutes
    default: 0
  },
  successfulTransactions: {
    type: Number,
    default: 0,
    min: 0
  },
  failedTransactions: {
    type: Number,
    default: 0,
    min: 0
  }
}, {
  timestamps: true
});

// Indexes
walletSchema.index({ address: 1 });
walletSchema.index({ walletId: 1 });
walletSchema.index({ isActive: 1, isAvailable: 1 });
walletSchema.index({ network: 1, tokenSymbol: 1 });
walletSchema.index({ 'currentAssignment.userId': 1 });
walletSchema.index({ 'currentAssignment.expiresAt': 1 });
walletSchema.index({ lastUsed: 1 });

// Virtual for assignment status
walletSchema.virtual('isAssigned').get(function() {
  return !!(this.currentAssignment && 
           this.currentAssignment.userId && 
           this.currentAssignment.expiresAt > new Date());
});

// Virtual for success rate
walletSchema.virtual('successRate').get(function() {
  const total = this.successfulTransactions + this.failedTransactions;
  return total > 0 ? (this.successfulTransactions / total) * 100 : 0;
});

// Method to assign wallet to user
walletSchema.methods.assignToUser = function(userId, purchaseId, expectedAmount, expirationHours = 24) {
  this.currentAssignment = {
    userId,
    purchaseId,
    assignedAt: new Date(),
    expectedAmount,
    expiresAt: new Date(Date.now() + expirationHours * 60 * 60 * 1000)
  };
  this.isAvailable = false;
  this.lastUsed = new Date();
  this.totalAssigned += 1;
  
  return this.save();
};

// Method to release wallet assignment
walletSchema.methods.releaseAssignment = function() {
  this.currentAssignment = undefined;
  this.isAvailable = true;
  
  return this.save();
};

// Method to confirm payment received
walletSchema.methods.confirmPayment = function(amount) {
  this.totalReceived += amount;
  this.successfulTransactions += 1;
  
  // Release assignment after successful payment
  return this.releaseAssignment();
};

// Method to mark transaction as failed
walletSchema.methods.markTransactionFailed = function() {
  this.failedTransactions += 1;
  
  // Release assignment after failed transaction
  return this.releaseAssignment();
};

// Static method to find available wallets
walletSchema.statics.findAvailable = function(network = 'BSC', tokenSymbol = 'USDT') {
  return this.find({
    isActive: true,
    isAvailable: true,
    network,
    tokenSymbol,
    $or: [
      { 'currentAssignment.expiresAt': { $lt: new Date() } },
      { 'currentAssignment.expiresAt': { $exists: false } }
    ]
  }).sort({ lastUsed: 1, totalAssigned: 1 });
};

// Static method to get next available wallet
walletSchema.statics.getNextAvailable = async function(network = 'BSC', tokenSymbol = 'USDT') {
  // First, release expired assignments
  await this.updateMany(
    {
      'currentAssignment.expiresAt': { $lt: new Date() },
      isAvailable: false
    },
    {
      $unset: { currentAssignment: 1 },
      $set: { isAvailable: true }
    }
  );
  
  // Find and return the least used available wallet
  return this.findOne({
    isActive: true,
    isAvailable: true,
    network,
    tokenSymbol
  }).sort({ lastUsed: 1, totalAssigned: 1 });
};

// Static method to find by address
walletSchema.statics.findByAddress = function(address) {
  return this.findOne({ address: address.toLowerCase() });
};

// Pre-save middleware to normalize address
walletSchema.pre('save', function(next) {
  if (this.isModified('address')) {
    this.address = this.address.toLowerCase();
  }
  if (this.isModified('tokenContract')) {
    this.tokenContract = this.tokenContract.toLowerCase();
  }
  next();
});

module.exports = mongoose.model('Wallet', walletSchema);