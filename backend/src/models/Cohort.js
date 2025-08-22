const mongoose = require('mongoose');

const cohortSchema = new mongoose.Schema({
  // Identificación
  batchId: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    maxlength: 100,
    match: /^[a-zA-Z0-9_-]+$/
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  description: {
    type: String,
    trim: true,
    maxlength: 500
  },
  
  // Feature Flags
  featureFlags: {
    FEATURE_COHORT_PACKAGES: {
      type: Boolean,
      default: true
    },
    FEATURE_COHORT_WITHDRAWALS: {
      type: Boolean,
      default: true
    }
  },
  
  // Configuración de referidos
  referralConfig: {
    directLevel1Percentage: {
      type: Number,
      default: 10,
      min: 0,
      max: 100
    },
    specialParentCodePercentage: {
      type: Number,
      default: 10,
      min: 0,
      max: 100
    },
    specialParentCodeDelayDays: {
      type: Number,
      default: 17,
      min: 0
    }
  },
  
  // Estado
  isActive: {
    type: Boolean,
    default: true
  },
  
  // Metadatos
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      return ret;
    }
  }
});

// Índices
cohortSchema.index({ batchId: 1 });
cohortSchema.index({ isActive: 1 });
cohortSchema.index({ createdAt: -1 });

// Métodos estáticos
cohortSchema.statics.findByBatchId = function(batchId) {
  return this.findOne({ batchId, isActive: true });
};

cohortSchema.statics.getActiveCohorts = function() {
  return this.find({ isActive: true }).sort({ createdAt: -1 });
};

// Métodos de instancia
cohortSchema.methods.hasFeature = function(featureName) {
  return this.featureFlags[featureName] === true;
};

cohortSchema.methods.updateFeatureFlag = function(featureName, value) {
  if (this.featureFlags.hasOwnProperty(featureName)) {
    this.featureFlags[featureName] = value;
    return this.save();
  }
  throw new Error(`Feature flag ${featureName} does not exist`);
};

// Middleware pre-save
cohortSchema.pre('save', function(next) {
  if (this.isModified('batchId')) {
    this.batchId = this.batchId.toLowerCase();
  }
  next();
});

module.exports = mongoose.model('Cohort', cohortSchema);