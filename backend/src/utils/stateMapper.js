/**
 * State Mapper Utility
 * Maps internal database states to frontend-friendly states
 * According to GUIA2.MD requirements
 */

const logger = require('./logger');

/**
 * Maps Purchase states from internal to frontend format
 * Internal: PENDING_PAYMENT, CONFIRMING, CONFIRMED, ACTIVE, REJECTED, EXPIRED
 * Frontend: pending, hash_submitted, confirmed, rejected (lowercase as expected by FE)
 */
const mapPurchaseState = (internalState) => {
  const stateMap = {
    'PENDING_PAYMENT': 'pending',
    'CONFIRMING': 'hash_submitted', 
    'CONFIRMED': 'confirmed',
    'ACTIVE': 'confirmed', // Active purchases are confirmed
    'REJECTED': 'rejected',
    'EXPIRED': 'rejected'
  };
  
  return stateMap[internalState] || internalState;
};

/**
 * Maps Withdrawal states from internal to frontend format
 * Internal: pending, approved, completed, rejected, processing
 * Frontend: PENDING, CONFIRMED, ACTIVE, CANCELLED
 */
const mapWithdrawalState = (internalState) => {
  const stateMap = {
    'pending': 'PENDING',
    'approved': 'CONFIRMED', 
    'processing': 'ACTIVE',
    'completed': 'ACTIVE',
    'rejected': 'CANCELLED'
  };
  
  return stateMap[internalState] || internalState;
};

/**
 * Maps Commission states from internal to frontend format
 * Internal: pending, available, withdrawn
 * Frontend: PENDING, CONFIRMED, ACTIVE
 */
const mapCommissionState = (internalState) => {
  const stateMap = {
    'pending': 'PENDING',
    'available': 'CONFIRMED',
    'withdrawn': 'ACTIVE'
  };
  
  return stateMap[internalState] || internalState;
};

/**
 * Maps License states from internal to frontend format
 * Internal: active, paused, completed, cancelled
 * Frontend: ACTIVE, PENDING, CONFIRMED, CANCELLED
 */
const mapLicenseState = (internalState) => {
  const stateMap = {
    'active': 'ACTIVE',
    'paused': 'PENDING',
    'completed': 'CONFIRMED',
    'cancelled': 'CANCELLED'
  };
  
  return stateMap[internalState] || internalState;
};

/**
 * Maps BenefitLedger states from internal to frontend format
 * Internal: scheduled, available, withdrawn, failed
 * Frontend: PENDING, CONFIRMED, ACTIVE, CANCELLED
 */
const mapBenefitState = (internalState) => {
  const stateMap = {
    'scheduled': 'PENDING',
    'available': 'CONFIRMED',
    'withdrawn': 'ACTIVE',
    'failed': 'CANCELLED'
  };
  
  return stateMap[internalState] || internalState;
};

/**
 * Transforms a purchase object with mapped states
 * @param {Object} purchase - Purchase object from database
 * @returns {Object} - Purchase object with mapped state
 */
const transformPurchase = (purchase) => {
  if (!purchase) return purchase;
  
  const transformed = {
    ...purchase.toObject ? purchase.toObject() : purchase,
    status: mapPurchaseState(purchase.status)
  };
  
  return transformed;
};

/**
 * Transforms a withdrawal object with mapped states
 * @param {Object} withdrawal - Withdrawal object from database
 * @returns {Object} - Withdrawal object with mapped state
 */
const transformWithdrawal = (withdrawal) => {
  if (!withdrawal) return withdrawal;
  
  const transformed = {
    ...withdrawal.toObject ? withdrawal.toObject() : withdrawal,
    status: mapWithdrawalState(withdrawal.status)
  };
  
  return transformed;
};

/**
 * Transforms a commission object with mapped states
 * @param {Object} commission - Commission object from database
 * @returns {Object} - Commission object with mapped state
 */
const transformCommission = (commission) => {
  if (!commission) return commission;
  
  const transformed = {
    ...commission.toObject ? commission.toObject() : commission,
    status: mapCommissionState(commission.status)
  };
  
  return transformed;
};

/**
 * Transforms a license object with mapped states
 * @param {Object} license - License object from database
 * @returns {Object} - License object with mapped state
 */
const transformLicense = (license) => {
  if (!license) return license;
  
  const transformed = {
    ...license.toObject ? license.toObject() : license,
    status: mapLicenseState(license.status)
  };
  
  return transformed;
};

/**
 * Transforms a benefit object with mapped states
 * @param {Object} benefit - Benefit object from database
 * @returns {Object} - Benefit object with mapped state
 */
const transformBenefit = (benefit) => {
  if (!benefit) return benefit;
  
  const transformed = {
    ...benefit.toObject ? benefit.toObject() : benefit,
    status: mapBenefitState(benefit.status)
  };
  
  return transformed;
};

/**
 * Transforms an array of objects with mapped states
 * @param {Array} items - Array of objects to transform
 * @param {Function} transformer - Transformation function to apply
 * @returns {Array} - Array of transformed objects
 */
const transformArray = (items, transformer) => {
  if (!Array.isArray(items)) return items;
  return items.map(transformer);
};

/**
 * Express middleware to transform response data states
 * @param {String} type - Type of transformation (purchase, withdrawal, commission, license, benefit)
 * @returns {Function} - Express middleware function
 */
const stateMapperMiddleware = (type) => {
  return (req, res, next) => {
    const originalJson = res.json;
    
    res.json = function(data) {
      try {
        let transformedData = data;
        
        if (data && typeof data === 'object') {
          // Handle different response structures
          if (data.data) {
            // Response with data wrapper
            if (Array.isArray(data.data)) {
              transformedData = {
                ...data,
                data: transformArray(data.data, getTransformer(type))
              };
            } else {
              transformedData = {
                ...data,
                data: getTransformer(type)(data.data)
              };
            }
          } else if (Array.isArray(data)) {
            // Direct array response
            transformedData = transformArray(data, getTransformer(type));
          } else {
            // Direct object response
            transformedData = getTransformer(type)(data);
          }
        }
        
        return originalJson.call(this, transformedData);
      } catch (error) {
        logger.error('State mapping error:', {
          error: error.message,
          type,
          url: req.originalUrl
        });
        return originalJson.call(this, data);
      }
    };
    
    next();
  };
};

/**
 * Gets the appropriate transformer function for a given type
 * @param {String} type - Type of transformation
 * @returns {Function} - Transformer function
 */
const getTransformer = (type) => {
  const transformers = {
    purchase: transformPurchase,
    withdrawal: transformWithdrawal,
    commission: transformCommission,
    license: transformLicense,
    benefit: transformBenefit
  };
  
  return transformers[type] || ((item) => item);
};

module.exports = {
  mapPurchaseState,
  mapWithdrawalState,
  mapCommissionState,
  mapLicenseState,
  mapBenefitState,
  transformPurchase,
  transformWithdrawal,
  transformCommission,
  transformLicense,
  transformBenefit,
  transformArray,
  stateMapperMiddleware,
  getTransformer
};