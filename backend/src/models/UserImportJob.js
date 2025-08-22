const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const userImportJobSchema = new mongoose.Schema({
  // Job Identification
  jobId: {
    type: String,
    unique: true,
    default: () => `IMPORT_${uuidv4().replace(/-/g, '').substring(0, 12).toUpperCase()}`
  },
  
  // Cohort Information
  cohort: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  
  // Job Status
  status: {
    type: String,
    enum: ['queued', 'running', 'completed', 'failed', 'partial'],
    default: 'queued',
    index: true
  },
  
  // Execution Mode
  executionMode: {
    type: String,
    enum: ['dry-run', 'commit'],
    default: 'dry-run'
  },
  
  isDryRun: {
    type: Boolean,
    default: true
  },
  
  // Source Information
  source: {
    type: String,
    required: true,
    // GridFS file ID or data URL
    trim: true
  },
  
  sourceType: {
    type: String,
    enum: ['gridfs', 'url', 'inline'],
    default: 'gridfs'
  },
  
  // File Information
  originalFilename: {
    type: String,
    trim: true
  },
  
  fileSize: {
    type: Number,
    min: 0
  },
  
  mimeType: {
    type: String,
    trim: true
  },
  
  // Processing Metrics
  totalRows: {
    type: Number,
    default: 0,
    min: 0
  },
  
  validRows: {
    type: Number,
    default: 0,
    min: 0
  },
  
  invalidRows: {
    type: Number,
    default: 0,
    min: 0
  },
  
  importedRows: {
    type: Number,
    default: 0,
    min: 0
  },
  
  skippedRows: {
    type: Number,
    default: 0,
    min: 0
  },
  
  // Timing Information
  startedAt: {
    type: Date,
    index: true
  },
  
  finishedAt: {
    type: Date
  },
  
  // Processing Configuration
  chunkSize: {
    type: Number,
    default: 1000,
    min: 100,
    max: 10000
  },
  
  // Error Information
  errors: [{
    phase: {
      type: String,
      enum: ['upload', 'parse', 'validate', 'import']
    },
    message: String,
    details: mongoose.Schema.Types.Mixed,
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Job Lock (for distributed processing)
  lockedBy: {
    type: String,
    sparse: true
  },
  
  lockedAt: {
    type: Date,
    sparse: true
  },
  
  lockExpires: {
    type: Date,
    sparse: true
  },
  
  // Processing Options
  options: {
    requireReferralCode: {
      type: Boolean,
      default: false
    },
    
    allowDuplicateEmails: {
      type: Boolean,
      default: false
    },
    
    defaultRole: {
      type: String,
      default: 'user'
    },
    
    sendWelcomeEmail: {
      type: Boolean,
      default: false
    },
    
    autoActivate: {
      type: Boolean,
      default: true
    }
  },
  
  // Admin Information
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Progress Tracking
  progress: {
    currentRow: {
      type: Number,
      default: 0
    },
    
    percentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    
    estimatedTimeRemaining: {
      type: Number, // milliseconds
      default: null
    },
    
    rowsPerSecond: {
      type: Number,
      default: 0
    }
  },
  
  // Metadata
  metadata: {
    userAgent: String,
    ipAddress: String,
    notes: String
  }
}, {
  timestamps: true
});

// Indexes
userImportJobSchema.index({ jobId: 1 });
userImportJobSchema.index({ status: 1, startedAt: -1 });
userImportJobSchema.index({ cohort: 1, createdAt: -1 });
userImportJobSchema.index({ createdBy: 1, createdAt: -1 });
userImportJobSchema.index({ lockedBy: 1, lockExpires: 1 }, { sparse: true });

// Virtual for duration
userImportJobSchema.virtual('duration').get(function() {
  if (this.finishedAt && this.startedAt) {
    return this.finishedAt - this.startedAt;
  }
  return null;
});

// Virtual for is locked
userImportJobSchema.virtual('isLocked').get(function() {
  return this.lockedBy && this.lockExpires && this.lockExpires > new Date();
});

// Virtual for success rate
userImportJobSchema.virtual('successRate').get(function() {
  if (this.totalRows === 0) return 0;
  return (this.importedRows / this.totalRows) * 100;
});

// Method to acquire lock
userImportJobSchema.methods.acquireLock = function(workerId, lockDurationMs = 300000) { // 5 minutes default
  const now = new Date();
  const lockExpires = new Date(now.getTime() + lockDurationMs);
  
  this.lockedBy = workerId;
  this.lockedAt = now;
  this.lockExpires = lockExpires;
  
  return this.save();
};

// Method to release lock
userImportJobSchema.methods.releaseLock = function() {
  this.lockedBy = undefined;
  this.lockedAt = undefined;
  this.lockExpires = undefined;
  
  return this.save();
};

// Method to update progress
userImportJobSchema.methods.updateProgress = function(currentRow, rowsPerSecond = null) {
  this.progress.currentRow = currentRow;
  this.progress.percentage = this.totalRows > 0 ? (currentRow / this.totalRows) * 100 : 0;
  
  if (rowsPerSecond) {
    this.progress.rowsPerSecond = rowsPerSecond;
    const remainingRows = this.totalRows - currentRow;
    this.progress.estimatedTimeRemaining = remainingRows > 0 ? (remainingRows / rowsPerSecond) * 1000 : 0;
  }
  
  return this.save();
};

// Method to add error
userImportJobSchema.methods.addError = function(phase, message, details = null) {
  this.errors.push({
    phase,
    message,
    details,
    timestamp: new Date()
  });
  
  return this.save();
};

// Method to mark as completed
userImportJobSchema.methods.markCompleted = function(finalMetrics = {}) {
  this.status = this.invalidRows > 0 ? 'partial' : 'completed';
  this.finishedAt = new Date();
  this.progress.percentage = 100;
  
  // Update final metrics if provided
  if (finalMetrics.validRows !== undefined) this.validRows = finalMetrics.validRows;
  if (finalMetrics.invalidRows !== undefined) this.invalidRows = finalMetrics.invalidRows;
  if (finalMetrics.importedRows !== undefined) this.importedRows = finalMetrics.importedRows;
  if (finalMetrics.skippedRows !== undefined) this.skippedRows = finalMetrics.skippedRows;
  
  return this.releaseLock();
};

// Method to mark as failed
userImportJobSchema.methods.markFailed = function(errorMessage, errorDetails = null) {
  this.status = 'failed';
  this.finishedAt = new Date();
  this.addError('import', errorMessage, errorDetails);
  
  return this.releaseLock();
};

// Static method to find available jobs
userImportJobSchema.statics.findAvailableJobs = function(limit = 10) {
  const now = new Date();
  
  return this.find({
    status: 'queued',
    $or: [
      { lockedBy: { $exists: false } },
      { lockExpires: { $lt: now } }
    ]
  })
  .sort({ createdAt: 1 })
  .limit(limit);
};

// Static method to get job statistics
userImportJobSchema.statics.getJobStatistics = function(timeRange = 24) { // hours
  const since = new Date(Date.now() - (timeRange * 60 * 60 * 1000));
  
  return this.aggregate([
    {
      $match: {
        createdAt: { $gte: since }
      }
    },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalRows: { $sum: '$totalRows' },
        totalImported: { $sum: '$importedRows' },
        avgDuration: { $avg: { $subtract: ['$finishedAt', '$startedAt'] } }
      }
    }
  ]);
};

module.exports = mongoose.model('UserImportJob', userImportJobSchema);