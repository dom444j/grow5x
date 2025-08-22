const mongoose = require('mongoose');
const { generateId } = require('../utils/idGenerator');

const licenseSchema = new mongoose.Schema({
  licenseId: {
    type: String,
    unique: true,
    default: () => generateId('LIC')
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  purchaseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Purchase',
    required: true,
    index: true
  },
  packageId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Package',
    required: true
  },
  status: {
    type: String,
    enum: ['ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED'],
    default: 'ACTIVE',
    index: true
  },
  // Configuración de beneficios
  dailyBenefitRate: {
    type: Number,
    required: true // 0.125 = 12.5%
  },
  benefitDays: {
    type: Number,
    required: true // 8 días
  },
  totalCycles: {
    type: Number,
    required: true // 5 ciclos
  },
  currentCycle: {
    type: Number,
    default: 1
  },
  currentDay: {
    type: Number,
    default: 0
  },
  // Montos
  principalAmount: {
    type: Number,
    required: true
  },
  totalBenefitsEarned: {
    type: Number,
    default: 0
  },
  totalBenefitsWithdrawn: {
    type: Number,
    default: 0
  },
  availableBalance: {
    type: Number,
    default: 0
  },
  // Fechas importantes
  startDate: {
    type: Date,
    default: Date.now
  },
  nextBenefitDate: {
    type: Date,
    required: true
  },
  completionDate: {
    type: Date
  },
  pausedAt: {
    type: Date
  },
  pausedReason: {
    type: String
  },
  // Metadata
  currency: {
    type: String,
    default: 'USDT'
  },
  network: {
    type: String,
    default: 'BEP20'
  },
  // Cashback (primera semana)
  cashbackRate: {
    type: Number,
    required: true // 0.125 = 12.5%
  },
  cashbackDays: {
    type: Number,
    required: true // 8 días
  },
  cashbackCompleted: {
    type: Boolean,
    default: false
  },
  // Auditoría
  adminNotes: {
    type: String
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Índices compuestos
licenseSchema.index({ userId: 1, status: 1 });
licenseSchema.index({ status: 1, nextBenefitDate: 1 });
licenseSchema.index({ purchaseId: 1 }, { unique: true });

// Virtuals
licenseSchema.virtual('progressPercentage').get(function() {
  const totalDays = this.totalCycles * this.benefitDays;
  const completedDays = (this.currentCycle - 1) * this.benefitDays + this.currentDay;
  return Math.min((completedDays / totalDays) * 100, 100);
});

licenseSchema.virtual('isCompleted').get(function() {
  return this.currentCycle > this.totalCycles;
});

licenseSchema.virtual('daysRemaining').get(function() {
  const totalDays = this.totalCycles * this.benefitDays;
  const completedDays = (this.currentCycle - 1) * this.benefitDays + this.currentDay;
  return Math.max(totalDays - completedDays, 0);
});

// Métodos de instancia
licenseSchema.methods.calculateDailyBenefit = function() {
  // Durante cashback: 100% del principal / cashbackDays
  if (!this.cashbackCompleted && this.currentDay <= this.cashbackDays) {
    return (this.principalAmount * this.cashbackRate) / this.cashbackDays;
  }
  // Post-cashback: dailyBenefitRate del principal
  return this.principalAmount * this.dailyBenefitRate;
};

licenseSchema.methods.advanceDay = function() {
  this.currentDay += 1;
  
  // Si completamos los días del ciclo actual
  if (this.currentDay >= this.benefitDays) {
    this.currentCycle += 1;
    this.currentDay = 0;
    
    // Si completamos todos los ciclos
    if (this.currentCycle > this.totalCycles) {
      this.status = 'COMPLETED';
      this.completionDate = new Date();
      this.nextBenefitDate = null;
    } else {
      // Siguiente beneficio mañana
      this.nextBenefitDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
    }
  } else {
    // Siguiente beneficio mañana
    this.nextBenefitDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
  }
  
  // Marcar cashback como completado si corresponde
  if (!this.cashbackCompleted && this.currentDay >= this.cashbackDays) {
    this.cashbackCompleted = true;
  }
};

licenseSchema.methods.pause = function(reason) {
  this.status = 'PAUSED';
  this.pausedAt = new Date();
  this.pausedReason = reason;
  this.nextBenefitDate = null;
};

licenseSchema.methods.resume = function() {
  this.status = 'ACTIVE';
  this.pausedAt = null;
  this.pausedReason = null;
  // Reanudar beneficios mañana
  this.nextBenefitDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
};

// Middleware pre-save
licenseSchema.pre('save', function(next) {
  // Calcular nextBenefitDate si es nueva licencia
  if (this.isNew && !this.nextBenefitDate) {
    this.nextBenefitDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
  }
  next();
});

module.exports = mongoose.model('License', licenseSchema);