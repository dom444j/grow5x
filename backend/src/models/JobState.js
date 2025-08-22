const mongoose = require('mongoose');

const jobStateSchema = new mongoose.Schema({
  job: {
    type: String,
    required: true,
    unique: true,
    enum: ['benefits', 'commissions']
  },
  lastRun: {
    type: Date,
    required: true
  },
  processed: {
    type: Number,
    required: true,
    default: 0
  },
  errors: {
    type: Number,
    required: true,
    default: 0
  },
  totalAmount: {
    type: Number,
    required: true,
    default: 0
  },
  durationMs: {
    type: Number,
    required: true,
    default: 0
  },
  status: {
    type: String,
    required: true,
    enum: ['success', 'error', 'running'],
    default: 'success'
  },
  errorMessage: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

// Índice único por job
jobStateSchema.index({ job: 1 }, { unique: true });

// Método estático para actualizar o crear estado de job
jobStateSchema.statics.updateJobState = async function(jobName, metrics) {
  const { processed, errors, totalAmount, durationMs, status, errorMessage } = metrics;
  
  return await this.findOneAndUpdate(
    { job: jobName },
    {
      lastRun: new Date(),
      processed: processed || 0,
      errors: errors || 0,
      totalAmount: totalAmount || 0,
      durationMs: durationMs || 0,
      status: status || 'success',
      errorMessage: errorMessage || null
    },
    { 
      upsert: true, 
      new: true,
      setDefaultsOnInsert: true
    }
  );
};

// Método estático para obtener estado de todos los jobs
jobStateSchema.statics.getAllJobStates = async function() {
  const states = await this.find({}).lean();
  const result = {};
  
  states.forEach(state => {
    result[state.job] = {
      lastRun: state.lastRun,
      processed: state.processed,
      errors: state.errors,
      totalAmount: state.totalAmount,
      durationMs: state.durationMs,
      status: state.status,
      errorMessage: state.errorMessage
    };
  });
  
  return result;
};

module.exports = mongoose.model('JobState', jobStateSchema);