import * as winston from 'winston';

import { YYYY_MM_DD__HH_mm_ss } from '@jetstream/shared/constants';
const { createLogger, format, transports } = winston;

export const logger = createLogger({
  level: process.env.CI ? 'info' : 'debug',
  format: format.combine(
    format.timestamp({
      format: YYYY_MM_DD__HH_mm_ss,
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
  // exceptionHandlers: [new transports.File({ filename: './logs/unhandled-exceptions.log', level: 'error' })],
  // this is in docs but not typescript definition?
  // rejectionHandlers: [
  //   new transports.File({ filename: 'unhandled-exceptions.log'}),
  // ]
});
