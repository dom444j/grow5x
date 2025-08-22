const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const { DecimalCalc } = require('../utils/decimal');

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
    enum: ['BEP20'],
    default: 'BEP20'
  },
  currency: {
    type: String,
    required: true,
    enum: ['USDT'],
    default: 'USDT',
    uppercase: true
  },
  purpose: {
    type: String,
    required: true,
    enum: ['collection'],
    default: 'collection'
  },
  tokenContract: {
    type: String,
    required: true,
    default: '0x55d398326f99059fF775485246999027B3197955', // USDT on BEP20
    validate: {
      validator: function(v) {
        return /^0x[a-fA-F0-9]{40}$/.test(v);
      },
      message: 'Invalid token contract address'
    }
  },
  
  // Wallet Status (Pool V2: simplified states)
  isActive: {
    type: Boolean,
    default: true
  },
  status: {
    type: String,
    enum: ['AVAILABLE', 'LOCKED', 'DISABLED'],
    default: 'AVAILABLE'
  },
  // Pool V2 LRS (Least Recently Shown) fields
  lastShownAt: {
    type: Date,
    default: new Date(0)
  },
  shownCount: {
    type: Number,
    default: 0,
    min: 0
  },
  
  // Legacy Pool V1 fields (deprecated)
  lastServedAt: {
    type: Date,
    default: new Date(0)
  },
  assignedCount: {
    type: Number,
    default: 0
  },
  lockUntil: {
    type: Date
  },
  orderId: {
    type: String
  },
  lockedBy: {
    type: String
  },
  lockReason: {
    type: String
  },
  
  // Usage Tracking
  totalAssigned: {
    type: Number,
    default: 0,
    min: 0
  },
  totalReceived: {
    type: mongoose.Schema.Types.Decimal128,
    default: 0,
    min: 0
  },
  lastUsed: {
    type: Date
  },
  
  // Pool V2: LRS (Least Recently Shown) rotation tracking
  lastShownAt: {
    type: Date,
    default: null
  },
  shownCount: {
    type: Number,
    default: 0,
    min: 0
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

// Basic indexes
walletSchema.index({ address: 1, network: 1 }, { unique: true }); // Unique constraint
walletSchema.index({ walletId: 1 });
walletSchema.index({ isActive: 1, status: 1 });
walletSchema.index({ network: 1, currency: 1, purpose: 1 });

// Pool V2 LRS indexes (active)
walletSchema.index({ shownCount: 1, lastShownAt: 1, _id: 1 }); // LRS rotation order
walletSchema.index({ network: 1, currency: 1, status: 1, shownCount: 1, lastShownAt: 1 }); // Pool V2 query optimization

// Pool V1 legacy indexes (deprecated)
walletSchema.index({ status: 1, lockUntil: 1 }); // Legacy lock system
walletSchema.index({ assignedCount: 1, lastServedAt: 1, _id: 1 }); // Legacy LRS order

// Virtual for Pool V2 status
walletSchema.virtual('isAvailable').get(function() {
  return this.status === 'available' && this.isActive;
});

walletSchema.virtual('displayInfo').get(function() {
  return {
    address: this.address,
    network: this.network,
    currency: this.currency
  };
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
  this.status = 'assigned';
  this.lastUsed = new Date();
  this.totalAssigned += 1;
  
  return this.save();
};

// Alias method for backward compatibility
walletSchema.methods.assignTo = function(purchaseId, userId, expectedAmount, expirationHours = 24) {
  return this.assignToUser(userId, purchaseId, expectedAmount, expirationHours);
};

// Method to release wallet assignment
walletSchema.methods.releaseAssignment = function(cooldownMinutes = 15) {
  this.currentAssignment = undefined;
  this.status = 'cooldown';
  this.cooldownUntil = new Date(Date.now() + cooldownMinutes * 60 * 1000);
  
  return this.save();
};

// Method to release wallet on purchase expiration
walletSchema.methods.releaseOnExpiration = function() {
  return this.releaseAssignment(15); // 15 minute cooldown for expired purchases
};

// Method to make wallet available again
walletSchema.methods.makeAvailable = function() {
  this.status = 'available';
  this.cooldownUntil = null;
  
  return this.save();
};

// Method to confirm payment received
walletSchema.methods.confirmPayment = function(amount) {
  const currentReceived = parseFloat(this.totalReceived.toString()) || 0;
  this.totalReceived = DecimalCalc.add(currentReceived, amount);
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
walletSchema.statics.findAvailable = function(network = 'BEP20', currency = 'USDT') {
  const now = new Date();
  return this.find({
    isActive: true,
    network,
    currency,
    purpose: 'collection',
    $or: [
      { status: 'available' },
      { 
        status: 'cooldown',
        cooldownUntil: { $lt: now }
      },
      {
        status: 'assigned',
        'currentAssignment.expiresAt': { $lt: now }
      }
    ]
  }).sort({ lastUsed: 1, totalAssigned: 1 });
};

// Static method to get next available wallet with atomic assignment
walletSchema.statics.getNextAvailable = async function(network = 'BEP20', currency = 'USDT') {
  const now = new Date();
  
  // First, clean up expired assignments and cooldowns
  await this.updateMany(
    {
      status: 'cooldown',
      cooldownUntil: { $lt: now }
    },
    {
      $set: { status: 'available' },
      $unset: { cooldownUntil: 1 }
    }
  );
  
  await this.updateMany(
    {
      status: 'assigned',
      'currentAssignment.expiresAt': { $lt: now }
    },
    {
      $set: { status: 'available' },
      $unset: { currentAssignment: 1 }
    }
  );
  
  // Find truly available wallets
  const availableWallets = await this.find({
    isActive: true,
    status: 'available',
    network,
    currency,
    purpose: 'collection'
  });
  
  if (availableWallets.length === 0) {
    throw new Error('No available wallets found');
  }
  
  // Random selection to prevent predictable patterns
  const randomIndex = Math.floor(Math.random() * availableWallets.length);
  return availableWallets[randomIndex];
};

// Static method for atomic wallet assignment with random selection
walletSchema.statics.assignWalletAtomic = async function(network = 'BEP20', currency = 'USDT', purchaseId, userId, expectedAmount) {
  const now = new Date();
  
  // First, clean up expired assignments and cooldowns
  await this.updateMany(
    {
      status: 'cooldown',
      cooldownUntil: { $lt: now }
    },
    {
      $set: { status: 'available' },
      $unset: { cooldownUntil: 1 }
    }
  );
  
  await this.updateMany(
    {
      status: 'assigned',
      'currentAssignment.expiresAt': { $lt: now }
    },
    {
      $set: { status: 'available' },
      $unset: { currentAssignment: 1 }
    }
  );
  
  // Get all available wallets for random selection
  const availableWallets = await this.find(
    {
      network,
      currency,
      purpose: 'collection',
      isActive: true,
      status: 'available'
    },
    { _id: 1 } // Only get IDs for performance
  );
  
  if (availableWallets.length === 0) {
    throw new Error('NO_WALLET_AVAILABLE');
  }
  
  // Random selection - each wallet has equal probability
  const randomIndex = Math.floor(Math.random() * availableWallets.length);
  const selectedWalletId = availableWallets[randomIndex]._id;
  
  // Atomic assignment operation
  const wallet = await this.findOneAndUpdate(
    {
      _id: selectedWalletId,
      status: 'available' // Double-check it's still available
    },
    {
      $set: {
        status: 'assigned',
        lastUsed: now,
        'currentAssignment.userId': userId,
        'currentAssignment.purchaseId': purchaseId,
        'currentAssignment.assignedAt': now,
        'currentAssignment.expectedAmount': expectedAmount,
        'currentAssignment.expiresAt': new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
      },
      $inc: { totalAssigned: 1 },
      $unset: { cooldownUntil: 1 }
    },
    {
      returnDocument: 'after'
    }
  );
  
  if (!wallet) {
    // Wallet was taken by another request, retry once
    return this.assignWalletAtomic(network, currency, purchaseId, userId, expectedAmount);
  }
  
  return wallet;
};

// Static methods for Pool V2
walletSchema.statics.getNextWalletLRS = async function(network = 'BEP20', currency = 'USDT') {
  const now = new Date();
  
  // LRS selection: least recently shown first, then by lowest shown count
  const wallet = await this.findOneAndUpdate(
    {
      network,
      currency,
      status: 'available',
      isActive: true
    },
    {
      $set: { lastShownAt: now },
      $inc: { shownCount: 1 }
    },
    {
      sort: { lastShownAt: 1, shownCount: 1 },
      new: true
    }
  );
  
  return wallet;
};

walletSchema.statics.getPoolStats = async function(network = 'BEP20', currency = 'USDT') {
  const stats = await this.aggregate([
    {
      $match: {
        network,
        currency
      }
    },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        available: {
          $sum: {
            $cond: [{ $and: [{ $eq: ['$status', 'available'] }, { $eq: ['$isActive', true] }] }, 1, 0]
          }
        },
        disabled: {
          $sum: {
            $cond: [{ $or: [{ $eq: ['$status', 'disabled'] }, { $eq: ['$isActive', false] }] }, 1, 0]
          }
        },
        avgShownCount: { $avg: '$shownCount' },
        maxShownCount: { $max: '$shownCount' },
        minShownCount: { $min: '$shownCount' },
        lastShownAt: { $max: '$lastShownAt' }
      }
    }
  ]);
  
  return stats[0] || {
    total: 0,
    available: 0,
    disabled: 0,
    avgShownCount: 0,
    maxShownCount: 0,
    minShownCount: 0,
    lastShownAt: null
  };
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