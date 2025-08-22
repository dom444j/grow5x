/**
 * Validation utilities for cryptocurrency transactions and security
 * Usa validadores compartidos para consistencia entre frontend y backend
 */

// Importar validadores compartidos
import sharedValidators from './sharedValidators.js';

// Re-exportar validadores compartidos
export const validateBEP20Address = sharedValidators.validateBEP20Address;
export const validateTxHash = sharedValidators.validateTxHash;
export const validateUSDTAmount = sharedValidators.validateUSDTAmount;
export const validateNetwork = sharedValidators.validateNetwork;
export const validateCurrency = sharedValidators.validateCurrency;
export const ALLOWED_CONFIG = sharedValidators.ALLOWED_CONFIG;

// Mantener compatibilidad con código existente
export const validateUSDTAmountLegacy = (amount: string | number, min: number = 0.01, max: number = 1000000): { isValid: boolean; error?: string } => {
  return validateUSDTAmount(amount, min, max);
};

// Validaciones adicionales específicas del frontend
export const validateDecimalPlaces = (amount: string | number, maxDecimals: number = 6): boolean => {
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(numAmount)) return false;
  
  const decimalPlaces = (numAmount.toString().split('.')[1] || '').length;
  return decimalPlaces <= maxDecimals;
};

// PIN validation (6 digits)
export const validateTelegramPIN = (pin: string): { isValid: boolean; error?: string } => {
  if (!pin || typeof pin !== 'string') {
    return { isValid: false, error: 'El PIN es requerido' };
  }
  
  const cleanPin = pin.trim();
  
  if (cleanPin.length !== 6) {
    return { isValid: false, error: 'El PIN debe tener exactamente 6 dígitos' };
  }
  
  if (!/^\d{6}$/.test(cleanPin)) {
    return { isValid: false, error: 'El PIN debe contener solo números' };
  }
  
  // Check for obvious patterns (like 123456, 000000, etc.)
  const obviousPatterns = [
    '123456', '654321', '000000', '111111', '222222', '333333',
    '444444', '555555', '666666', '777777', '888888', '999999'
  ];
  
  if (obviousPatterns.includes(cleanPin)) {
    return { isValid: false, error: 'El PIN no puede ser una secuencia obvia' };
  }
  
  return { isValid: true };
};

// Email validation
export const validateEmail = (email: string): { isValid: boolean; error?: string } => {
  if (!email || typeof email !== 'string') {
    return { isValid: false, error: 'El email es requerido' };
  }
  
  const cleanEmail = email.trim().toLowerCase();
  
  // RFC 5322 compliant email regex (simplified)
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  
  if (!emailRegex.test(cleanEmail)) {
    return { isValid: false, error: 'Formato de email inválido' };
  }
  
  if (cleanEmail.length > 254) {
    return { isValid: false, error: 'Email demasiado largo' };
  }
  
  return { isValid: true };
};

// Password strength validation
export const validatePassword = (password: string): { isValid: boolean; error?: string; strength?: 'weak' | 'medium' | 'strong' } => {
  if (!password || typeof password !== 'string') {
    return { isValid: false, error: 'La contraseña es requerida' };
  }
  
  if (password.length < 8) {
    return { isValid: false, error: 'La contraseña debe tener al menos 8 caracteres' };
  }
  
  if (password.length > 128) {
    return { isValid: false, error: 'La contraseña es demasiado larga' };
  }
  
  // Check for at least one lowercase letter
  if (!/[a-z]/.test(password)) {
    return { isValid: false, error: 'La contraseña debe contener al menos una letra minúscula' };
  }
  
  // Check for at least one uppercase letter
  if (!/[A-Z]/.test(password)) {
    return { isValid: false, error: 'La contraseña debe contener al menos una letra mayúscula' };
  }
  
  // Check for at least one number
  if (!/\d/.test(password)) {
    return { isValid: false, error: 'La contraseña debe contener al menos un número' };
  }
  
  // Calculate strength
  let strength: 'weak' | 'medium' | 'strong' = 'weak';
  let score = 0;
  
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++; // Special characters
  
  if (score >= 4) strength = 'strong';
  else if (score >= 3) strength = 'medium';
  
  return { isValid: true, strength };
};

// Referral code validation
export const validateReferralCode = (code: string): { isValid: boolean; error?: string } => {
  if (!code || typeof code !== 'string') {
    return { isValid: false, error: 'El código de referido es requerido' };
  }
  
  const cleanCode = code.trim().toUpperCase();
  
  // Referral codes should be alphanumeric, 6-12 characters
  if (!/^[A-Z0-9]{6,12}$/.test(cleanCode)) {
    return { isValid: false, error: 'Código de referido inválido (6-12 caracteres alfanuméricos)' };
  }
  
  return { isValid: true };
};

// Purchase ID validation
export const validatePurchaseId = (purchaseId: string): { isValid: boolean; error?: string } => {
  if (!purchaseId || typeof purchaseId !== 'string') {
    return { isValid: false, error: 'ID de compra requerido' };
  }
  
  const cleanId = purchaseId.trim();
  
  // Purchase IDs follow pattern: PUR_YYYYMMDD_XXX
  if (!/^PUR_\d{8}_\d{3}$/.test(cleanId)) {
    return { isValid: false, error: 'Formato de ID de compra inválido' };
  }
  
  return { isValid: true };
};

// Network validation is now handled by shared validators

// Comprehensive form validation
export const validatePaymentForm = (data: {
  packageId?: string;
  amount?: string | number;
  txHash?: string;
  purchaseId?: string;
}): { isValid: boolean; errors: Record<string, string> } => {
  const errors: Record<string, string> = {};
  
  if (data.amount !== undefined) {
    const amountValidation = validateUSDTAmount(data.amount, 1);
    if (!amountValidation.isValid) {
      errors.amount = amountValidation.error!;
    }
  }
  
  if (data.txHash) {
    if (!validateTxHash(data.txHash)) {
      errors.txHash = 'Hash de transacción inválido';
    }
  }
  
  if (data.purchaseId) {
    const purchaseValidation = validatePurchaseId(data.purchaseId);
    if (!purchaseValidation.isValid) {
      errors.purchaseId = purchaseValidation.error!;
    }
  }
  
  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};

// Comprehensive withdrawal form validation
export const validateWithdrawalForm = (data: {
  amount: string | number;
  walletAddress: string;
  pin: string;
  network?: string;
  availableBalance?: number;
}): { isValid: boolean; errors: Record<string, string> } => {
  const errors: Record<string, string> = {};
  
  // Amount validation
  const amountValidation = validateUSDTAmount(data.amount, 50);
  if (!amountValidation.isValid) {
    errors.amount = amountValidation.error!;
  } else if (data.availableBalance !== undefined) {
    const numAmount = typeof data.amount === 'string' ? parseFloat(data.amount) : data.amount;
    if (numAmount > data.availableBalance) {
      errors.amount = 'Saldo insuficiente';
    }
  }
  
  // Wallet address validation
  if (!validateBEP20Address(data.walletAddress)) {
    errors.walletAddress = 'Dirección de wallet BEP20 inválida';
  }
  
  // PIN validation
  const pinValidation = validateTelegramPIN(data.pin);
  if (!pinValidation.isValid) {
    errors.pin = pinValidation.error!;
  }
  
  // Network validation
  if (data.network) {
    const networkValidation = validateNetwork(data.network);
    if (!networkValidation.isValid) {
      errors.network = networkValidation.error!;
    }
  }
  
  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};

// Sanitize input to prevent XSS
export const sanitizeInput = (input: string): string => {
  if (!input || typeof input !== 'string') return '';
  
  return input
    .trim()
    .replace(/[<>"'&]/g, (char) => {
      const entities: Record<string, string> = {
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#x27;',
        '&': '&amp;'
      };
      return entities[char] || char;
    });
};

// Rate limiting helper for client-side
export const createRateLimiter = (maxRequests: number, windowMs: number) => {
  const requests: number[] = [];
  
  return (key: string, maxAttempts: number, windowDuration: number) => {
    const now = Date.now();
    
    // Get rate limit data from localStorage
    const rateLimitData = JSON.parse(localStorage.getItem('rateLimits') || '{}');
    const keyData = rateLimitData[key] || { attempts: [], resetTime: null };
    
    // Remove old attempts outside the window
    keyData.attempts = keyData.attempts.filter((timestamp: number) => timestamp > now - windowDuration);
    
    // Calculate remaining attempts
    const remaining = Math.max(0, maxAttempts - keyData.attempts.length);
    
    // Check if we're at the limit
    const allowed = keyData.attempts.length < maxAttempts;
    
    // Calculate reset time
    const resetTime = keyData.attempts.length > 0 
      ? keyData.attempts[0] + windowDuration 
      : null;
    
    // If allowed, add current attempt
    if (allowed) {
      keyData.attempts.push(now);
    }
    
    // Update localStorage
    rateLimitData[key] = keyData;
    localStorage.setItem('rateLimits', JSON.stringify(rateLimitData));
    
    return {
      allowed,
      remaining,
      resetTime
    };
  };
};

// Client rate limiter instance
export const clientRateLimit = createRateLimiter(10, 60000); // 10 requests per minute

// Export all validation functions
export default {
  validateBEP20Address,
  validateTxHash,
  validateUSDTAmount,
  validateTelegramPIN,
  validateEmail,
  validatePassword,
  validateReferralCode,
  validatePurchaseId,
  validateNetwork,
  validatePaymentForm,
  validateWithdrawalForm,
  sanitizeInput,
  createRateLimiter,
  clientRateLimit
};