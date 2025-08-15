/**
 * CRON Jobs Manager
 * Centralized management for all CRON processors
 */

const dailyBenefits = require('./daily-benefits.cron');
const unlockCommissions = require('./unlock-commissions.cron');
const logger = require('../config/logger');

/**
 * Initialize and start all CRON jobs
 */
function initializeCronJobs() {
  try {
    logger.info('Initializing CRON jobs...');
    
    // Start daily benefits processor
    dailyBenefits.startCronJob();
    
    // Start commission unlock processor
    unlockCommissions.startCronJob();
    
    logger.info('All CRON jobs initialized successfully', {
      jobs: [
        'daily-benefits (03:00 UTC)',
        'unlock-commissions (03:00 UTC)'
      ]
    });
    
  } catch (error) {
    logger.error('Error initializing CRON jobs:', {
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
}

/**
 * Stop all CRON jobs
 */
function stopAllCronJobs() {
  try {
    logger.info('Stopping all CRON jobs...');
    
    dailyBenefits.stopCronJob();
    unlockCommissions.stopCronJob();
    
    logger.info('All CRON jobs stopped successfully');
    
  } catch (error) {
    logger.error('Error stopping CRON jobs:', {
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
}

/**
 * Get status of all CRON jobs
 */
function getAllCronStatus() {
  return {
    dailyBenefits: dailyBenefits.getCronStatus(),
    unlockCommissions: unlockCommissions.getCronStatus()
  };
}

/**
 * Manual trigger for all processors (for testing/admin use)
 */
async function triggerAllProcessors() {
  logger.info('Manual trigger for all CRON processors initiated');
  
  const results = {
    dailyBenefits: null,
    unlockCommissions: null,
    errors: []
  };
  
  try {
    // Trigger daily benefits processing
    logger.info('Triggering daily benefits processing...');
    results.dailyBenefits = await dailyBenefits.triggerManualProcessing();
    
  } catch (error) {
    logger.error('Error in manual daily benefits processing:', {
      error: error.message,
      stack: error.stack
    });
    results.errors.push({
      processor: 'dailyBenefits',
      error: error.message
    });
  }
  
  try {
    // Trigger commission unlock processing
    logger.info('Triggering commission unlock processing...');
    results.unlockCommissions = await unlockCommissions.triggerManualUnlocking();
    
  } catch (error) {
    logger.error('Error in manual commission unlock processing:', {
      error: error.message,
      stack: error.stack
    });
    results.errors.push({
      processor: 'unlockCommissions',
      error: error.message
    });
  }
  
  logger.info('Manual processing completed', {
    dailyBenefitsSuccess: !!results.dailyBenefits,
    unlockCommissionsSuccess: !!results.unlockCommissions,
    errorCount: results.errors.length
  });
  
  return results;
}

/**
 * Get comprehensive processing statistics
 */
async function getAllProcessingStats() {
  try {
    const [benefitStats, unlockStats] = await Promise.all([
      dailyBenefits.getProcessingStats(),
      unlockCommissions.getUnlockStats()
    ]);
    
    return {
      dailyBenefits: benefitStats,
      unlockCommissions: unlockStats,
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    logger.error('Error getting processing stats:', {
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
}

/**
 * Health check for all CRON processors
 */
function healthCheck() {
  const status = getAllCronStatus();
  const isHealthy = Object.values(status).every(job => job.running);
  
  return {
    healthy: isHealthy,
    status,
    timestamp: new Date().toISOString()
  };
}

module.exports = {
  // Core functions
  initializeCronJobs,
  stopAllCronJobs,
  getAllCronStatus,
  healthCheck,
  
  // Manual triggers
  triggerAllProcessors,
  getAllProcessingStats,
  
  // Individual processors (for direct access)
  dailyBenefits,
  unlockCommissions
};