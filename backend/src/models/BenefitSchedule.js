const mongoose = require('mongoose');
const { DecimalCalc } = require('../utils/decimal');

const benefitScheduleSchema = new mongoose.Schema({
  // Reference to the purchase that generated this benefit schedule
  purchaseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Purchase',
    required: true,
    unique: true, // One schedule per purchase
    index: true
  },
  
  // User who owns this benefit schedule
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  // Type of schedule: BENEFIT (daily), REFERRER (day 8), PARENT (day 17)
  type: {
    type: String,
    enum: ['BENEFIT', 'REFERRER', 'PARENT'],
    default: 'BENEFIT',
    required: true
  },
  
  // When the benefit schedule starts (usually purchase confirmation date)
  startAt: {
    type: Date,
    required: true,
    index: true
  },
  
  // Total number of benefit days (fixed at 8)
  days: {
    type: Number,
    required: true,
    default: 8,
    min: 1,
    max: 30 // Safety limit
  },
  
  // Specific day index for commission types (8 for REFERRER, 17 for PARENT)
  dayIndex: {
    type: Number,
    required: function() {
      return this.type === 'REFERRER' || this.type === 'PARENT';
    }
  },
  
  // Daily benefit rate (12.5% = 0.125)
  dailyRate: {
    type: Number,
    required: true,
    default: 0.125, // 12.5%
    min: 0,
    max: 1 // 100% max
  },
  
  // Original purchase amount in USDT
  purchaseAmount: {
    type: Number,
    required: true,
    min: 0
  },
  
  // Daily benefit amount (purchaseAmount * dailyRate)
  dailyBenefitAmount: {
    type: Number,
    required: true,
    min: 0
  },
  
  // Status for each day (0-7 for 8 days)
  statusByDay: {
    type: Map,
    of: {
      status: {
        type: String,
        enum: ['pending', 'released', 'failed'],
        default: 'pending'
      },
      scheduledDate: {
        type: Date,
        required: true
      },
      releasedAt: {
        type: Date
      },
      ledgerEntryId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Ledger'
      },
      errorMessage: {
        type: String
      }
    },
    default: new Map()
  },
  
  // Overall schedule status
  scheduleStatus: {
    type: String,
    enum: ['active', 'completed', 'cancelled'],
    default: 'active',
    index: true
  },
  
  // Total benefits released so far
  totalReleased: {
    type: Number,
    default: 0,
    min: 0
  },
  
  // Number of days successfully released
  daysReleased: {
    type: Number,
    default: 0,
    min: 0,
    max: 8
  },
  
  // Metadata for tracking
  metadata: {
    createdBy: {
      type: String,
      default: 'system'
    },
    notes: String,
    version: {
      type: Number,
      default: 1
    }
  }
}, {
  timestamps: true,
  collection: 'benefitSchedules'
});

// Indexes for performance
benefitScheduleSchema.index({ purchaseId: 1 });
benefitScheduleSchema.index({ userId: 1 });
benefitScheduleSchema.index({ scheduleStatus: 1 });
benefitScheduleSchema.index({ startAt: 1 });
benefitScheduleSchema.index({ userId: 1, scheduleStatus: 1 });
benefitScheduleSchema.index({ purchaseId: 1, scheduleStatus: 1 });
benefitScheduleSchema.index({ type: 1 });
benefitScheduleSchema.index({ type: 1, scheduleStatus: 1 });
// Unique index to prevent duplicate commission schedules
benefitScheduleSchema.index(
  { purchaseId: 1, type: 1, dayIndex: 1 },
  { 
    unique: true,
    partialFilterExpression: { type: { $in: ['REFERRER', 'PARENT'] } }
  }
);
benefitScheduleSchema.index({ startAt: 1, scheduleStatus: 1 });
benefitScheduleSchema.index({ 'statusByDay.scheduledDate': 1 });
benefitScheduleSchema.index({ createdAt: 1 });

// Virtual for total expected benefits
benefitScheduleSchema.virtual('totalExpectedBenefits').get(function() {
  return this.dailyBenefitAmount * this.days;
});

// Virtual for remaining benefits
benefitScheduleSchema.virtual('remainingBenefits').get(function() {
  return this.totalExpectedBenefits - this.totalReleased;
});

// Virtual for completion percentage
benefitScheduleSchema.virtual('completionPercentage').get(function() {
  return this.days > 0 ? (this.daysReleased / this.days) * 100 : 0;
});

// Method to initialize daily schedule
benefitScheduleSchema.methods.initializeDailySchedule = function() {
  const statusByDay = new Map();
  
  for (let day = 0; day < this.days; day++) {
    const scheduledDate = new Date(this.startAt);
    scheduledDate.setDate(scheduledDate.getDate() + day + 1); // Start from day 1
    
    statusByDay.set(day.toString(), {
      status: 'pending',
      scheduledDate: scheduledDate
    });
  }
  
  this.statusByDay = statusByDay;
  return this;
};

// Method to get pending benefits for a specific date
benefitScheduleSchema.methods.getPendingBenefitsForDate = function(targetDate) {
  const pendingDays = [];
  
  for (let [dayKey, dayData] of this.statusByDay) {
    if (dayData.status === 'pending') {
      const scheduledDate = new Date(dayData.scheduledDate);
      scheduledDate.setHours(0, 0, 0, 0);
      
      const target = new Date(targetDate);
      target.setHours(0, 0, 0, 0);
      
      if (scheduledDate <= target) {
        pendingDays.push({
          day: parseInt(dayKey),
          scheduledDate: dayData.scheduledDate,
          amount: this.dailyBenefitAmount
        });
      }
    }
  }
  
  return pendingDays;
};

// Method to mark day as released
benefitScheduleSchema.methods.markDayAsReleased = function(day, ledgerEntryId) {
  const dayKey = day.toString();
  const dayData = this.statusByDay.get(dayKey);
  
  if (dayData && dayData.status === 'pending') {
    dayData.status = 'released';
    dayData.releasedAt = new Date();
    dayData.ledgerEntryId = ledgerEntryId;
    
    this.statusByDay.set(dayKey, dayData);
    this.totalReleased += this.dailyBenefitAmount;
    this.daysReleased += 1;
    
    // Check if schedule is completed
    if (this.daysReleased >= this.days) {
      this.scheduleStatus = 'completed';
    }
    
    this.markModified('statusByDay');
  }
  
  return this;
};

// Method to mark day as failed
benefitScheduleSchema.methods.markDayAsFailed = function(day, errorMessage) {
  const dayKey = day.toString();
  const dayData = this.statusByDay.get(dayKey);
  
  if (dayData && dayData.status === 'pending') {
    dayData.status = 'failed';
    dayData.errorMessage = errorMessage;
    
    this.statusByDay.set(dayKey, dayData);
    this.markModified('statusByDay');
  }
  
  return this;
};

// Static method to create schedule from purchase
benefitScheduleSchema.statics.createFromPurchase = async function(purchase) {
  // Convert Decimal128 to number for calculations
  const purchaseAmount = parseFloat(purchase.totalAmount.toString());
  const dailyBenefitAmount = DecimalCalc.calculateDailyBenefit(purchaseAmount, 0.125); // 12.5%
  
  const schedule = new this({
    purchaseId: purchase._id,
    userId: purchase.userId,
    type: 'BENEFIT',
    startAt: purchase.paymentConfirmedAt || purchase.activatedAt || new Date(),
    days: 8,
    dailyRate: 0.125,
    purchaseAmount: purchaseAmount,
    dailyBenefitAmount: dailyBenefitAmount,
    scheduleStatus: 'active'
  });
  
  schedule.initializeDailySchedule();
  
  return await schedule.save();
};

// Static method to create commission schedules from a purchase
benefitScheduleSchema.statics.createCommissionSchedules = async function(purchase, referrerUserId, parentUserId) {
  const { getCommissions } = require('../config/commissions');
  const commissions = await getCommissions();
  const schedules = [];
  const purchaseAmount = parseFloat(purchase.totalAmount.toString());
  
  // Create REFERRER commission schedule
  if (referrerUserId) {
    const referrerAmount = DecimalCalc.calculateCommission(purchaseAmount, commissions.DIRECT_PERCENT);
    schedules.push(new this({
      purchaseId: purchase._id,
      userId: referrerUserId,
      type: 'REFERRER',
      startAt: purchase.paymentConfirmedAt || purchase.activatedAt || new Date(),
      days: 1, // Single day
      dayIndex: commissions.DIRECT_UNLOCK_DAYS - 1, // D+9 = dayIndex 8 (0-based)
      dailyRate: commissions.DIRECT_PERCENT,
      purchaseAmount: purchaseAmount,
      dailyBenefitAmount: referrerAmount,
      scheduleStatus: 'active'
    }));
  }
  
  // Create PARENT commission schedule
  if (parentUserId) {
    const parentAmount = DecimalCalc.calculateCommission(purchaseAmount, commissions.PARENT_PERCENT);
    schedules.push(new this({
      purchaseId: purchase._id,
      userId: parentUserId,
      type: 'PARENT',
      startAt: purchase.paymentConfirmedAt || purchase.activatedAt || new Date(),
      days: 1, // Single day
      dayIndex: commissions.PARENT_UNLOCK_DAYS - 1, // D+17 = dayIndex 16 (0-based)
      dailyRate: commissions.PARENT_PERCENT,
      purchaseAmount: purchaseAmount,
      dailyBenefitAmount: parentAmount,
      scheduleStatus: 'active'
    }));
  }
  
  return schedules;
};

// Static method to find schedules ready for processing
benefitScheduleSchema.statics.findReadyForProcessing = function(targetDate = new Date(), type = 'BENEFIT') {
  const startOfDay = new Date(targetDate);
  startOfDay.setHours(0, 0, 0, 0);
  
  const endOfDay = new Date(targetDate);
  endOfDay.setHours(23, 59, 59, 999);
  
  const query = {
    scheduleStatus: 'active',
    type: type
  };
  
  if (type === 'BENEFIT') {
    // For daily benefits, check if within the 8-day period
    query.startAt = { $lte: endOfDay };
  } else if (type === 'REFERRER' || type === 'PARENT') {
    // For commissions, check if it's exactly the right day
    const daysDiff = Math.floor((targetDate - new Date(startOfDay)) / (1000 * 60 * 60 * 24));
    query.$expr = {
      $eq: [
        { $add: [
          { $dateTrunc: { date: '$startAt', unit: 'day' } },
          { $multiply: [{ $subtract: ['$dayIndex', 1] }, 24 * 60 * 60 * 1000] }
        ]},
        { $dateTrunc: { date: targetDate, unit: 'day' } }
      ]
    };
  }
  
  return this.find(query)
    .populate('userId', 'firstName lastName email')
    .populate({
      path: 'purchaseId',
      select: 'totalAmount packageId status purchaseId',
      match: { status: 'ACTIVE' } // Only include ACTIVE purchases
    })
    .then(schedules => {
      // Filter out schedules where purchaseId is null (due to non-ACTIVE status)
      return schedules.filter(schedule => schedule.purchaseId !== null);
    });
};

// Pre-save middleware to calculate derived fields
benefitScheduleSchema.pre('save', function(next) {
  if (this.isNew || this.isModified('purchaseAmount') || this.isModified('dailyRate')) {
    this.dailyBenefitAmount = DecimalCalc.multiply(this.purchaseAmount, this.dailyRate);
  }
  
  next();
});

// Export the model
module.exports = mongoose.model('BenefitSchedule', benefitScheduleSchema);