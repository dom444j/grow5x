const mongoose = require('mongoose');
const crypto = require('crypto');

const passwordResetSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  email: {
    type: String,
    required: true,
    lowercase: true
  },
  token: {
    type: String,
    required: true,
    unique: true
  },
  code: {
    type: String,
    required: true,
    length: 6 // Código de 6 dígitos para Telegram
  },
  expiresAt: {
    type: Date,
    required: true,
    default: () => new Date(Date.now() + 15 * 60 * 1000), // 15 minutos
    index: { expireAfterSeconds: 0 } // MongoDB TTL para auto-eliminación
  },
  used: {
    type: Boolean,
    default: false
  },
  usedAt: {
    type: Date
  },
  attempts: {
    type: Number,
    default: 0,
    max: 3 // Máximo 3 intentos
  },
  ip: {
    type: String
  },
  userAgent: {
    type: String
  }
}, {
  timestamps: true
});

// Índices
passwordResetSchema.index({ email: 1 });
passwordResetSchema.index({ token: 1 });
passwordResetSchema.index({ code: 1 });
passwordResetSchema.index({ expiresAt: 1 });
passwordResetSchema.index({ used: 1 });

// Método estático para generar token y código
passwordResetSchema.statics.generateTokenAndCode = function() {
  const token = crypto.randomBytes(32).toString('hex');
  const code = Math.floor(100000 + Math.random() * 900000).toString(); // 6 dígitos
  return { token, code };
};

// Método para verificar si el token ha expirado
passwordResetSchema.methods.isExpired = function() {
  return Date.now() > this.expiresAt.getTime();
};

// Método para verificar si se pueden hacer más intentos
passwordResetSchema.methods.canAttempt = function() {
  return this.attempts < 3 && !this.used && !this.isExpired();
};

// Método para incrementar intentos
passwordResetSchema.methods.incrementAttempts = function() {
  this.attempts += 1;
  return this.save();
};

// Método para marcar como usado
passwordResetSchema.methods.markAsUsed = function() {
  this.used = true;
  this.usedAt = new Date();
  return this.save();
};

// Método estático para limpiar tokens expirados (por si acaso)
passwordResetSchema.statics.cleanExpired = function() {
  return this.deleteMany({
    $or: [
      { expiresAt: { $lt: new Date() } },
      { used: true, usedAt: { $lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } } // Eliminar usados después de 24h
    ]
  });
};

module.exports = mongoose.model('PasswordReset', passwordResetSchema);