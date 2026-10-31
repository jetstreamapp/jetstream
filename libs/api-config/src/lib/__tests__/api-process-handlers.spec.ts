import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { logger } from '../api-logger';
import { installProcessErrorHandlers } from '../api-process-handlers';

vi.mock('../api-logger', () => ({
  logger: { error: vi.fn() },
}));

type ProcessErrorEvent = 'uncaughtException' | 'unhandledRejection';
type ProcessErrorListener = (...args: unknown[]) => void;

const PROCESS_ERROR_EVENTS: ProcessErrorEvent[] = ['uncaughtException', 'unhandledRejection'];

function getListeners(event: ProcessErrorEvent): ProcessErrorListener[] {
  const listeners = event === 'uncaughtException' ? process.listeners('uncaughtException') : process.listeners('unhandledRejection');
  return listeners as ProcessErrorListener[];
}

describe('installProcessErrorHandlers', () => {
  const listenersBefore = new Map<ProcessErrorEvent, Set<ProcessErrorListener>>();

  function getInstalledListeners(event: ProcessErrorEvent) {
    return getListeners(event).filter((listener) => !listenersBefore.get(event)?.has(listener));
  }

  beforeEach(() => {
    vi.mocked(logger.error).mockClear();
    PROCESS_ERROR_EVENTS.forEach((event) => listenersBefore.set(event, new Set(getListeners(event))));
  });

  afterEach(() => {
    PROCESS_ERROR_EVENTS.forEach((event) => {
      getInstalledListeners(event).forEach((listener) => process.off(event, listener));
    });
    vi.restoreAllMocks();
  });

  it('installs exactly one listener for each event', () => {
    installProcessErrorHandlers();

    expect(getInstalledListeners('uncaughtException')).toHaveLength(1);
    expect(getInstalledListeners('unhandledRejection')).toHaveLength(1);
  });

  it('logs uncaught exceptions without exiting', () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    installProcessErrorHandlers();
    const error = new Error('boom');

    getInstalledListeners('uncaughtException')[0](error, 'uncaughtException');

    expect(logger.error).toHaveBeenCalledWith({ err: error }, '[PROCESS][UNCAUGHT_EXCEPTION]');
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('logs unhandled rejections without exiting', () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    installProcessErrorHandlers();
    const reason = new Error('rejected');

    getInstalledListeners('unhandledRejection')[0](reason, Promise.resolve());

    expect(logger.error).toHaveBeenCalledWith({ err: reason }, '[PROCESS][UNHANDLED_REJECTION]');
    expect(exitSpy).not.toHaveBeenCalled();
  });
});
