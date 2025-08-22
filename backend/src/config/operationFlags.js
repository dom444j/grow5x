/**
 * Operation Flags Configuration
 * Manages feature flags and operational settings for production environment
 */

const logger = require('./logger');

/**
 * Default operation flags
 */
const DEFAULT_FLAGS = {
  // Core feature flags
  ENABLE_BENEFITS_RELEASE: process.env.ENABLE_BENEFITS_RELEASE === 'true',
  ENABLE_COMMISSIONS_RELEASE: process.env.ENABLE_COMMISSIONS_RELEASE === 'true',
  ENABLE_WITHDRAWALS: process.env.ENABLE_WITHDRAWALS !== 'false', // Default true
  ENABLE_NEW_REGISTRATIONS: process.env.ENABLE_NEW_REGISTRATIONS !== 'false', // Default true
  
  // API operation modes
  READ_ONLY_API: process.env.READ_ONLY_API === 'true',
  MAINTENANCE_MODE: process.env.MAINTENANCE_MODE === 'true',
  
  // Security flags
  ENABLE_RATE_LIMITING: process.env.ENABLE_RATE_LIMITING !== 'false', // Default true
  ENABLE_AUDIT_LOGGING: process.env.ENABLE_AUDIT_LOGGING !== 'false', // Default true
  STRICT_VALIDATION: process.env.STRICT_VALIDATION !== 'false', // Default true
  
  // External service flags
  ENABLE_TELEGRAM_NOTIFICATIONS: process.env.ENABLE_TELEGRAM_NOTIFICATIONS !== 'false', // Default true
  ENABLE_EMAIL_NOTIFICATIONS: process.env.ENABLE_EMAIL_NOTIFICATIONS === 'true',
  
  // Development/Debug flags
  DEBUG_MODE: process.env.DEBUG_MODE === 'true',
  VERBOSE_LOGGING: process.env.VERBOSE_LOGGING === 'true',
  
  // Cron job flags
  ENABLE_CRON_JOBS: process.env.ENABLE_CRON_JOBS !== 'false', // Default true
  ENABLE_BENEFITS_CRON: process.env.ENABLE_BENEFITS_CRON !== 'false', // Default true
  ENABLE_COMMISSIONS_CRON: process.env.ENABLE_COMMISSIONS_CRON !== 'false', // Default true
  
  // Wallet management flags
  ENABLE_WALLET_ROTATION: process.env.ENABLE_WALLET_ROTATION !== 'false', // Default true
  WALLET_COOLDOWN_ENABLED: process.env.WALLET_COOLDOWN_ENABLED !== 'false', // Default true
  
  // Admin features
  ENABLE_ADMIN_EXPORT: process.env.ENABLE_ADMIN_EXPORT !== 'false', // Default true
  ENABLE_ADMIN_IMPORT: process.env.ENABLE_ADMIN_IMPORT !== 'false', // Default true
};

/**
 * Environment validation
 */
const REQUIRED_ENV_VARS = [
  'NODE_ENV',
  'MONGODB_URI',
  'JWT_SECRET'
];

const RECOMMENDED_ENV_VARS = [
  'TZ', // Should be 'UTC'
  'FRONTEND_URL',
  'TELEGRAM_BOT_TOKEN'
];

/**
 * Operation flags class
 */
class OperationFlags {
  constructor() {
    this.flags = { ...DEFAULT_FLAGS };
    this.environment = process.env.NODE_ENV || 'development';
    this.timezone = process.env.TZ || 'UTC';
    
    this.validateEnvironment();
    this.logConfiguration();
  }
  
  /**
   * Get a specific flag value
   */
  get(flagName) {
    return this.flags[flagName];
  }
  
  /**
   * Set a flag value (runtime override)
   */
  set(flagName, value) {
    const oldValue = this.flags[flagName];
    this.flags[flagName] = value;
    
    logger.info('Operation flag changed', {
      flag: flagName,
      oldValue,
      newValue: value,
      environment: this.environment
    });
  }
  
  /**
   * Get all flags
   */
  getAll() {
    return { ...this.flags };
  }
  
  /**
   * Check if API is in read-only mode
   */
  isReadOnly() {
    return this.flags.READ_ONLY_API || this.flags.MAINTENANCE_MODE;
  }
  
  /**
   * Check if maintenance mode is enabled
   */
  isMaintenanceMode() {
    return this.flags.MAINTENANCE_MODE;
  }
  
  /**
   * Check if benefits processing is enabled
   */
  areBenefitsEnabled() {
    return this.flags.ENABLE_BENEFITS_RELEASE && !this.isReadOnly();
  }
  
  /**
   * Check if commissions processing is enabled
   */
  areCommissionsEnabled() {
    return this.flags.ENABLE_COMMISSIONS_RELEASE && !this.isReadOnly();
  }
  
  /**
   * Check if withdrawals are enabled
   */
  areWithdrawalsEnabled() {
    return this.flags.ENABLE_WITHDRAWALS && !this.isReadOnly();
  }
  
  /**
   * Check if new registrations are enabled
   */
  areRegistrationsEnabled() {
    return this.flags.ENABLE_NEW_REGISTRATIONS && !this.isMaintenanceMode();
  }
  
  /**
   * Check if cron jobs should run
   */
  areCronJobsEnabled() {
    return this.flags.ENABLE_CRON_JOBS && !this.isMaintenanceMode();
  }
  
  /**
   * Validate environment variables
   */
  validateEnvironment() {
    const missing = [];
    const warnings = [];
    
    // Check required variables
    for (const envVar of REQUIRED_ENV_VARS) {
      if (!process.env[envVar]) {
        missing.push(envVar);
      }
    }
    
    // Check recommended variables
    for (const envVar of RECOMMENDED_ENV_VARS) {
      if (!process.env[envVar]) {
        warnings.push(envVar);
      }
    }
    
    // Validate timezone
    if (this.timezone !== 'UTC' && this.environment === 'production') {
      warnings.push('TZ should be set to UTC in production');
    }
    
    // Log results
    if (missing.length > 0) {
      logger.error('Missing required environment variables', { missing });
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
    
    if (warnings.length > 0) {
      logger.warn('Missing recommended environment variables', { warnings });
    }
    
    logger.info('Environment validation completed', {
      environment: this.environment,
      timezone: this.timezone,
      missingRequired: missing.length,
      missingRecommended: warnings.length
    });
  }
  
  /**
   * Log current configuration
   */
  logConfiguration() {
    const criticalFlags = {
      ENABLE_BENEFITS_RELEASE: this.flags.ENABLE_BENEFITS_RELEASE,
      ENABLE_COMMISSIONS_RELEASE: this.flags.ENABLE_COMMISSIONS_RELEASE,
      READ_ONLY_API: this.flags.READ_ONLY_API,
      MAINTENANCE_MODE: this.flags.MAINTENANCE_MODE,
      ENABLE_WITHDRAWALS: this.flags.ENABLE_WITHDRAWALS,
      ENABLE_NEW_REGISTRATIONS: this.flags.ENABLE_NEW_REGISTRATIONS
    };
    
    logger.info('Operation flags initialized', {
      environment: this.environment,
      timezone: this.timezone,
      criticalFlags,
      totalFlags: Object.keys(this.flags).length
    });
    
    // Warn about potentially dangerous configurations
    if (this.environment === 'production') {
      if (this.flags.DEBUG_MODE) {
        logger.warn('DEBUG_MODE is enabled in production');
      }
      
      if (!this.flags.ENABLE_RATE_LIMITING) {
        logger.warn('Rate limiting is disabled in production');
      }
      
      if (!this.flags.ENABLE_AUDIT_LOGGING) {
        logger.warn('Audit logging is disabled in production');
      }
    }
  }
  
  /**
   * Get configuration summary for health checks
   */
  getHealthSummary() {
    return {
      environment: this.environment,
      timezone: this.timezone,
      readOnlyMode: this.isReadOnly(),
      maintenanceMode: this.isMaintenanceMode(),
      benefitsEnabled: this.areBenefitsEnabled(),
      commissionsEnabled: this.areCommissionsEnabled(),
      withdrawalsEnabled: this.areWithdrawalsEnabled(),
      registrationsEnabled: this.areRegistrationsEnabled(),
      cronJobsEnabled: this.areCronJobsEnabled(),
      rateLimitingEnabled: this.flags.ENABLE_RATE_LIMITING,
      auditLoggingEnabled: this.flags.ENABLE_AUDIT_LOGGING
    };
  }
  
  /**
   * Create middleware to check if operation is allowed
   */
  createOperationMiddleware(requiredFlag) {
    return (req, res, next) => {
      if (!this.flags[requiredFlag]) {
        return res.status(503).json({
          success: false,
          message: 'Esta operación está temporalmente deshabilitada',
          code: 'OPERATION_DISABLED',
          flag: requiredFlag
        });
      }
      
      if (this.isMaintenanceMode()) {
        return res.status(503).json({
          success: false,
          message: 'Sistema en mantenimiento. Intenta más tarde.',
          code: 'MAINTENANCE_MODE'
        });
      }
      
      next();
    };
  }
  
  /**
   * Create read-only middleware
   */
  createReadOnlyMiddleware() {
    return (req, res, next) => {
      if (this.isReadOnly() && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
        return res.status(503).json({
          success: false,
          message: 'API en modo solo lectura. No se permiten modificaciones.',
          code: 'READ_ONLY_MODE'
        });
      }
      
      next();
    };
  }
}

// Create singleton instance
const operationFlags = new OperationFlags();

module.exports = operationFlags;