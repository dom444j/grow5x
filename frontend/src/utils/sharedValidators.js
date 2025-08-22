/**
 * Shared Validators for Frontend
 * Importa y re-exporta los validadores compartidos para uso en el frontend
 */

// Importar validadores compartidos
import * as sharedValidators from '../../../shared/validators.js';

// Re-exportar para uso en el frontend
export const {
  ALLOWED_CONFIG,
  validateBEP20Address,
  validateNetwork,
  validateCurrency,
  validateTxHash,
  validateUSDTAmount,
  validateUserData,
  validatePurchaseData,
  validateWithdrawalData
} = sharedValidators;

// Funciones adicionales específicas del frontend
export const validateEmail = (email) => {
  if (!email || typeof email !== 'string') return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
};

export const validatePassword = (password) => {
  if (!password || typeof password !== 'string') return false;
  return password.length >= 8;
};

export const validateUsername = (username) => {
  if (!username || typeof username !== 'string') return false;
  return username.trim().length >= 3;
};

// Validación de formularios específicos del frontend
export const validateLoginForm = (formData) => {
  const errors = [];
  
  if (!validateEmail(formData.email)) {
    errors.push('Email inválido');
  }
  
  if (!validatePassword(formData.password)) {
    errors.push('Password debe tener al menos 8 caracteres');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

export const validateRegisterForm = (formData) => {
  const errors = [];
  
  if (!validateUsername(formData.username)) {
    errors.push('Username debe tener al menos 3 caracteres');
  }
  
  if (!validateEmail(formData.email)) {
    errors.push('Email inválido');
  }
  
  if (!validatePassword(formData.password)) {
    errors.push('Password debe tener al menos 8 caracteres');
  }
  
  if (formData.password !== formData.confirmPassword) {
    errors.push('Las contraseñas no coinciden');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

export const validateWithdrawalForm = (formData) => {
  const errors = [];
  
  const amountValidation = validateUSDTAmount(formData.amount, 10);
  if (!amountValidation.isValid) {
    errors.push(amountValidation.error);
  }
  
  if (!validateBEP20Address(formData.walletAddress)) {
    errors.push('Dirección de wallet inválida');
  }
  
  if (!validateNetwork(formData.network)) {
    errors.push('Red no permitida');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

export const validatePurchaseForm = (formData) => {
  const errors = [];
  
  if (!formData.packageId) {
    errors.push('Debe seleccionar un paquete');
  }
  
  const amountValidation = validateUSDTAmount(formData.amount);
  if (!amountValidation.isValid) {
    errors.push(amountValidation.error);
  }
  
  if (!validateTxHash(formData.txHash)) {
    errors.push('Hash de transacción inválido');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

// Exportar por defecto
export default {
  ALLOWED_CONFIG,
  validateBEP20Address,
  validateNetwork,
  validateCurrency,
  validateTxHash,
  validateUSDTAmount,
  validateUserData,
  validatePurchaseData,
  validateWithdrawalData,
  validateEmail,
  validatePassword,
  validateUsername,
  validateLoginForm,
  validateRegisterForm,
  validateWithdrawalForm,
  validatePurchaseForm
};