/* eslint-disable @typescript-eslint/no-explicit-any */

// save the last {LOG_BUFFER_SIZE} logs in case of exception, logs can be provided
export const logBuffer: any[] = [];
const LOG_BUFFER_SIZE = 5;

function LOG_NOOP(...logs: any[]) {
  logBuffer.unshift(logs);
  logBuffer.splice(LOG_BUFFER_SIZE + 1);
}

interface Logger {
  isEnabled: boolean;
  trace: (...args: any[]) => void;
  debug: (...args: any[]) => void;
  log: (...args: any[]) => void;
  info: (...args: any[]) => void;
  warn: (...args: any[]) => void;
  error: (...args: any[]) => void;
  group: (...args: any[]) => void;
  groupCollapsed: (...args: any[]) => void;
  groupEnd: (...args: any[]) => void;
}

type LogLevel = 'trace' | 'debug' | 'log' | 'info' | 'warn' | 'error';

function isLogEnabled(type: LogLevel, level: LogLevel) {
  if (level === 'trace') {
    return true;
  }
  const levels = ['trace', 'debug', 'log', 'info', 'warn', 'error'];
  return levels.indexOf(type) >= levels.indexOf(level);
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
  return undefined;
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
  trace: LOG_NOOP,
  debug: LOG_NOOP,
  log: LOG_NOOP,
  info: LOG_NOOP,
  warn: LOG_NOOP,
  error: LOG_NOOP,
  group: LOG_NOOP,
  groupCollapsed: LOG_NOOP,
  groupEnd: LOG_NOOP,
};

export const enableLogger = (enable: boolean, logLevel: LogLevel = 'debug') => {
  logger.isEnabled = enable;
  if (!enable) {
    clearLoggingEnabledState();
    logger.trace = LOG_NOOP;
    logger.debug = LOG_NOOP;
    logger.log = LOG_NOOP;
    logger.info = LOG_NOOP;
    logger.warn = LOG_NOOP;
    logger.error = console.error.bind(globalThis.console, '%c ERROR', 'font-weight: bold;');
    logger.group = LOG_NOOP;
    logger.groupCollapsed = LOG_NOOP;
    logger.groupEnd = LOG_NOOP;
  } else {
    try {
      saveLoggingEnabledState();
      if (globalThis?.console && globalThis?.document) {
        if (isLogEnabled('trace', logLevel)) {
          logger.trace = console.trace.bind(globalThis.console, '%c TRACE', 'color: yellow; font-weight: bold;');
        }
        if (isLogEnabled('debug', logLevel)) {
          logger.debug = console.debug.bind(globalThis.console, '%c DEBUG', 'color: blue; font-weight: bold;');
        }
        if (isLogEnabled('log', logLevel)) {
          logger.log = console.log.bind(globalThis.console, '%c DEBUG', 'color: blue; font-weight: bold;');
        }
        if (isLogEnabled('info', logLevel)) {
          logger.info = console.info.bind(globalThis.console, '%c INFO', 'color: green; font-weight: bold;');
        }
        if (isLogEnabled('warn', logLevel)) {
          logger.warn = console.warn.bind(globalThis.console, '%c WARN', 'font-weight: bold;');
        }
        if (isLogEnabled('error', logLevel)) {
          logger.error = console.error.bind(globalThis.console, '%c ERROR', 'font-weight: bold;');
        }
        logger.group = console.group.bind(globalThis.console);
        logger.groupCollapsed = console.groupCollapsed.bind(globalThis.console);
        logger.groupEnd = console.groupEnd.bind(globalThis.console);
      } else {
        // don't bind for worker scope
        if (isLogEnabled('trace', logLevel)) {
          logger.trace = (...args: any[]) => console.log('[WORKER]', ...args);
        }
        if (isLogEnabled('debug', logLevel)) {
          logger.debug = (...args: any[]) => console.log('[WORKER]', ...args);
        }
        if (isLogEnabled('log', logLevel)) {
          logger.log = (...args: any[]) => console.log('[WORKER]', ...args);
        }
        if (isLogEnabled('info', logLevel)) {
          logger.info = (...args: any[]) => console.info('[WORKER]', ...args);
        }
        if (isLogEnabled('warn', logLevel)) {
          logger.warn = (...args: any[]) => console.warn('[WORKER]', ...args);
        }
        if (isLogEnabled('error', logLevel)) {
          logger.error = (...args: any[]) => console.error('[WORKER]', ...args);
        }
      }
      logger.info('Logging enabled', { logLevel });
    } catch (ex) {
      // fail silently
    }
  }
};

if (process.env.NODE_ENV !== 'production') {
  enableLogger(true, 'trace');
} else if (SESSION_LOGGING_ENABLED) {
  enableLogger(true, 'debug');
} else {
  enableLogger(false);
}
