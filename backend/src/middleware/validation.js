const { validationResult } = require('express-validator');
const sharedValidators = require('../../../shared/validators');

/**
 * Middleware para validar requests usando express-validator
 */
const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }
  
  next();
};

/**
 * Middleware para validar datos de compra
 */
const validatePurchase = (req, res, next) => {
  const { packageId, amount, txHash, network } = req.body;
  
  const validation = sharedValidators.validatePurchaseData({
    packageId,
    amount,
    txHash,
    network: network || 'BEP20'
  });
  
  if (!validation.isValid) {
    return res.status(400).json({
      success: false,
      message: 'Datos de compra inválidos',
      errors: validation.errors
    });
  }
  
  next();
};

/**
 * Middleware para validar datos de retiro
 */
const validateWithdrawal = (req, res, next) => {
  const { amount, walletAddress, network } = req.body;
  
  const validation = sharedValidators.validateWithdrawalData({
    amount,
    walletAddress,
    network: network || 'BEP20'
  });
  
  if (!validation.isValid) {
    return res.status(400).json({
      success: false,
      message: 'Datos de retiro inválidos',
      errors: validation.errors
    });
  }
  
  next();
};

/**
 * Middleware para validar dirección de wallet
 */
const validateWalletAddress = (req, res, next) => {
  const { address, walletAddress } = req.body;
  const addressToValidate = address || walletAddress;
  
  if (!sharedValidators.validateBEP20Address(addressToValidate)) {
    return res.status(400).json({
      success: false,
      message: 'Dirección de wallet inválida',
      errors: ['La dirección debe ser una dirección BEP20 válida']
    });
  }
  
  next();
};

/**
 * Middleware para validar monto USDT
 */
const validateAmount = (minAmount = 0.01, maxAmount = 1000000) => {
  return (req, res, next) => {
    const { amount } = req.body;
    
    const validation = sharedValidators.validateUSDTAmount(amount, minAmount, maxAmount);
    
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        message: 'Monto inválido',
        errors: [validation.error]
      });
    }
    
    next();
  };
};

module.exports = {
  validateRequest,
  validatePurchase,
  validateWithdrawal,
  validateWalletAddress,
  validateAmount
};