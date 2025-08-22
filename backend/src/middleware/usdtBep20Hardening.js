/**
 * USDT/BEP20 Hardening Middleware
 * Enforces USDT/BEP20 only configuration across critical routes
 * Part of the security hardening implementation
 */

const { validateUSDTBEP20Address, validateUSDTBEP20Network, ALLOWED_CONFIG } = require('../validators/usdtBep20Validators');
const logger = require('../config/logger');

/**
 * Middleware to validate wallet addresses in request body
 * Ensures only USDT/BEP20 addresses are accepted
 */
const validateWalletAddress = (req, res, next) => {
  try {
    const { address, network, currency } = req.body;
    
    // Skip validation if no wallet data in request
    if (!address && !network && !currency) {
      return next();
    }
    
    // Validate address format if provided
    if (address && !validateUSDTBEP20Address(address)) {
      logger.warn('Invalid wallet address format detected', {
        address,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        route: req.route?.path
      });
      
      return res.status(400).json({
        success: false,
        error: 'Dirección de wallet inválida. Solo se permiten direcciones BEP20.',
        code: 'INVALID_WALLET_ADDRESS'
      });
    }
    
    // Validate network if provided
    if (network && !validateUSDTBEP20Network(network)) {
      logger.warn('Invalid network detected', {
        network,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        route: req.route?.path
      });
      
      return res.status(400).json({
        success: false,
        error: 'Red no permitida. Solo se permite BEP20.',
        code: 'INVALID_NETWORK'
      });
    }
    
    // Validate currency if provided
    if (currency && currency !== ALLOWED_CONFIG.currency) {
      logger.warn('Invalid currency detected', {
        currency,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        route: req.route?.path
      });
      
      return res.status(400).json({
        success: false,
        error: 'Moneda no permitida. Solo se permite USDT.',
        code: 'INVALID_CURRENCY'
      });
    }
    
    next();
  } catch (error) {
    logger.error('Error in wallet address validation middleware', {
      error: error.message,
      stack: error.stack,
      route: req.route?.path
    });
    
    return res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      code: 'VALIDATION_ERROR'
    });
  }
};

/**
 * Middleware to validate withdrawal requests
 * Ensures withdrawals are only processed for USDT/BEP20
 */
const validateWithdrawalRequest = (req, res, next) => {
  try {
    const { walletAddress, network, currency } = req.body;
    
    // Validate withdrawal address
    if (walletAddress && !validateUSDTBEP20Address(walletAddress)) {
      logger.warn('Invalid withdrawal address detected', {
        walletAddress,
        userId: req.user?.userId,
        ip: req.ip,
        route: req.route?.path
      });
      
      return res.status(400).json({
        success: false,
        error: 'Dirección de retiro inválida. Solo se permiten direcciones BEP20.',
        code: 'INVALID_WITHDRAWAL_ADDRESS'
      });
    }
    
    // Validate network
    if (network && !validateUSDTBEP20Network(network)) {
      logger.warn('Invalid withdrawal network detected', {
        network,
        userId: req.user?.userId,
        ip: req.ip,
        route: req.route?.path
      });
      
      return res.status(400).json({
        success: false,
        error: 'Red de retiro no permitida. Solo se permite BEP20.',
        code: 'INVALID_WITHDRAWAL_NETWORK'
      });
    }
    
    // Validate currency
    if (currency && currency !== ALLOWED_CONFIG.currency) {
      logger.warn('Invalid withdrawal currency detected', {
        currency,
        userId: req.user?.userId,
        ip: req.ip,
        route: req.route?.path
      });
      
      return res.status(400).json({
        success: false,
        error: 'Moneda de retiro no permitida. Solo se permite USDT.',
        code: 'INVALID_WITHDRAWAL_CURRENCY'
      });
    }
    
    next();
  } catch (error) {
    logger.error('Error in withdrawal validation middleware', {
      error: error.message,
      stack: error.stack,
      userId: req.user?.userId,
      route: req.route?.path
    });
    
    return res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      code: 'WITHDRAWAL_VALIDATION_ERROR'
    });
  }
};

/**
 * Middleware to validate checkout/payment requests
 * Ensures payments are only processed for USDT/BEP20
 */
const validatePaymentRequest = (req, res, next) => {
  try {
    const { payTo, network, currency, walletAddress } = req.body;
    const addressToValidate = payTo || walletAddress;
    
    // Validate payment address
    if (addressToValidate && !validateUSDTBEP20Address(addressToValidate)) {
      logger.warn('Invalid payment address detected', {
        address: addressToValidate,
        userId: req.user?.userId,
        ip: req.ip,
        route: req.route?.path
      });
      
      return res.status(400).json({
        success: false,
        error: 'Dirección de pago inválida. Solo se permiten direcciones BEP20.',
        code: 'INVALID_PAYMENT_ADDRESS'
      });
    }
    
    // Validate network
    if (network && !validateUSDTBEP20Network(network)) {
      logger.warn('Invalid payment network detected', {
        network,
        userId: req.user?.userId,
        ip: req.ip,
        route: req.route?.path
      });
      
      return res.status(400).json({
        success: false,
        error: 'Red de pago no permitida. Solo se permite BEP20.',
        code: 'INVALID_PAYMENT_NETWORK'
      });
    }
    
    // Validate currency
    if (currency && currency !== ALLOWED_CONFIG.currency) {
      logger.warn('Invalid payment currency detected', {
        currency,
        userId: req.user?.userId,
        ip: req.ip,
        route: req.route?.path
      });
      
      return res.status(400).json({
        success: false,
        error: 'Moneda de pago no permitida. Solo se permite USDT.',
        code: 'INVALID_PAYMENT_CURRENCY'
      });
    }
    
    next();
  } catch (error) {
    logger.error('Error in payment validation middleware', {
      error: error.message,
      stack: error.stack,
      userId: req.user?.userId,
      route: req.route?.path
    });
    
    return res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      code: 'PAYMENT_VALIDATION_ERROR'
    });
  }
};

/**
 * Middleware to validate database queries for wallets
 * Ensures only USDT/BEP20 wallets are retrieved from database
 */
const enforceUSDTBEP20Query = (req, res, next) => {
  try {
    // Add USDT/BEP20 filter to query parameters
    req.usdtBep20Filter = {
      network: ALLOWED_CONFIG.network,
      currency: ALLOWED_CONFIG.currency
    };
    
    logger.debug('USDT/BEP20 query filter applied', {
      filter: req.usdtBep20Filter,
      route: req.route?.path
    });
    
    next();
  } catch (error) {
    logger.error('Error in USDT/BEP20 query enforcement middleware', {
      error: error.message,
      stack: error.stack,
      route: req.route?.path
    });
    
    return res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      code: 'QUERY_ENFORCEMENT_ERROR'
    });
  }
};

/**
 * Comprehensive validation middleware that combines all validations
 * Use this for routes that handle multiple wallet operations
 */
const comprehensiveValidation = (req, res, next) => {
  validateWalletAddress(req, res, (err) => {
    if (err) return next(err);
    
    validateWithdrawalRequest(req, res, (err) => {
      if (err) return next(err);
      
      validatePaymentRequest(req, res, (err) => {
        if (err) return next(err);
        
        enforceUSDTBEP20Query(req, res, next);
      });
    });
  });
};

module.exports = {
  validateWalletAddress,
  validateWithdrawalRequest,
  validatePaymentRequest,
  enforceUSDTBEP20Query,
  comprehensiveValidation
};