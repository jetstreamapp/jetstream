import pino from 'pino';

export const logger = pino({
  level: 'debug',
  name: 'cron-tasks',
});
