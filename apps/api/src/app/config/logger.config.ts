import * as winston from 'winston';

const { createLogger, format, transports } = winston;

export const logger = createLogger({
  level: 'debug',
  format: format.combine(
    format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss',
    }),
    format.errors({ stack: true }),
    format.splat(),
    format.json()
  ),
  defaultMeta: { service: 'jetstream' },
  transports: [
    new transports.Console({
      format: format.combine(format.colorize(), format.simple()),
    }),
  ],
  // TODO: put this in a shared mounted directory
  exceptionHandlers: [new transports.File({ filename: './logs/unhandled-exceptions.log', level: 'error' })],
  // this is in docs but not typescript definition?
  // rejectionHandlers: [
  //   new transports.File({ filename: 'unhandled-exceptions.log'}),
  // ]
});
