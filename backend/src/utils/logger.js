/**
 * Simple logger utility for the application
 */

const logInfo = (message, data = null) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] INFO: ${message}`);
  if (data) {
    console.log('Data:', JSON.stringify(data, null, 2));
  }
};

const logError = (message, error = null) => {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] ERROR: ${message}`);
  if (error) {
    console.error('Error details:', error);
  }
};

const logWarn = (message, data = null) => {
  const timestamp = new Date().toISOString();
  console.warn(`[${timestamp}] WARN: ${message}`);
  if (data) {
    console.warn('Data:', JSON.stringify(data, null, 2));
  }
};

const logDebug = (message, data = null) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] DEBUG: ${message}`);
  if (data) {
    console.log('Data:', JSON.stringify(data, null, 2));
  }
};

module.exports = {
  logInfo,
  logError,
  logWarn,
  logDebug
};