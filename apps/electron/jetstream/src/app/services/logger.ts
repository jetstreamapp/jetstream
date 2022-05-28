import * as logger from 'electron-log';
import App from '../app';

export function initLogger() {
  if (!App.isDevelopmentOrDebug()) {
    logger.transports.file.level = false;
    logger.transports.logger.level = false;
  }
}

try {
  logger.log('[LOGGER][FILEPATH]', logger.transports.file.getFile()?.path);
} catch (ex) {
  // ignore
}

export default logger;
