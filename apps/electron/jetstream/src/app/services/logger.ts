import * as logger from 'electron-log';

try {
  logger.log('[LOGGER][FILEPATH]', logger.transports.file.getFile()?.path);
} catch (ex) {
  // ignore
}

export default logger;
