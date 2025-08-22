/**
 * USDT/BEP20 Validators
 * Validadores centralizados para asegurar configuraciones exclusivas de USDT/BEP20
 */

// Importar validadores compartidos
const sharedValidators = require('../../../shared/validators');

// Configuración permitida (hardcoded para seguridad)
const ALLOWED_CONFIG = sharedValidators.ALLOWED_CONFIG;

// Usar validadores compartidos
const validateUSDTBEP20Address = sharedValidators.validateBEP20Address;
const validateUSDTBEP20Network = sharedValidators.validateNetwork;
const validateUSDTBEP20Currency = sharedValidators.validateCurrency;

/**
 * Valida una configuración completa de wallet
 * @param {Object} walletConfig - Configuración de wallet
 * @returns {Object} - { isValid: boolean, errors: string[] }
 */
function validateWalletConfig(walletConfig) {
  const errors = [];
  
  if (!walletConfig) {
    return { isValid: false, errors: ['Configuración de wallet requerida'] };
  }
  
  // Validar dirección
  if (!validateUSDTBEP20Address(walletConfig.address)) {
    errors.push('Dirección BEP20 inválida');
  }
  
  // Validar red
  if (!validateUSDTBEP20Network(walletConfig.network)) {
    errors.push(`Red debe ser ${ALLOWED_CONFIG.network}`);
  }
  
  // Validar moneda
  if (!validateUSDTBEP20Currency(walletConfig.currency)) {
    errors.push(`Moneda debe ser ${ALLOWED_CONFIG.currency}`);
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Valida una transacción/retiro
 * @param {Object} transaction - Datos de transacción
 * @returns {Object} - { isValid: boolean, errors: string[] }
 */
function validateTransaction(transaction) {
  const errors = [];
  
  if (!transaction) {
    return { isValid: false, errors: ['Datos de transacción requeridos'] };
  }
  
  // Validar dirección de destino
  if (!validateUSDTBEP20Address(transaction.toAddress || transaction.destinationAddress)) {
    errors.push('Dirección de destino BEP20 inválida');
  }
  
  // Validar red
  if (!validateUSDTBEP20Network(transaction.network)) {
    errors.push(`Red debe ser ${ALLOWED_CONFIG.network}`);
  }
  
  // Validar moneda
  if (!validateUSDTBEP20Currency(transaction.currency)) {
    errors.push(`Moneda debe ser ${ALLOWED_CONFIG.currency}`);
  }
  
  // Validar cantidad
  if (!transaction.amount || transaction.amount <= 0) {
    errors.push('Cantidad debe ser mayor a 0');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Genera un filtro de consulta para MongoDB que solo incluye USDT/BEP20
 * @returns {Object} - Filtro de MongoDB
 */
function getUSDTBEP20Filter() {
  return {
    network: ALLOWED_CONFIG.network,
    currency: ALLOWED_CONFIG.currency
  };
}

/**
 * Middleware para validar que los datos de entrada sean USDT/BEP20
 * @param {string} field - Campo a validar ('wallet', 'transaction', etc.)
 * @returns {Function} - Middleware de Express
 */
function createValidationMiddleware(field = 'wallet') {
  return (req, res, next) => {
    const data = req.body;
    
    let validation;
    switch (field) {
      case 'wallet':
        validation = validateWalletConfig(data);
        break;
      case 'transaction':
        validation = validateTransaction(data);
        break;
      default:
        return res.status(400).json({
          success: false,
          message: 'Tipo de validación no soportado'
        });
    }
    
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        message: 'Datos no válidos para USDT/BEP20',
        errors: validation.errors
      });
    }
    
    next();
  };
}

module.exports = {
  ALLOWED_CONFIG,
  validateUSDTBEP20Address,
  validateUSDTBEP20Network,
  validateUSDTBEP20Currency,
  validateWalletConfig,
  validateTransaction,
  getUSDTBEP20Filter,
  createValidationMiddleware
};