import { afterEach, describe, expect, it, vi } from 'vitest';
import { notifySessionsRevoked, onSessionsRevoked } from '../session-revocation';

const loggerMock = vi.hoisted(() => ({ error: vi.fn() }));

vi.mock('@jetstream/api-config', () => ({
  logger: loggerMock,
}));

describe('session revocation hook', () => {
  const unsubscribers: Array<() => void> = [];

  afterEach(() => {
    unsubscribers.splice(0).forEach((unsubscribe) => unsubscribe());
    vi.clearAllMocks();
  });

  it('delivers every revocation to every registered listener', () => {
    const first = vi.fn();
    const second = vi.fn();
    unsubscribers.push(onSessionsRevoked(first), onSessionsRevoked(second));

    notifySessionsRevoked({ type: 'session', sessionId: 'sid-1' });
    notifySessionsRevoked({ type: 'user', userId: 'user-1', exceptSessionId: 'sid-2' });

    expect(first).toHaveBeenCalledTimes(2);
    expect(second).toHaveBeenNthCalledWith(1, { type: 'session', sessionId: 'sid-1' });
    expect(second).toHaveBeenNthCalledWith(2, { type: 'user', userId: 'user-1', exceptSessionId: 'sid-2' });
  });

  it('stops delivering once a listener unsubscribes', () => {
    const listener = vi.fn();
    const unsubscribe = onSessionsRevoked(listener);

    unsubscribe();
    notifySessionsRevoked({ type: 'session', sessionId: 'sid-1' });

    expect(listener).not.toHaveBeenCalled();
  });

  it('isolates a failing listener so the revocation still completes and the others still run', () => {
    const failing = vi.fn(() => {
      throw new Error('socket server down');
    });
    const healthy = vi.fn();
    unsubscribers.push(onSessionsRevoked(failing), onSessionsRevoked(healthy));

    expect(() => notifySessionsRevoked({ type: 'session', sessionId: 'sid-1' })).not.toThrow();

    expect(healthy).toHaveBeenCalledTimes(1);
    expect(loggerMock.error).toHaveBeenCalledTimes(1);
  });
});
