/**
 * MongoDB JSON Schema Validators for USDT/BEP20 Hardening
 * Enforces data integrity at the database level using MongoDB Atlas schema validation
 * Part of the comprehensive security hardening implementation
 */

const { ALLOWED_CONFIG } = require('./usdtBep20Validators');

/**
 * Wallet Collection Schema Validator
 * Enforces USDT/BEP20 only configuration at database level
 */
const walletSchemaValidator = {
  $jsonSchema: {
    bsonType: 'object',
    required: ['walletId', 'address', 'network', 'currency', 'status', 'isActive'],
    properties: {
      walletId: {
        bsonType: 'string',
        minLength: 1,
        maxLength: 100,
        description: 'Unique wallet identifier'
      },
      address: {
        bsonType: 'string',
        pattern: '^0x[a-fA-F0-9]{40}$',
        description: 'BEP20 wallet address - must be valid Ethereum-style address'
      },
      network: {
        bsonType: 'string',
        enum: [ALLOWED_CONFIG.network],
        description: 'Network type - only BEP20 allowed'
      },
      currency: {
        bsonType: 'string',
        enum: [ALLOWED_CONFIG.currency],
        description: 'Currency type - only USDT allowed'
      },
      status: {
        bsonType: 'string',
        enum: ['AVAILABLE', 'ASSIGNED', 'DISABLED', 'MAINTENANCE'],
        description: 'Current wallet status'
      },
      isActive: {
        bsonType: 'bool',
        description: 'Whether wallet is active'
      },
      label: {
        bsonType: 'string',
        maxLength: 200,
        description: 'Optional wallet label'
      },
      notes: {
        bsonType: 'string',
        maxLength: 1000,
        description: 'Optional notes about the wallet'
      },
      totalReceived: {
        bsonType: 'number',
        minimum: 0,
        description: 'Total amount received by this wallet'
      },
      totalAssigned: {
        bsonType: 'number',
        minimum: 0,
        description: 'Total amount assigned to this wallet'
      },
      successfulTransactions: {
        bsonType: 'int',
        minimum: 0,
        description: 'Number of successful transactions'
      },
      failedTransactions: {
        bsonType: 'int',
        minimum: 0,
        description: 'Number of failed transactions'
      },
      shownCount: {
        bsonType: 'int',
        minimum: 0,
        description: 'Number of times wallet was shown to users'
      },
      lastUsed: {
        bsonType: 'date',
        description: 'Last time wallet was used'
      },
      lastShownAt: {
        bsonType: 'date',
        description: 'Last time wallet was shown to a user'
      },
      createdAt: {
        bsonType: 'date',
        description: 'Wallet creation timestamp'
      },
      updatedAt: {
        bsonType: 'date',
        description: 'Last update timestamp'
      }
    },
    additionalProperties: false
  }
};

/**
 * Withdrawal Collection Schema Validator
 * Enforces USDT/BEP20 only withdrawals
 */
const withdrawalSchemaValidator = {
  $jsonSchema: {
    bsonType: 'object',
    required: ['userId', 'amount', 'walletAddress', 'network', 'currency', 'status'],
    properties: {
      userId: {
        bsonType: 'objectId',
        description: 'Reference to user making withdrawal'
      },
      amount: {
        bsonType: 'number',
        minimum: 0.01,
        maximum: 1000000,
        description: 'Withdrawal amount in USDT'
      },
      walletAddress: {
        bsonType: 'string',
        pattern: '^0x[a-fA-F0-9]{40}$',
        description: 'Destination BEP20 wallet address'
      },
      network: {
        bsonType: 'string',
        enum: [ALLOWED_CONFIG.network],
        description: 'Network type - only BEP20 allowed'
      },
      currency: {
        bsonType: 'string',
        enum: [ALLOWED_CONFIG.currency],
        description: 'Currency type - only USDT allowed'
      },
      status: {
        bsonType: 'string',
        enum: ['PENDING', 'APPROVED', 'PROCESSING', 'COMPLETED', 'REJECTED', 'CANCELLED'],
        description: 'Current withdrawal status'
      },
      transactionHash: {
        bsonType: 'string',
        pattern: '^0x[a-fA-F0-9]{64}$',
        description: 'Blockchain transaction hash when completed'
      },
      fee: {
        bsonType: 'number',
        minimum: 0,
        description: 'Network fee for the withdrawal'
      },
      netAmount: {
        bsonType: 'number',
        minimum: 0,
        description: 'Net amount after fees'
      },
      notes: {
        bsonType: 'string',
        maxLength: 500,
        description: 'Optional notes about the withdrawal'
      },
      rejectionReason: {
        bsonType: 'string',
        maxLength: 500,
        description: 'Reason for rejection if applicable'
      },
      approvedBy: {
        bsonType: 'objectId',
        description: 'Admin user who approved the withdrawal'
      },
      approvedAt: {
        bsonType: 'date',
        description: 'Approval timestamp'
      },
      completedAt: {
        bsonType: 'date',
        description: 'Completion timestamp'
      },
      createdAt: {
        bsonType: 'date',
        description: 'Withdrawal request timestamp'
      },
      updatedAt: {
        bsonType: 'date',
        description: 'Last update timestamp'
      }
    },
    additionalProperties: false
  }
};

/**
 * Purchase Collection Schema Validator
 * Enforces USDT/BEP20 only purchases
 */
const purchaseSchemaValidator = {
  $jsonSchema: {
    bsonType: 'object',
    required: ['userId', 'packageId', 'amount', 'totalAmount', 'status'],
    properties: {
      userId: {
        bsonType: 'objectId',
        description: 'Reference to user making purchase'
      },
      packageId: {
        bsonType: 'objectId',
        description: 'Reference to package being purchased'
      },
      amount: {
        bsonType: 'number',
        minimum: 0.01,
        description: 'Purchase amount in USDT'
      },
      totalAmount: {
        bsonType: 'number',
        minimum: 0.01,
        description: 'Total amount including fees in USDT'
      },
      payTo: {
        bsonType: 'string',
        pattern: '^0x[a-fA-F0-9]{40}$',
        description: 'Payment destination BEP20 address'
      },
      paymentAddress: {
        bsonType: 'string',
        pattern: '^0x[a-fA-F0-9]{40}$',
        description: 'Alternative payment address field'
      },
      network: {
        bsonType: 'string',
        enum: [ALLOWED_CONFIG.network],
        description: 'Payment network - only BEP20 allowed'
      },
      currency: {
        bsonType: 'string',
        enum: [ALLOWED_CONFIG.currency],
        description: 'Payment currency - only USDT allowed'
      },
      status: {
        bsonType: 'string',
        enum: ['PENDING', 'CONFIRMED', 'COMPLETED', 'EXPIRED', 'CANCELLED'],
        description: 'Current purchase status'
      },
      transactionHash: {
        bsonType: 'string',
        pattern: '^0x[a-fA-F0-9]{64}$',
        description: 'Blockchain transaction hash when confirmed'
      },
      assignedWallet: {
        bsonType: 'objectId',
        description: 'Reference to assigned wallet for payment'
      },
      displayWalletId: {
        bsonType: 'objectId',
        description: 'Reference to wallet shown to user'
      },
      confirmationCount: {
        bsonType: 'int',
        minimum: 0,
        description: 'Number of blockchain confirmations'
      },
      expiresAt: {
        bsonType: 'date',
        description: 'Purchase expiration timestamp'
      },
      confirmedAt: {
        bsonType: 'date',
        description: 'Payment confirmation timestamp'
      },
      completedAt: {
        bsonType: 'date',
        description: 'Purchase completion timestamp'
      },
      createdAt: {
        bsonType: 'date',
        description: 'Purchase creation timestamp'
      },
      updatedAt: {
        bsonType: 'date',
        description: 'Last update timestamp'
      }
    },
    additionalProperties: false
  }
};

/**
 * Transaction Collection Schema Validator
 * Enforces USDT/BEP20 only transactions
 */
const transactionSchemaValidator = {
  $jsonSchema: {
    bsonType: 'object',
    required: ['userId', 'type', 'amount', 'currency', 'status'],
    properties: {
      userId: {
        bsonType: 'objectId',
        description: 'Reference to user'
      },
      type: {
        bsonType: 'string',
        enum: ['DEPOSIT', 'WITHDRAWAL', 'COMMISSION', 'BENEFIT', 'REFUND', 'FEE'],
        description: 'Transaction type'
      },
      amount: {
        bsonType: 'number',
        description: 'Transaction amount (can be negative for debits)'
      },
      currency: {
        bsonType: 'string',
        enum: [ALLOWED_CONFIG.currency],
        description: 'Transaction currency - only USDT allowed'
      },
      network: {
        bsonType: 'string',
        enum: [ALLOWED_CONFIG.network],
        description: 'Network type - only BEP20 allowed'
      },
      status: {
        bsonType: 'string',
        enum: ['PENDING', 'CONFIRMED', 'FAILED', 'CANCELLED'],
        description: 'Transaction status'
      },
      walletAddress: {
        bsonType: 'string',
        pattern: '^0x[a-fA-F0-9]{40}$',
        description: 'Associated BEP20 wallet address'
      },
      transactionHash: {
        bsonType: 'string',
        pattern: '^0x[a-fA-F0-9]{64}$',
        description: 'Blockchain transaction hash'
      },
      blockNumber: {
        bsonType: 'int',
        minimum: 0,
        description: 'Block number where transaction was mined'
      },
      confirmationCount: {
        bsonType: 'int',
        minimum: 0,
        description: 'Number of blockchain confirmations'
      },
      relatedPurchase: {
        bsonType: 'objectId',
        description: 'Reference to related purchase if applicable'
      },
      relatedWithdrawal: {
        bsonType: 'objectId',
        description: 'Reference to related withdrawal if applicable'
      },
      description: {
        bsonType: 'string',
        maxLength: 500,
        description: 'Transaction description'
      },
      metadata: {
        bsonType: 'object',
        description: 'Additional transaction metadata'
      },
      createdAt: {
        bsonType: 'date',
        description: 'Transaction creation timestamp'
      },
      updatedAt: {
        bsonType: 'date',
        description: 'Last update timestamp'
      }
    },
    additionalProperties: false
  }
};

/**
 * MongoDB Atlas Schema Validation Commands
 * Use these commands to apply schema validation to collections
 */
const atlasValidationCommands = {
  // Apply wallet schema validation
  applyWalletValidation: {
    collMod: 'wallets',
    validator: walletSchemaValidator,
    validationLevel: 'strict',
    validationAction: 'error'
  },
  
  // Apply withdrawal schema validation
  applyWithdrawalValidation: {
    collMod: 'withdrawals',
    validator: withdrawalSchemaValidator,
    validationLevel: 'strict',
    validationAction: 'error'
  },
  
  // Apply purchase schema validation
  applyPurchaseValidation: {
    collMod: 'purchases',
    validator: purchaseSchemaValidator,
    validationLevel: 'strict',
    validationAction: 'error'
  },
  
  // Apply transaction schema validation
  applyTransactionValidation: {
    collMod: 'transactions',
    validator: transactionSchemaValidator,
    validationLevel: 'strict',
    validationAction: 'error'
  }
};

/**
 * Function to apply all schema validations to MongoDB Atlas
 * This should be run during deployment to enforce USDT/BEP20 hardening
 */
const applyAllSchemaValidations = async (db) => {
  const results = [];
  
  try {
    console.log('🔒 Aplicando validaciones de esquema USDT/BEP20 a MongoDB Atlas...');
    
    // Apply wallet validation
    console.log('📝 Aplicando validación de wallets...');
    const walletResult = await db.command(atlasValidationCommands.applyWalletValidation);
    results.push({ collection: 'wallets', result: walletResult });
    
    // Apply withdrawal validation
    console.log('📝 Aplicando validación de retiros...');
    const withdrawalResult = await db.command(atlasValidationCommands.applyWithdrawalValidation);
    results.push({ collection: 'withdrawals', result: withdrawalResult });
    
    // Apply purchase validation
    console.log('📝 Aplicando validación de compras...');
    const purchaseResult = await db.command(atlasValidationCommands.applyPurchaseValidation);
    results.push({ collection: 'purchases', result: purchaseResult });
    
    // Apply transaction validation
    console.log('📝 Aplicando validación de transacciones...');
    const transactionResult = await db.command(atlasValidationCommands.applyTransactionValidation);
    results.push({ collection: 'transactions', result: transactionResult });
    
    console.log('✅ Todas las validaciones de esquema aplicadas exitosamente');
    return results;
    
  } catch (error) {
    console.error('❌ Error aplicando validaciones de esquema:', error);
    throw error;
  }
};

/**
 * Function to remove schema validations (for development/testing)
 */
const removeAllSchemaValidations = async (db) => {
  const collections = ['wallets', 'withdrawals', 'purchases', 'transactions'];
  const results = [];
  
  try {
    console.log('🔓 Removiendo validaciones de esquema...');
    
    for (const collection of collections) {
      console.log(`📝 Removiendo validación de ${collection}...`);
      const result = await db.command({
        collMod: collection,
        validator: {},
        validationLevel: 'off'
      });
      results.push({ collection, result });
    }
    
    console.log('✅ Todas las validaciones removidas exitosamente');
    return results;
    
  } catch (error) {
    console.error('❌ Error removiendo validaciones:', error);
    throw error;
  }
};

module.exports = {
  walletSchemaValidator,
  withdrawalSchemaValidator,
  purchaseSchemaValidator,
  transactionSchemaValidator,
  atlasValidationCommands,
  applyAllSchemaValidations,
  removeAllSchemaValidations
};