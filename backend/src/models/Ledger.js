const mongoose = require('mongoose');

const ledgerSchema = new mongoose.Schema({
  // User who owns this ledger entry
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  // Type of ledger entry
  type: {
    type: String,
    enum: [
      'PURCHASE',           // Initial purchase
      'PAYMENT_RECEIVED',   // Payment confirmation
      'REFERRAL_DIRECT',    // Direct referral commission (10%)
      'REFERRAL_INDIRECT',  // Indirect referral commission
      'WITHDRAWAL',         // User withdrawal
      'ADJUSTMENT',         // Manual adjustment
      'BONUS',             // Special bonus
      'PENALTY',           // Penalty or fee
      'TRANSFER_IN',       // Transfer from another user
      'TRANSFER_OUT'       // Transfer to another user
    ],
    required: true,
    index: true
  },
  
  // Amount (positive for credits, negative for debits)
  amount: {
    type: Number,
    required: true,
    index: true
  },
  
  // Currency
  currency: {
    type: String,
    required: true,
    default: 'USDT',
    enum: ['USDT', 'USD', 'BTC', 'ETH', 'BNB']
  },
  
  // Running balance after this transaction
  balance: {
    type: Number,
    required: true,
    index: true
  },
  
  // Description of the transaction
  description: {
    type: String,
    required: true
  },
  
  // Reference to related entities
  references: {
    purchaseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Purchase'
    },
    paymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Payment'
    },
    benefitScheduleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BenefitSchedule'
    },
    referralUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    withdrawalId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Withdrawal'
    },
    transferId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Transfer'
    }
  },
  
  // Idempotency keys for different transaction types
  idempotencyKey: {
    type: String,
    sparse: true, // Allow null values but enforce uniqueness when present
    index: true
  },
  
  // Specific idempotency keys for benefits and referrals
  benefitIdempotencyKey: {
    type: String,
    sparse: true,
    index: true
    // Format: "benefit_{purchaseId}_{day}" e.g., "benefit_507f1f77bcf86cd799439011_3"
  },
  
  referralIdempotencyKey: {
    type: String,
    sparse: true,
    index: true
    // Format: "referral_{purchaseId}_{referralUserId}" e.g., "referral_507f1f77bcf86cd799439011_507f1f77bcf86cd799439012"
  },
  
  // Transaction status
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'failed', 'cancelled'],
    default: 'confirmed',
    index: true
  },
  
  // Transaction date (can be different from createdAt for scheduled transactions)
  transactionDate: {
    type: Date,
    required: true,
    default: Date.now,
    index: true
  },
  
  // Processing metadata
  metadata: {
    // Who/what created this entry
    createdBy: {
      type: String,
      default: 'system'
    },
    
    // Source of the transaction
    source: {
      type: String,
      enum: ['api', 'cron', 'admin', 'system', 'webhook'],
      default: 'system'
    },
    
    // Additional data specific to transaction type
    benefitDay: {
      type: Number,
      min: 0,
      max: 7 // Days 0-7 for 8-day benefit schedule
    },
    
    referralLevel: {
      type: Number,
      min: 1,
      max: 10 // Support up to 10 levels of referrals
    },
    
    // Original transaction hash (for blockchain-related entries)
    txHash: {
      type: String,
      index: true
    },
    
    // Network information
    network: {
      type: String,
      enum: ['BEP20', 'ERC20', 'TRC20', 'internal']
    },
    
    // Additional notes
    notes: String,
    
    // Version for schema evolution
    version: {
      type: Number,
      default: 1
    }
  }
}, {
  timestamps: true,
  collection: 'ledger'
});

// Compound indexes for performance and uniqueness
ledgerSchema.index({ userId: 1, createdAt: -1 }); // User transaction history
ledgerSchema.index({ userId: 1, type: 1, transactionDate: -1 }); // User transactions by type
ledgerSchema.index({ type: 1, transactionDate: -1 }); // All transactions by type
ledgerSchema.index({ transactionDate: -1 }); // Recent transactions
ledgerSchema.index({ status: 1, transactionDate: -1 }); // Transactions by status

// Unique indexes for idempotency
ledgerSchema.index({ benefitIdempotencyKey: 1 }, { 
  unique: true, 
  sparse: true,
  name: 'benefit_idempotency_unique'
});

ledgerSchema.index({ referralIdempotencyKey: 1 }, { 
  unique: true, 
  sparse: true,
  name: 'referral_idempotency_unique'
});

ledgerSchema.index({ idempotencyKey: 1 }, { 
  unique: true, 
  sparse: true,
  name: 'general_idempotency_unique'
});

// Compound index for benefit processing
ledgerSchema.index({ 
  'references.benefitScheduleId': 1, 
  'metadata.benefitDay': 1 
}, {
  name: 'benefit_schedule_day_lookup'
});

// Compound index for referral processing
ledgerSchema.index({ 
  'references.purchaseId': 1, 
  'references.referralUserId': 1,
  type: 1
}, {
  name: 'referral_purchase_lookup'
});

// Compound index for upsert anti-duplicate checks
ledgerSchema.index({
  'references.purchaseId': 1,
  type: 1,
  userId: 1,
  'metadata.benefitDay': 1
}, {
  name: 'upsert_duplicate_prevention',
  sparse: true
});

// Additional index for referral upsert checks
ledgerSchema.index({
  'references.purchaseId': 1,
  type: 1,
  userId: 1,
  'metadata.referralLevel': 1
}, {
  name: 'referral_upsert_duplicate_prevention',
  sparse: true
});

// Virtual for transaction direction
ledgerSchema.virtual('direction').get(function() {
  return this.amount >= 0 ? 'credit' : 'debit';
});

// Virtual for absolute amount
ledgerSchema.virtual('absoluteAmount').get(function() {
  return Math.abs(this.amount);
});

// Method to generate benefit idempotency key
ledgerSchema.statics.generateBenefitIdempotencyKey = function(purchaseId, day) {
  return `benefit_${purchaseId}_${day}`;
};

// Method to generate referral idempotency key
ledgerSchema.statics.generateReferralIdempotencyKey = function(purchaseId, referralUserId) {
  return `referral_${purchaseId}_${referralUserId}`;
};

// Static method to create benefit accrual entry
// Static method to create referral commission entry
ledgerSchema.statics.createReferralCommission = async function({
  userId,
  amount,
  purchaseId,
  referralUserId,
  level = 1,
  description
}) {
  const referralIdempotencyKey = this.generateReferralIdempotencyKey(purchaseId, userId);
  
  // Get current balance
  const lastEntry = await this.findOne(
    { userId },
    {},
    { sort: { createdAt: -1 } }
  );
  
  const currentBalance = lastEntry ? lastEntry.balance : 0;
  const newBalance = currentBalance + amount;
  
  const entry = new this({
    userId,
    type: level === 1 ? 'REFERRAL_DIRECT' : 'REFERRAL_INDIRECT',
    amount,
    currency: 'USDT',
    balance: newBalance,
    description: description || `Level ${level} referral commission`,
    references: {
      purchaseId,
      referralUserId
    },
    referralIdempotencyKey,
    metadata: {
      referralLevel: level,
      createdBy: 'referral-cron',
      source: 'cron',
      version: 1
    }
  });
  
  return await entry.save();
};

// Static method to get user balance
ledgerSchema.statics.getUserBalance = async function(userId) {
  const lastEntry = await this.findOne(
    { userId, status: 'confirmed' },
    { balance: 1 },
    { sort: { createdAt: -1 } }
  );
  
  return lastEntry ? lastEntry.balance : 0;
};

// Static method to get user transaction history
ledgerSchema.statics.getUserHistory = function(userId, options = {}) {
  const {
    limit = 50,
    skip = 0,
    type,
    startDate,
    endDate
  } = options;
  
  const query = { userId, status: 'confirmed' };
  
  if (type) {
    query.type = type;
  }
  
  if (startDate || endDate) {
    query.transactionDate = {};
    if (startDate) query.transactionDate.$gte = new Date(startDate);
    if (endDate) query.transactionDate.$lte = new Date(endDate);
  }
  
  return this.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip(skip)
    .populate('references.purchaseId', 'priceUSDT confirmedAt')
    .populate('references.referralUserId', 'username email');
};

// Static method for upsert to prevent duplicates by (purchaseId, type, dayIndex)
ledgerSchema.statics.upsertEntry = async function({
  userId,
  type,
  amount,
  currency = 'USDT',
  description,
  purchaseId,
  benefitScheduleId,
  referralUserId,
  dayIndex,
  level,
  metadata = {}
}) {
  // Build the unique query based on purchaseId, type, and dayIndex
  const uniqueQuery = {
    'references.purchaseId': purchaseId,
    type: type
  };
  
  // Add dayIndex to query if provided (for benefit entries)
  if (dayIndex !== undefined && dayIndex !== null) {
    uniqueQuery['metadata.benefitDay'] = dayIndex;
  }
  
  // Add referral level to query if provided (for referral entries)
  if (level !== undefined && level !== null) {
    uniqueQuery['metadata.referralLevel'] = level;
  }
  
  // Add userId to ensure we're checking for the right user
  uniqueQuery.userId = userId;
  
  // Check if entry already exists
  const existingEntry = await this.findOne(uniqueQuery);
  
  if (existingEntry) {
    // Entry already exists, return it without creating duplicate
    return {
      entry: existingEntry,
      created: false,
      message: 'Entry already exists'
    };
  }
  
  // Get current balance for the user
  const lastEntry = await this.findOne(
    { userId },
    {},
    { sort: { createdAt: -1 } }
  );
  
  const currentBalance = lastEntry ? lastEntry.balance : 0;
  const newBalance = currentBalance + amount;
  
  // Generate appropriate idempotency key
  let idempotencyKey;
  if (type.includes('BENEFIT')) {
    idempotencyKey = this.generateBenefitIdempotencyKey(purchaseId, dayIndex);
  } else if (type.includes('REFERRAL')) {
    idempotencyKey = this.generateReferralIdempotencyKey(purchaseId, userId);
  }
  
  // Build the new entry data
  const entryData = {
    userId,
    type,
    amount,
    currency,
    balance: newBalance,
    description,
    references: {
      purchaseId
    },
    metadata: {
      createdBy: metadata.createdBy || 'system',
      source: metadata.source || 'upsert',
      version: metadata.version || 1,
      ...metadata
    }
  };
  
  // Add specific references and metadata based on type
  if (benefitScheduleId) {
    entryData.references.benefitScheduleId = benefitScheduleId;
  }
  
  if (referralUserId) {
    entryData.references.referralUserId = referralUserId;
  }
  
  if (dayIndex !== undefined && dayIndex !== null) {
    entryData.metadata.benefitDay = dayIndex;
  }
  
  if (level !== undefined && level !== null) {
    entryData.metadata.referralLevel = level;
  }
  
  // Add idempotency key if generated
  if (idempotencyKey) {
    if (type.includes('BENEFIT')) {
      entryData.benefitIdempotencyKey = idempotencyKey;
    } else if (type.includes('REFERRAL')) {
      entryData.referralIdempotencyKey = idempotencyKey;
    }
  }
  
  // Create and save the new entry
  const newEntry = new this(entryData);
  const savedEntry = await newEntry.save();
  
  return {
    entry: savedEntry,
    created: true,
    message: 'New entry created'
  };
};

// Pre-save middleware for validation
ledgerSchema.pre('save', function(next) {
  // Ensure balance is calculated correctly
  if (this.isNew && !this.balance && this.balance !== 0) {
    return next(new Error('Balance must be calculated before saving'));
  }
  
  // Validate idempotency keys format
  if (this.benefitIdempotencyKey && !this.benefitIdempotencyKey.startsWith('benefit_')) {
    return next(new Error('Invalid benefit idempotency key format'));
  }
  
  if (this.referralIdempotencyKey && !this.referralIdempotencyKey.startsWith('referral_')) {
    return next(new Error('Invalid referral idempotency key format'));
  }
  
  next();
});

// Export the model
module.exports = mongoose.model('Ledger', ledgerSchema);