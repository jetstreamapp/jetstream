/* eslint-disable @typescript-eslint/no-explicit-any */
import { NOOP } from '@jetstream/shared/utils';

interface Logger {
  log: (...args: any[]) => void;
  info: (...args: any[]) => void;
  warn: (...args: any[]) => void;
  error: (...args: any[]) => void;
  group: (...args: any[]) => void;
  groupCollapsed: (...args: any[]) => void;
  groupEnd: (...args: any[]) => void;
}

export const logger: Logger = {
  log: NOOP,
  info: NOOP,
  warn: NOOP,
  error: NOOP,
  group: NOOP,
  groupCollapsed: NOOP,
  groupEnd: NOOP,
};

export const enableLogger = (enable: boolean) => {
  if (!enable) {
    logger.log = NOOP;
    logger.info = NOOP;
    logger.warn = NOOP;
    logger.error = NOOP;
    logger.group = NOOP;
    logger.groupCollapsed = NOOP;
    logger.groupEnd = NOOP;
  } else {
    try {
      logger.log = console.log.bind(window.console, '%c DEBUG', 'color: blue; font-weight: bold;');
      logger.info = console.info.bind(window.console, '%c INFO', 'color: green; font-weight: bold;');
      logger.warn = console.warn.bind(window.console, '%c WARN', 'font-weight: bold;');
      logger.error = console.error.bind(window.console, '%c ERROR', 'font-weight: bold;');
      logger.group = console.group.bind(window.console);
      logger.groupCollapsed = console.groupCollapsed.bind(window.console);
      logger.groupEnd = console.groupEnd.bind(window.console);
    } catch (ex) {
      // fail silently
    }
  }
};

if (process.env.NODE_ENV === 'production') {
  enableLogger(false);
} else {
  enableLogger(true);
}
