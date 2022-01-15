/* eslint-disable @typescript-eslint/no-empty-function */
import { environment } from '../environments/environment';

const DEBUG = !environment.production;
interface Logger {
  isEnabled: boolean;
  log: (...args: any[]) => void;
  error: (...args: any[]) => void;
}

export const logger: Logger = {
  isEnabled: false,
  log: () => {},
  error: () => {},
};

if (DEBUG) {
  logger.log = console.log.bind(console, '%c DEBUG', 'color: blue; font-weight: bold;');
  logger.error = console.error.bind(console, '%c ERROR', 'font-weight: bold;');
}
