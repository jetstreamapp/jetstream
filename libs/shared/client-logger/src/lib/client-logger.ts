/* eslint-disable @typescript-eslint/no-explicit-any */

// save the last {LOG_BUFFER_SIZE} logs in case of exception, logs can be provided
export let logBuffer = [];
const LOG_BUFFER_SIZE = 5;

function LOG_NOOP(...logs: any[]) {
  logBuffer.unshift(logs);
  logBuffer.splice(LOG_BUFFER_SIZE + 1);
}

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
  log: LOG_NOOP,
  info: LOG_NOOP,
  warn: LOG_NOOP,
  error: LOG_NOOP,
  group: LOG_NOOP,
  groupCollapsed: LOG_NOOP,
  groupEnd: LOG_NOOP,
};

export const enableLogger = (enable: boolean) => {
  logger.isEnabled = enable;
  if (!enable) {
    clearLoggingEnabledState();
    logger.log = LOG_NOOP;
    logger.info = LOG_NOOP;
    logger.warn = LOG_NOOP;
    logger.error = LOG_NOOP;
    logger.group = LOG_NOOP;
    logger.groupCollapsed = LOG_NOOP;
    logger.groupEnd = LOG_NOOP;
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
