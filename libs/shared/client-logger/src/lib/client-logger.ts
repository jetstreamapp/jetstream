/* eslint-disable @typescript-eslint/no-explicit-any */
import { NOOP } from '@jetstream/shared/utils';

interface Logger {
  isEnabled: boolean;
  log: (...args: any[]) => void;
  info: (...args: any[]) => void;
  warn: (...args: any[]) => void;
  error: (...args: any[]) => void;
  group: (...args: any[]) => void;
  groupCollapsed: (...args: any[]) => void;
  groupEnd: (...args: any[]) => void;
}

// value used in sessionStorage to indicate logging is enabled
const SESSION_KEY = 'LOGGER';
const SESSION_VALUE_ENABLED = '1';

// if logging was previously turned on for session, then retain state
const SESSION_LOGGING_ENABLED = getLoggingEnabledState();

function getLoggingEnabledState() {
  try {
    if (sessionStorage) {
      return sessionStorage.getItem(SESSION_KEY);
    }
  } catch (ex) {
    return undefined;
  }
}

function saveLoggingEnabledState() {
  try {
    if (sessionStorage) {
      sessionStorage.setItem(SESSION_KEY, SESSION_VALUE_ENABLED);
    }
  } catch (ex) {
    // ignore errors
  }
}

function clearLoggingEnabledState() {
  try {
    if (sessionStorage) {
      sessionStorage.removeItem(SESSION_KEY);
    }
  } catch (ex) {
    // ignore errors
  }
}

export const logger: Logger = {
  isEnabled: false,
  log: NOOP,
  info: NOOP,
  warn: NOOP,
  error: NOOP,
  group: NOOP,
  groupCollapsed: NOOP,
  groupEnd: NOOP,
};

export const enableLogger = (enable: boolean) => {
  logger.isEnabled = enable;
  if (!enable) {
    clearLoggingEnabledState();
    logger.log = NOOP;
    logger.info = NOOP;
    logger.warn = NOOP;
    logger.error = NOOP;
    logger.group = NOOP;
    logger.groupCollapsed = NOOP;
    logger.groupEnd = NOOP;
  } else {
    try {
      saveLoggingEnabledState();
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

if (SESSION_LOGGING_ENABLED || process.env.NODE_ENV !== 'production') {
  enableLogger(true);
} else {
  enableLogger(false);
}
