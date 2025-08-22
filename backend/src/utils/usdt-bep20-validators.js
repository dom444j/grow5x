/**
 * USDT/BEP20 Only Validators
 * Validadores centralizados para garantizar que solo se permita USDT en BEP20
 * 
 * IMPORTANTE: Este archivo implementa el hardening de seguridad para restringir
 * el sistema únicamente a USDT en la red BEP20, bloqueando cualquier otra moneda o red.
 */

const { BadRequestError } = require('../utils/errors');

// Configuración única permitida
const ALLOWED_CONFIG = {
  currency: 'USDT',
  network: 'BEP20',
  tokenContract: '0x55d398326f99059fF775485246999027B3197955', // USDT on BEP20
  chainId: 56, // BSC Mainnet
  decimals: 18
};

/**
 * Valida que una dirección sea BEP20 válida
 * @param {string} address - Dirección a validar
 * @returns {boolean} - true si es válida
 */
const isBEP20Address = (address) => {
  if (!address || typeof address !== 'string') return false;
  return /^0x[a-fA-F0-9]{40}$/.test(address.trim());
};

/**
 * Valida que la moneda sea únicamente USDT
 * @param {string} currency - Moneda a validar
 * @throws {BadRequestError} - Si no es USDT
 */
const validateUSDTOnly = (currency) => {
  if (!currency) {
    throw new BadRequestError('CURRENCY_REQUIRED', 'La moneda es requerida');
  }
  
  const normalizedCurrency = currency.toString().toUpperCase().trim();
  if (normalizedCurrency !== ALLOWED_CONFIG.currency) {
    throw new BadRequestError(
      'ONLY_USDT_ALLOWED', 
      `Solo se permite USDT. Moneda recibida: ${currency}`
    );
  }
};

/**
 * Valida que la red sea únicamente BEP20
 * @param {string} network - Red a validar
 * @throws {BadRequestError} - Si no es BEP20
 */
const validateBEP20Only = (network) => {
  if (!network) {
    throw new BadRequestError('NETWORK_REQUIRED', 'La red es requerida');
  }
  
  const normalizedNetwork = network.toString().toUpperCase().trim();
  if (normalizedNetwork !== ALLOWED_CONFIG.network) {
    throw new BadRequestError(
      'ONLY_BEP20_ALLOWED', 
      `Solo se permite BEP20. Red recibida: ${network}`
    );
  }
};

/**
 * Valida que una dirección sea BEP20 válida
 * @param {string} address - Dirección a validar
 * @throws {BadRequestError} - Si no es válida
 */
const validateBEP20Address = (address) => {
  if (!address) {
    throw new BadRequestError('ADDRESS_REQUIRED', 'La dirección es requerida');
  }
  
  if (!isBEP20Address(address)) {
    throw new BadRequestError(
      'INVALID_BEP20_ADDRESS', 
      `Dirección BEP20 inválida: ${address}. Debe ser formato 0x seguido de 40 caracteres hexadecimales`
    );
  }
};

/**
 * Middleware para validar datos de wallet (creación/actualización)
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @param {Function} next - Next middleware
 */
const validateWalletData = (req, res, next) => {
  try {
    const { currency, network, address, toAddress } = req.body;
    
    // Validar moneda si está presente
    if (currency) {
      validateUSDTOnly(currency);
    }
    
    // Validar red si está presente
    if (network) {
      validateBEP20Only(network);
    }
    
    // Validar dirección si está presente
    if (address) {
      validateBEP20Address(address);
    }
    
    // Validar dirección de destino si está presente (para retiros)
    if (toAddress) {
      validateBEP20Address(toAddress);
    }
    
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware para validar datos de compra/pago
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @param {Function} next - Next middleware
 */
const validatePaymentData = (req, res, next) => {
  try {
    const { currency, network } = req.body;
    
    // Forzar valores permitidos si no están presentes
    if (!currency) {
      req.body.currency = ALLOWED_CONFIG.currency;
    } else {
      validateUSDTOnly(currency);
    }
    
    if (!network) {
      req.body.network = ALLOWED_CONFIG.network;
    } else {
      validateBEP20Only(network);
    }
    
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware para validar datos de retiro
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @param {Function} next - Next middleware
 */
const validateWithdrawalData = (req, res, next) => {
  try {
    const { currency, network, toAddress } = req.body;
    
    // Validaciones obligatorias para retiros
    validateUSDTOnly(currency || ALLOWED_CONFIG.currency);
    validateBEP20Only(network || ALLOWED_CONFIG.network);
    validateBEP20Address(toAddress);
    
    // Forzar valores correctos
    req.body.currency = ALLOWED_CONFIG.currency;
    req.body.network = ALLOWED_CONFIG.network;
    
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Valida configuración completa de USDT/BEP20
 * @param {Object} config - Configuración a validar
 * @throws {BadRequestError} - Si algún valor no es válido
 */
const validateCompleteConfig = (config) => {
  const { currency, network, address } = config;
  
  validateUSDTOnly(currency);
  validateBEP20Only(network);
  if (address) {
    validateBEP20Address(address);
  }
};

/**
 * Obtiene la configuración permitida
 * @returns {Object} - Configuración USDT/BEP20
 */
const getAllowedConfig = () => ({ ...ALLOWED_CONFIG });

/**
 * Verifica si una configuración es válida sin lanzar errores
 * @param {Object} config - Configuración a verificar
 * @returns {Object} - { isValid: boolean, errors: string[] }
 */
const isValidConfig = (config) => {
  const errors = [];
  
  try {
    if (config.currency) validateUSDTOnly(config.currency);
  } catch (error) {
    errors.push(error.message);
  }
  
  try {
    if (config.network) validateBEP20Only(config.network);
  } catch (error) {
    errors.push(error.message);
  }
  
  try {
    if (config.address) validateBEP20Address(config.address);
  } catch (error) {
    errors.push(error.message);
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

module.exports = {
  // Configuración
  ALLOWED_CONFIG,
  getAllowedConfig,
  
  // Validadores individuales
  isBEP20Address,
  validateUSDTOnly,
  validateBEP20Only,
  validateBEP20Address,
  validateCompleteConfig,
  isValidConfig,
  
  // Middlewares
  validateWalletData,
  validatePaymentData,
  validateWithdrawalData
};