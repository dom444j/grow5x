/**
 * Utility functions for handling MongoDB Decimal128 values
 * Converts Decimal128 objects to JavaScript numbers for API responses
 */

/**
 * Converts a MongoDB Decimal128 value to a JavaScript number
 * @param {*} value - The value that might be a Decimal128
 * @returns {number} The numeric value as a JavaScript number
 */
function parseDecimal(value) {
  // If it's already a number, return it
  if (typeof value === 'number') {
    return value;
  }
  
  // If it's null or undefined, return 0
  if (value == null) {
    return 0;
  }
  
  // If it's a string, parse it
  if (typeof value === 'string') {
    // Handle PowerShell object representation like "@{$numberDecimal=900}"
    if (value.includes('$numberDecimal=')) {
      const match = value.match(/\$numberDecimal=([^}]+)/);
      if (match) {
        return parseFloat(match[1]);
      }
    }
    return parseFloat(value);
  }
  
  // If it's a MongoDB Decimal128 object
  if (value && typeof value === 'object') {
    // Handle direct Decimal128 objects
    if (value.constructor && value.constructor.name === 'Decimal128') {
      return parseFloat(value.toString());
    }
    
    // Handle objects with $numberDecimal property
    if (value.$numberDecimal !== undefined) {
      return parseFloat(value.$numberDecimal);
    }
    
    // Handle nested objects that might contain decimal values
    if (value.toString && typeof value.toString === 'function') {
      const str = value.toString();
      if (str.includes('$numberDecimal')) {
        const match = str.match(/\$numberDecimal=([^}]+)/);
        if (match) {
          return parseFloat(match[1]);
        }
      }
    }
  }
  
  // Try to convert to number as fallback
  const parsed = Number(value);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Recursively processes an object to convert all Decimal128 values to numbers
 * @param {*} obj - The object to process
 * @returns {*} The processed object with converted decimal values
 */
function processDecimalFields(obj) {
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(processDecimalFields);
  }
  
  if (typeof obj === 'object') {
    // Check if it's a Decimal128 object
    if (obj.constructor && obj.constructor.name === 'Decimal128') {
      return parseDecimal(obj);
    }
    
    // Check if it's a Date object (preserve dates)
    if (obj instanceof Date) {
      return obj;
    }
    
    // Process all properties recursively
    const processed = {};
    for (const [key, value] of Object.entries(obj)) {
      processed[key] = processDecimalFields(value);
    }
    return processed;
  }
  
  return obj;
}

/**
 * Converts a single decimal field for API response
 * @param {*} value - The decimal value to convert
 * @returns {number} The converted number
 */
function toApiNumber(value) {
  return parseDecimal(value);
}

/**
 * Safe decimal calculation utilities with 8-decimal precision
 */
class DecimalCalc {
  /**
   * Round to 8 decimal places
   * @param {number|string} value 
   * @returns {number}
   */
  static round(value) {
    return parseFloat(parseFloat(value.toString()).toFixed(8));
  }

  /**
   * Safe addition with 8 decimal precision
   * @param {number|string} a 
   * @param {number|string} b 
   * @returns {number}
   */
  static add(a, b) {
    const result = parseFloat(a.toString()) + parseFloat(b.toString());
    return this.round(result);
  }

  /**
   * Safe subtraction with 8 decimal precision
   * @param {number|string} a 
   * @param {number|string} b 
   * @returns {number}
   */
  static subtract(a, b) {
    const result = parseFloat(a.toString()) - parseFloat(b.toString());
    return this.round(result);
  }

  /**
   * Safe multiplication with 8 decimal precision
   * @param {number|string} a 
   * @param {number|string} b 
   * @returns {number}
   */
  static multiply(a, b) {
    const result = parseFloat(a.toString()) * parseFloat(b.toString());
    return this.round(result);
  }

  /**
   * Safe division with 8 decimal precision
   * @param {number|string} a 
   * @param {number|string} b 
   * @returns {number}
   */
  static divide(a, b) {
    const divisor = parseFloat(b.toString());
    if (divisor === 0) {
      throw new Error('Division by zero');
    }
    const result = parseFloat(a.toString()) / divisor;
    return this.round(result);
  }

  /**
   * Calculate percentage with 8 decimal precision
   * @param {number|string} amount 
   * @param {number|string} percentage 
   * @returns {number}
   */
  static percentage(amount, percentage) {
    return this.multiply(amount, this.divide(percentage, 100));
  }

  /**
   * Calculate daily benefit amount (purchase amount * daily rate)
   * @param {number|string} purchaseAmount 
   * @param {number|string} dailyRate 
   * @returns {number}
   */
  static calculateDailyBenefit(purchaseAmount, dailyRate) {
    return this.multiply(purchaseAmount, dailyRate);
  }

  /**
   * Calculate commission amount (base amount * commission rate)
   * @param {number|string} baseAmount 
   * @param {number|string} commissionRate 
   * @returns {number}
   */
  static calculateCommission(baseAmount, commissionRate) {
    return this.multiply(baseAmount, commissionRate);
  }

  /**
   * Calculate total amount (quantity * unit price)
   * @param {number|string} quantity 
   * @param {number|string} unitPrice 
   * @returns {number}
   */
  static calculateTotal(quantity, unitPrice) {
    return this.multiply(quantity, unitPrice);
  }

  /**
   * Sum an array of values with 8 decimal precision
   * @param {Array<number|string>} values 
   * @returns {number}
   */
  static sum(values) {
    return values.reduce((sum, value) => this.add(sum, value), 0);
  }

  /**
   * Get the maximum of two values
   * @param {number|string} a 
   * @param {number|string} b 
   * @returns {number}
   */
  static max(a, b) {
    const numA = parseFloat(a.toString());
    const numB = parseFloat(b.toString());
    return this.round(Math.max(numA, numB));
  }

  /**
   * Get the minimum of two values
   * @param {number|string} a 
   * @param {number|string} b 
   * @returns {number}
   */
  static min(a, b) {
    const numA = parseFloat(a.toString());
    const numB = parseFloat(b.toString());
    return this.round(Math.min(numA, numB));
  }
}

module.exports = {
  parseDecimal,
  processDecimalFields,
  toApiNumber,
  DecimalCalc
};