/**
 * Outbox Event Model
 * Implements the Transactional Outbox Pattern for reliable event publishing
 * Ensures events are published atomically with database transactions
 */

const mongoose = require('mongoose');

const outboxEventSchema = new mongoose.Schema({
  // Event Identification
  eventId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  
  // Event Type and Aggregate
  eventType: {
    type: String,
    required: true,
    enum: [
      'PURCHASE_CONFIRMED',
      'PURCHASE_REJECTED', 
      'WITHDRAWAL_REQUESTED',
      'WITHDRAWAL_APPROVED',
      'WITHDRAWAL_COMPLETED',
      'WITHDRAWAL_REJECTED',
      'BENEFIT_PROCESSED',
      'COMMISSION_UNLOCKED',
      'LICENSE_PAUSED',
      'LICENSE_RESUMED',
      'LICENSE_COMPLETED',
      'USER_BALANCE_UPDATED',
      'ADMIN_ACTION_PERFORMED'
    ],
    index: true
  },
  
  aggregateId: {
    type: String,
    required: true,
    index: true
  },
  
  aggregateType: {
    type: String,
    required: true,
    enum: ['Purchase', 'Withdrawal', 'User', 'License', 'Commission', 'BenefitLedger']
  },
  
  // Event Data
  eventData: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  
  // Event Metadata
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },
  
  adminId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // Processing Status
  status: {
    type: String,
    enum: ['PENDING', 'PROCESSING', 'PUBLISHED', 'FAILED'],
    default: 'PENDING',
    index: true
  },
  
  // Retry Logic
  attempts: {
    type: Number,
    default: 0
  },
  
  maxAttempts: {
    type: Number,
    default: 5
  },
  
  nextRetryAt: {
    type: Date,
    index: true
  },
  
  // Error Tracking
  lastError: {
    type: String
  },
  
  errorHistory: [{
    error: String,
    occurredAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Timestamps
  publishedAt: {
    type: Date
  },
  
  // Transaction Context
  transactionId: {
    type: String,
    index: true
  },
  
  // Event Version for schema evolution
  version: {
    type: Number,
    default: 1
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
outboxEventSchema.index({ status: 1, nextRetryAt: 1 });
outboxEventSchema.index({ eventType: 1, createdAt: -1 });
outboxEventSchema.index({ aggregateId: 1, aggregateType: 1 });
outboxEventSchema.index({ userId: 1, createdAt: -1 });
outboxEventSchema.index({ transactionId: 1 });
outboxEventSchema.index({ createdAt: 1 }); // TTL index candidate

// Instance Methods
outboxEventSchema.methods.markAsProcessing = function() {
  this.status = 'PROCESSING';
  this.attempts += 1;
  return this.save();
};

outboxEventSchema.methods.markAsPublished = function() {
  this.status = 'PUBLISHED';
  this.publishedAt = new Date();
  return this.save();
};

outboxEventSchema.methods.markAsFailed = function(error) {
  this.status = 'FAILED';
  this.lastError = error;
  this.errorHistory.push({
    error: error,
    occurredAt: new Date()
  });
  
  // Calculate next retry with exponential backoff
  if (this.attempts < this.maxAttempts) {
    const backoffMs = Math.min(1000 * Math.pow(2, this.attempts), 300000); // Max 5 minutes
    this.nextRetryAt = new Date(Date.now() + backoffMs);
    this.status = 'PENDING';
  }
  
  return this.save();
};

// Static Methods
outboxEventSchema.statics.createEvent = function(eventType, aggregateId, aggregateType, eventData, context = {}) {
  const eventId = `${eventType}_${aggregateId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  return new this({
    eventId,
    eventType,
    aggregateId,
    aggregateType,
    eventData,
    userId: context.userId,
    adminId: context.adminId,
    transactionId: context.transactionId,
    version: context.version || 1
  });
};

outboxEventSchema.statics.getPendingEvents = function(limit = 100) {
  return this.find({
    status: 'PENDING',
    $or: [
      { nextRetryAt: { $exists: false } },
      { nextRetryAt: { $lte: new Date() } }
    ]
  })
  .sort({ createdAt: 1 })
  .limit(limit);
};

outboxEventSchema.statics.getFailedEvents = function(limit = 50) {
  return this.find({
    status: 'FAILED',
    attempts: { $gte: this.schema.paths.maxAttempts.default }
  })
  .sort({ createdAt: 1 })
  .limit(limit);
};

// Clean up old published events (older than 7 days)
outboxEventSchema.statics.cleanupOldEvents = function() {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  return this.deleteMany({
    status: 'PUBLISHED',
    publishedAt: { $lt: sevenDaysAgo }
  });
};

module.exports = mongoose.model('OutboxEvent', outboxEventSchema);