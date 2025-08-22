/**
 * Simple Telegram utility for sending alerts
 */

const sendTelegramAlert = async (message, options = {}) => {
  // For testing purposes, just log the alert
  // In production, this would send actual Telegram messages
  console.log(`📱 TELEGRAM ALERT: ${message}`);
  if (options.data) {
    console.log('Alert data:', JSON.stringify(options.data, null, 2));
  }
  return Promise.resolve(true);
};

const sendTelegramNotification = async (chatId, message) => {
  // For testing purposes, just log the notification
  console.log(`📱 TELEGRAM NOTIFICATION to ${chatId}: ${message}`);
  return Promise.resolve(true);
};

module.exports = {
  sendTelegramAlert,
  sendTelegramNotification
};