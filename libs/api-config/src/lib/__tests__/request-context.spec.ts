import { describe, expect, it, vi } from 'vitest';
import { enrichRequestContext, getLogger, getRequestContext, runWithRequestContext } from '../request-context';

// Mock the base logger so the test does not pull in pino/env-config. The fake logger records the
// accumulated bindings on each `child()` so we can assert what the request-scoped logger carries.
vi.mock('../api-logger', () => {
  const makeLogger = (bindings: Record<string, unknown> = {}): Record<string, unknown> => ({
    bindings,
    child: (extra: Record<string, unknown>) => makeLogger({ ...bindings, ...extra }),
    trace: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  });
  return { logger: makeLogger() };
});

function bindingsOf(logger: unknown): Record<string, unknown> {
  return (logger as { bindings: Record<string, unknown> }).bindings;
}

describe('request-context', () => {
  it('returns the base logger (no request bindings) outside of a request scope', () => {
    expect(bindingsOf(getLogger())).toEqual({});
    expect(getRequestContext()).toBeUndefined();
  });

  it('binds requestId to the logger inside a request scope', () => {
    runWithRequestContext({ requestId: 'req-1' }, () => {
      expect(bindingsOf(getLogger())).toEqual({ requestId: 'req-1' });
      expect(getRequestContext()?.requestId).toBe('req-1');
    });
  });

  it('folds late-bound context into the logger and subsequent getLogger() calls observe it', () => {
    runWithRequestContext({ requestId: 'req-2' }, () => {
      enrichRequestContext({ userId: 'user-1' });
      enrichRequestContext({ orgId: 42 });
      expect(bindingsOf(getLogger())).toEqual({ requestId: 'req-2', userId: 'user-1', orgId: 42 });
      const context = getRequestContext();
      expect(context?.userId).toBe('user-1');
      expect(context?.orgId).toBe(42);
    });
  });

  it('ignores null/undefined enrichment values', () => {
    runWithRequestContext({ requestId: 'req-3' }, () => {
      enrichRequestContext({ userId: undefined, sessionId: null as unknown as string });
      expect(bindingsOf(getLogger())).toEqual({ requestId: 'req-3' });
    });
  });

  it('isolates context between concurrent scopes', async () => {
    const seen: Record<string, unknown>[] = [];
    await Promise.all([
      new Promise<void>((resolve) =>
        runWithRequestContext({ requestId: 'a' }, async () => {
          enrichRequestContext({ userId: 'user-a' });
          await Promise.resolve();
          seen.push(bindingsOf(getLogger()));
          resolve();
        }),
      ),
      new Promise<void>((resolve) =>
        runWithRequestContext({ requestId: 'b' }, async () => {
          enrichRequestContext({ userId: 'user-b' });
          await Promise.resolve();
          seen.push(bindingsOf(getLogger()));
          resolve();
        }),
      ),
    ]);
    expect(seen).toContainEqual({ requestId: 'a', userId: 'user-a' });
    expect(seen).toContainEqual({ requestId: 'b', userId: 'user-b' });
  });

  it('enrichRequestContext is a no-op outside a request scope', () => {
    expect(() => enrichRequestContext({ userId: 'nobody' })).not.toThrow();
    expect(bindingsOf(getLogger())).toEqual({});
  });
});
