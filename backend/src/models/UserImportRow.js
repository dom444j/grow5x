const mongoose = require('mongoose');

const userImportRowSchema = new mongoose.Schema({
  // Job Reference
  jobId: {
    type: String,
    required: true,
    index: true
  },
  
  // Row Information
  rowIndex: {
    type: Number,
    required: true,
    min: 0
  },
  
  // Raw Data (as received)
  raw: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  
  // Normalized Data (after processing)
  normalized: {
    email: {
      type: String,
      trim: true,
      lowercase: true
    },
    
    firstName: {
      type: String,
      trim: true
    },
    
    lastName: {
      type: String,
      trim: true
    },
    
    phone: {
      type: String,
      trim: true
    },
    
    referralCode: {
      type: String,
      trim: true,
      uppercase: true
    },
    
    referredBy: {
      type: String,
      trim: true,
      uppercase: true
    },
    
    cohort: {
      type: String,
      trim: true
    },
    
    role: {
      type: String,
      default: 'user'
    },
    
    isActive: {
      type: Boolean,
      default: true
    },
    
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  },
  
  // Validation Results
  validationErrors: [{
    field: {
      type: String,
      required: true
    },
    
    code: {
      type: String,
      required: true,
      enum: [
        'REQUIRED_FIELD_MISSING',
        'INVALID_EMAIL_FORMAT',
        'INVALID_PHONE_FORMAT',
        'INVALID_REFERRAL_CODE',
        'EMAIL_ALREADY_EXISTS',
        'REFERRAL_CODE_ALREADY_EXISTS',
        'REFERRER_NOT_FOUND',
        'INVALID_COHORT',
        'INVALID_ROLE',
        'FIELD_TOO_LONG',
        'FIELD_TOO_SHORT',
        'INVALID_CHARACTER',
        'CUSTOM_VALIDATION_FAILED'
      ]
    },
    
    message: {
      type: String,
      required: true
    },
    
    value: {
      type: mongoose.Schema.Types.Mixed
    }
  }],
  
  // Deduplication Key
  dedupKey: {
    type: String,
    required: true,
    index: true
    // Format: "email:john@example.com" or "phone:+1234567890"
  },
  
  // Processing Status
  status: {
    type: String,
    enum: ['pending', 'valid', 'invalid', 'imported', 'skipped', 'failed'],
    default: 'pending',
    index: true
  },
  
  // Skip Reason (if skipped)
  skipReason: {
    type: String,
    enum: [
      'DUPLICATE_EMAIL',
      'DUPLICATE_PHONE',
      'DUPLICATE_REFERRAL_CODE',
      'USER_ALREADY_EXISTS',
      'VALIDATION_FAILED',
      'PROCESSING_ERROR',
      'MANUAL_SKIP'
    ]
  },
  
  // Import Results
  importResult: {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      sparse: true
    },
    
    createdAt: {
      type: Date
    },
    
    warnings: [{
      code: String,
      message: String,
      field: String
    }]
  },
  
  // Processing Information
  processedAt: {
    type: Date
  },
  
  processedBy: {
    type: String // Worker ID
  },
  
  processingTime: {
    type: Number, // milliseconds
    min: 0
  },
  
  // Retry Information
  retryCount: {
    type: Number,
    default: 0,
    min: 0,
    max: 3
  },
  
  lastRetryAt: {
    type: Date
  },
  
  // Error Information (for failed imports)
  errorDetails: {
    code: String,
    message: String,
    stack: String,
    context: mongoose.Schema.Types.Mixed
  }
}, {
  timestamps: true
});

// Compound Indexes
userImportRowSchema.index({ jobId: 1, rowIndex: 1 }, { unique: true });
userImportRowSchema.index({ jobId: 1, status: 1 });
userImportRowSchema.index({ dedupKey: 1, jobId: 1 });
userImportRowSchema.index({ status: 1, processedAt: 1 });
userImportRowSchema.index({ 'normalized.email': 1 }, { sparse: true });
userImportRowSchema.index({ 'normalized.referralCode': 1 }, { sparse: true });

// Virtual for is valid
userImportRowSchema.virtual('isValid').get(function() {
  return this.validationErrors.length === 0;
});

// Virtual for has warnings
userImportRowSchema.virtual('hasWarnings').get(function() {
  return this.importResult && this.importResult.warnings && this.importResult.warnings.length > 0;
});

// Method to add validation error
userImportRowSchema.methods.addValidationError = function(field, code, message, value = null) {
  this.validationErrors.push({
    field,
    code,
    message,
    value
  });
  
  this.status = 'invalid';
  return this;
};

// Method to clear validation errors
userImportRowSchema.methods.clearValidationErrors = function() {
  this.validationErrors = [];
  if (this.status === 'invalid') {
    this.status = 'pending';
  }
  return this;
};

// Method to mark as valid
userImportRowSchema.methods.markValid = function() {
  if (this.validationErrors.length === 0) {
    this.status = 'valid';
  }
  return this;
};

// Method to mark as skipped
userImportRowSchema.methods.markSkipped = function(reason, details = null) {
  this.status = 'skipped';
  this.skipReason = reason;
  this.processedAt = new Date();
  
  if (details) {
    this.errorDetails = {
      code: reason,
      message: details,
      context: { skippedAt: new Date() }
    };
  }
  
  return this.save();
};

// Method to mark as imported
userImportRowSchema.methods.markImported = function(userId, warnings = []) {
  this.status = 'imported';
  this.processedAt = new Date();
  this.importResult = {
    userId,
    createdAt: new Date(),
    warnings
  };
  
  return this.save();
};

// Method to mark as failed
userImportRowSchema.methods.markFailed = function(error, canRetry = true) {
  this.status = 'failed';
  this.processedAt = new Date();
  
  this.errorDetails = {
    code: error.code || 'UNKNOWN_ERROR',
    message: error.message || 'Unknown error occurred',
    stack: error.stack,
    context: {
      failedAt: new Date(),
      canRetry,
      retryCount: this.retryCount
    }
  };
  
  return this.save();
};

// Method to retry processing
userImportRowSchema.methods.retry = function() {
  if (this.retryCount >= 3) {
    throw new Error('Maximum retry attempts exceeded');
  }
  
  this.retryCount += 1;
  this.lastRetryAt = new Date();
  this.status = 'pending';
  this.processedAt = undefined;
  this.errorDetails = undefined;
  
  return this.save();
};

// Method to generate dedup key
userImportRowSchema.methods.generateDedupKey = function() {
  if (this.normalized.email) {
    this.dedupKey = `email:${this.normalized.email}`;
  } else if (this.normalized.phone) {
    this.dedupKey = `phone:${this.normalized.phone}`;
  } else if (this.normalized.referralCode) {
    this.dedupKey = `referral:${this.normalized.referralCode}`;
  } else {
    this.dedupKey = `row:${this.jobId}:${this.rowIndex}`;
  }
  
  return this.dedupKey;
};

// Static method to find duplicates within job
userImportRowSchema.statics.findDuplicatesInJob = function(jobId, field = 'email') {
  const dedupPattern = new RegExp(`^${field}:`);
  
  return this.aggregate([
    {
      $match: {
        jobId,
        dedupKey: { $regex: dedupPattern },
        status: { $ne: 'invalid' }
      }
    },
    {
      $group: {
        _id: '$dedupKey',
        count: { $sum: 1 },
        rows: { $push: '$$ROOT' }
      }
    },
    {
      $match: {
        count: { $gt: 1 }
      }
    }
  ]);
};

// Static method to get processing statistics
userImportRowSchema.statics.getJobStatistics = function(jobId) {
  return this.aggregate([
    {
      $match: { jobId }
    },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        avgProcessingTime: { $avg: '$processingTime' }
      }
    }
  ]);
};

// Static method to find rows ready for processing
userImportRowSchema.statics.findReadyForProcessing = function(jobId, limit = 100) {
  return this.find({
    jobId,
    status: 'valid'
  })
  .sort({ rowIndex: 1 })
  .limit(limit);
};

// Static method to find failed rows that can be retried
userImportRowSchema.statics.findRetryableRows = function(jobId, limit = 50) {
  return this.find({
    jobId,
    status: 'failed',
    retryCount: { $lt: 3 },
    'errorDetails.context.canRetry': true
  })
  .sort({ lastRetryAt: 1 })
  .limit(limit);
};

module.exports = mongoose.model('UserImportRow', userImportRowSchema);