import * as winston from 'winston';

const { createLogger, format, transports } = winston;

export const logger = createLogger({
  level: 'debug',
  format: format.combine(
    format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss',
    }),
    format.errors({ stack: true }),
    format.json()
  ),
  defaultMeta: { service: 'jetstream' },
  transports: [
    new transports.File({ filename: 'quick-start-error.log', level: 'error' }),
    // new transports.File({ filename: 'quick-start-combined.log' }),
    new transports.Console({
      format: format.combine(format.colorize(), format.simple()),
    }),
  ],
});
