const pino = require('pino');

// Configuración del logger con pino
const logger = pino({
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

module.exports = logger;