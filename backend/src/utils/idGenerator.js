const crypto = require('crypto');

/**
 * Generate a unique ID with a prefix
 * @param {string} prefix - The prefix for the ID (e.g., 'LIC', 'USR', 'PKG')
 * @param {number} length - The length of the random part (default: 8)
 * @returns {string} - The generated ID
 */
function generateId(prefix = '', length = 8) {
  const randomPart = crypto.randomBytes(Math.ceil(length / 2))
    .toString('hex')
    .slice(0, length)
    .toUpperCase();
  
  return prefix ? `${prefix}_${randomPart}` : randomPart;
}

/**
 * Generate a numeric ID
 * @param {number} length - The length of the numeric ID (default: 10)
 * @returns {string} - The generated numeric ID
 */
function generateNumericId(length = 10) {
  let result = '';
  for (let i = 0; i < length; i++) {
    result += Math.floor(Math.random() * 10);
  }
  return result;
}

/**
 * Generate a UUID v4
 * @returns {string} - The generated UUID
 */
function generateUUID() {
  return crypto.randomUUID();
}

module.exports = {
  generateId,
  generateNumericId,
  generateUUID
};