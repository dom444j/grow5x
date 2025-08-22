const pino = require('pino');

// Configuración del logger con pino
let logger;

if (process.env.NODE_ENV === 'test') {
  // Use simple logger for tests to avoid open handles
  logger = {
    info: () => {},
    error: () => {},
    warn: () => {},
    debug: () => {},
    trace: () => {},
    fatal: () => {},
    child: () => logger,
    level: 'silent'
  };
} else {
  logger = pino({
    level: process.env.LOG_LEVEL || 'info',
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname'
      }
    },
    base: {
      env: process.env.NODE_ENV || 'development'
    }
  });
}

// Export both the logger instance and convenience functions
module.exports = logger;
module.exports.logInfo = logger.info.bind(logger);
module.exports.logError = logger.error.bind(logger);
module.exports.logWarn = logger.warn.bind(logger);
module.exports.logDebug = logger.debug.bind(logger);