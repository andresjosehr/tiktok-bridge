const winston = require('winston');
const config = require('../config/config');

const logger = winston.createLogger({
  level: config.logging.level,
  format: winston.format.combine(
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

if (config.logging.file) {
  logger.add(new winston.transports.File({
    filename: 'logs/error.log',
    level: 'error',
    maxsize: config.logging.maxSize,
    maxFiles: config.logging.maxFiles
  }));

  logger.add(new winston.transports.File({
    filename: config.logging.file,
    maxsize: config.logging.maxSize,
    maxFiles: config.logging.maxFiles
  }));
}

module.exports = logger;