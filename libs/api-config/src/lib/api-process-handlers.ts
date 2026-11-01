import { logger } from './api-logger';

/**
 * Install process-wide handlers for errors that nothing else handled. Call once, at the top of a server's entry point.
 *
 * Both handlers only log, so the process keeps running. `unhandledRejection` is explicit so every environment
 * behaves like production, where Sentry's handler (warn mode) otherwise keeps Node from turning a rejection into
 * an uncaught exception.
 *
 * TODO: `uncaughtException` should flush logs and exit once the stream error-handling fixes have shipped - after an
 * uncaught exception the process state is unknown, and the cluster primary replaces exited workers.
 */
export function installProcessErrorHandlers() {
  process.on('uncaughtException', (err) => {
    logger.error({ err }, '[PROCESS][UNCAUGHT_EXCEPTION]');
  });

  process.on('unhandledRejection', (reason) => {
    logger.error({ err: reason }, '[PROCESS][UNHANDLED_REJECTION]');
  });
}
