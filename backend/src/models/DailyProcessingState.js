const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * Schema for tracking daily processing state to ensure idempotency
 * This model prevents duplicate processing of benefits for the same date
 */
const dailyProcessingStateSchema = new Schema({
  // Date for which processing was done (YYYY-MM-DD format)
  processDate: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  
  // Processing status
  status: {
    type: String,
    enum: ['processing', 'completed', 'failed'],
    required: true,
    default: 'processing'
  },
  
  // When processing started
  startedAt: {
    type: Date,
    required: true,
    default: Date.now
  },
  
  // When processing completed
  completedAt: {
    type: Date
  },
  
  // Processing statistics
  stats: {
    totalPurchases: {
      type: Number,
      default: 0
    },
    processedPurchases: {
      type: Number,
      default: 0
    },
    skippedPurchases: {
      type: Number,
      default: 0
    },
    errorCount: {
      type: Number,
      default: 0
    },
    totalBenefitAmount: {
      type: Number,
      default: 0
    },
    totalCommissionAmount: {
      type: Number,
      default: 0
    },
    durationMs: {
      type: Number,
      default: 0
    }
  },
  
  // Error message if processing failed
  errorMessage: {
    type: String
  },
  
  // Additional metadata
  metadata: {
    timezone: {
      type: String,
      default: 'America/Bogota'
    },
    cronVersion: {
      type: String,
      default: 'v2'
    },
    manualTrigger: {
      type: Boolean,
      default: false
    }
  }
}, {
  timestamps: true,
  collection: 'daily_processing_states'
});

// Index for efficient querying
dailyProcessingStateSchema.index({ processDate: 1, status: 1 });
dailyProcessingStateSchema.index({ startedAt: 1 });

/**
 * Static method to check if a date has already been processed
 * @param {string} processDate - Date in YYYY-MM-DD format
 * @returns {Promise<Object|null>} Processing state or null if not found
 */
dailyProcessingStateSchema.statics.getProcessingState = async function(processDate) {
  return await this.findOne({ processDate });
};

/**
 * Static method to mark processing as started
 * @param {string} processDate - Date in YYYY-MM-DD format
 * @param {Object} metadata - Additional metadata
 * @returns {Promise<Object>} Created processing state
 */
dailyProcessingStateSchema.statics.markProcessingStarted = async function(processDate, metadata = {}) {
  const existingState = await this.findOne({ processDate });
  
  if (existingState) {
    // If already completed, don't allow restart
    if (existingState.status === 'completed') {
      throw new Error(`Processing for date ${processDate} already completed`);
    }
    
    // If currently processing and started less than 2 hours ago, don't allow restart
    if (existingState.status === 'processing') {
      const timeDiff = Date.now() - existingState.startedAt.getTime();
      const twoHoursMs = 2 * 60 * 60 * 1000;
      
      if (timeDiff < twoHoursMs) {
        throw new Error(`Processing for date ${processDate} is already in progress`);
      }
      
      // If processing for more than 2 hours, consider it stale and restart
      existingState.status = 'processing';
      existingState.startedAt = new Date();
      existingState.metadata = { ...existingState.metadata, ...metadata };
      return await existingState.save();
    }
    
    // If failed, allow restart
    if (existingState.status === 'failed') {
      existingState.status = 'processing';
      existingState.startedAt = new Date();
      existingState.completedAt = undefined;
      existingState.errorMessage = undefined;
      existingState.metadata = { ...existingState.metadata, ...metadata };
      return await existingState.save();
    }
  }
  
  // Create new processing state
  return await this.create({
    processDate,
    status: 'processing',
    startedAt: new Date(),
    metadata
  });
};

/**
 * Static method to mark processing as completed
 * @param {string} processDate - Date in YYYY-MM-DD format
 * @param {Object} stats - Processing statistics
 * @returns {Promise<Object>} Updated processing state
 */
dailyProcessingStateSchema.statics.markProcessingCompleted = async function(processDate, stats = {}) {
  const state = await this.findOne({ processDate });
  
  if (!state) {
    throw new Error(`No processing state found for date ${processDate}`);
  }
  
  state.status = 'completed';
  state.completedAt = new Date();
  state.stats = { ...state.stats, ...stats };
  state.stats.durationMs = Date.now() - state.startedAt.getTime();
  
  return await state.save();
};

/**
 * Static method to mark processing as failed
 * @param {string} processDate - Date in YYYY-MM-DD format
 * @param {string} errorMessage - Error message
 * @param {Object} stats - Partial processing statistics
 * @returns {Promise<Object>} Updated processing state
 */
dailyProcessingStateSchema.statics.markProcessingFailed = async function(processDate, errorMessage, stats = {}) {
  const state = await this.findOne({ processDate });
  
  if (!state) {
    throw new Error(`No processing state found for date ${processDate}`);
  }
  
  state.status = 'failed';
  state.completedAt = new Date();
  state.errorMessage = errorMessage;
  state.stats = { ...state.stats, ...stats };
  state.stats.durationMs = Date.now() - state.startedAt.getTime();
  
  return await state.save();
};

/**
 * Static method to get processing statistics for a date range
 * @param {string} startDate - Start date in YYYY-MM-DD format
 * @param {string} endDate - End date in YYYY-MM-DD format
 * @returns {Promise<Array>} Array of processing states
 */
dailyProcessingStateSchema.statics.getProcessingStats = async function(startDate, endDate) {
  return await this.find({
    processDate: {
      $gte: startDate,
      $lte: endDate
    }
  }).sort({ processDate: -1 });
};

/**
 * Static method to clean up old processing states (older than 90 days)
 * @returns {Promise<Object>} Cleanup result
 */
dailyProcessingStateSchema.statics.cleanupOldStates = async function() {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 90);
  
  const cutoffDateStr = cutoffDate.toISOString().split('T')[0];
  
  return await this.deleteMany({
    processDate: { $lt: cutoffDateStr }
  });
};

module.exports = mongoose.model('DailyProcessingState', dailyProcessingStateSchema);