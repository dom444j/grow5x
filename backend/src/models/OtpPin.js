const mongoose = require('mongoose');
const { Schema } = mongoose;

const otpPinSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  pin: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['withdrawal', 'password_reset', 'account_activation'],
    required: true
  },
  used: {
    type: Boolean,
    default: false
  },
  expiresAt: {
    type: Date,
    required: true,
    index: { expireAfterSeconds: 0 }
  },
  metadata: {
    withdrawalId: {
      type: Schema.Types.ObjectId,
      ref: 'Withdrawal'
    },
    ipAddress: String,
    userAgent: String
  }
}, {
  timestamps: true
});

// Índice compuesto para búsquedas eficientes
otpPinSchema.index({ userId: 1, type: 1, used: 1 });

// Middleware para limpiar OTPs expirados
otpPinSchema.pre('save', function(next) {
  if (this.isNew && !this.expiresAt) {
    // Por defecto 10 minutos de expiración
    this.expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  }
  next();
});

// Método estático para limpiar OTPs usados o expirados
otpPinSchema.statics.cleanupExpired = async function() {
  const result = await this.deleteMany({
    $or: [
      { used: true },
      { expiresAt: { $lt: new Date() } }
    ]
  });
  return result.deletedCount;
};

// Método para verificar si el OTP es válido
otpPinSchema.methods.isValid = function() {
  return !this.used && this.expiresAt > new Date();
};

module.exports = mongoose.model('OtpPin', otpPinSchema);