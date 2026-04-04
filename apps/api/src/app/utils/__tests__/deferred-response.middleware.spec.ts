import { HTTP } from '@jetstream/shared/constants';
import { EventEmitter } from 'events';
import { deferredResponseMiddleware, writeDeferredResponse, type DeferredResponseState } from '../deferred-response.middleware';

vi.mock('@jetstream/api-config', () => ({
  getExceptionLog: (ex: unknown) => ({ message: ex instanceof Error ? ex.message : String(ex) }),
  ENV: {
    DEFERRED_RESPONSE_ENABLED: true,
    DEFERRED_RESPONSE_THRESHOLD_MS: 75_000,
    DEFERRED_RESPONSE_KEEPALIVE_MS: 25_000,
  },
}));

let mockEnv: Record<string, unknown>;

beforeAll(async () => {
  const apiConfig = await vi.importMock<{ ENV: Record<string, unknown> }>('@jetstream/api-config');
  mockEnv = apiConfig.ENV;
});

vi.mock('../response.handlers', () => ({
  setCookieHeaders: vi.fn(),
}));

function createMockReq() {
  const req = new EventEmitter() as EventEmitter & { method: string; originalUrl: string };
  req.method = 'GET';
  req.originalUrl = '/api/describe';
  return req;
}

function createMockRes() {
  const chunks: string[] = [];
  let headersWritten = false;
  let ended = false;
  const writtenHeaders: Record<string, string> = {};

  const res = {
    locals: {
      requestId: 'test-request-id',
    } as Record<string, unknown>,
    headersSent: false,
    writableEnded: false,
    log: {
      warn: vi.fn(),
      info: vi.fn(),
      debug: vi.fn(),
      error: vi.fn(),
    },
    writeHead: vi.fn((status: number, headers: Record<string, string>) => {
      headersWritten = true;
      res.headersSent = true;
      Object.assign(writtenHeaders, headers);
    }),
    write: vi.fn((data: string) => {
      chunks.push(data);
      return true;
    }),
    end: vi.fn(() => {
      ended = true;
      res.writableEnded = true;
    }),
    destroy: vi.fn(),
    // Helpers for assertions
    _chunks: chunks,
    _headersWritten: () => headersWritten,
    _writtenHeaders: writtenHeaders,
    _ended: () => ended,
  };

  return res;
}

describe('deferredResponseMiddleware', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('should call next immediately and not modify response for fast requests', () => {
    const req = createMockReq();
    const res = createMockRes();
    const next = vi.fn();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    deferredResponseMiddleware(req as any, res as any, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.writeHead).not.toHaveBeenCalled();
    expect(res.write).not.toHaveBeenCalled();

    // Deferred state should be set on locals but not active
    const deferred = res.locals._deferred as DeferredResponseState;
    expect(deferred).toBeDefined();
    expect(deferred.active).toBe(false);
  });

  it('should activate deferred mode after the threshold', () => {
    const req = createMockReq();
    const res = createMockRes();
    const next = vi.fn();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    deferredResponseMiddleware(req as any, res as any, next);

    // Advance past threshold (default 45s)
    vi.advanceTimersByTime(75_000);

    const deferred = res.locals._deferred as DeferredResponseState;
    expect(deferred.active).toBe(true);
    expect(res.writeHead).toHaveBeenCalledWith(
      200,
      expect.objectContaining({
        'Content-Type': HTTP.CONTENT_TYPE.JSON,
        'Transfer-Encoding': 'chunked',
        [HTTP.HEADERS.X_DEFERRED_RESPONSE]: '1',
      }),
    );
    // First keepalive byte
    expect(res._chunks).toEqual([' ']);
    expect(res.log.warn).toHaveBeenCalledWith(
      expect.objectContaining({ requestId: 'test-request-id' }),
      expect.stringContaining('[DEFERRED][ACTIVATED]'),
    );
  });

  it('should send periodic keepalive bytes', () => {
    const req = createMockReq();
    const res = createMockRes();
    const next = vi.fn();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    deferredResponseMiddleware(req as any, res as any, next);

    // Activate deferred mode
    vi.advanceTimersByTime(75_000);
    expect(res._chunks).toHaveLength(1); // initial keepalive

    // First keepalive interval (25s)
    vi.advanceTimersByTime(25_000);
    expect(res._chunks).toHaveLength(2);

    // Second keepalive interval
    vi.advanceTimersByTime(25_000);
    expect(res._chunks).toHaveLength(3);

    expect(res.log.debug).toHaveBeenCalledWith(
      expect.objectContaining({ keepaliveCount: expect.any(Number) }),
      expect.stringContaining('[DEFERRED][KEEPALIVE]'),
    );
  });

  it('should not activate deferred mode if response is already sent', () => {
    const req = createMockReq();
    const res = createMockRes();
    const next = vi.fn();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    deferredResponseMiddleware(req as any, res as any, next);

    // Simulate response already sent (e.g., streaming controller)
    res.headersSent = true;

    vi.advanceTimersByTime(75_000);

    const deferred = res.locals._deferred as DeferredResponseState;
    expect(deferred.active).toBe(false);
    // writeHead should not be called by the middleware (headersSent was already true from controller)
    expect(res.writeHead).not.toHaveBeenCalled();
  });

  it('should skip entirely when DEFERRED_RESPONSE_ENABLED is false', () => {
    mockEnv.DEFERRED_RESPONSE_ENABLED = false;

    const req = createMockReq();
    const res = createMockRes();
    const next = vi.fn();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    deferredResponseMiddleware(req as any, res as any, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.locals._deferred).toBeUndefined();

    vi.advanceTimersByTime(75_000);
    expect(res.writeHead).not.toHaveBeenCalled();

    mockEnv.DEFERRED_RESPONSE_ENABLED = true;
  });

  it('should destroy stream when first keepalive write fails', () => {
    const req = createMockReq();
    const res = createMockRes();
    const next = vi.fn();
    let writeCallCount = 0;
    res.write = vi.fn(() => {
      writeCallCount++;
      // Fail on the first write (initial keepalive after writeHead)
      throw new Error('connection reset');
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    deferredResponseMiddleware(req as any, res as any, next);

    vi.advanceTimersByTime(75_000);

    const deferred = res.locals._deferred as DeferredResponseState;
    expect(deferred.active).toBe(false);
    expect(res.destroy).toHaveBeenCalled();
    expect(res.log.error).toHaveBeenCalledWith(
      expect.objectContaining({ requestId: 'test-request-id' }),
      expect.stringContaining('[DEFERRED][WRITE_ERROR] Failed to write initial keepalive'),
    );
  });

  it('should destroy stream when keepalive interval write fails', () => {
    const req = createMockReq();
    const res = createMockRes();
    const next = vi.fn();
    let writeCallCount = 0;
    const originalWrite = res.write;
    res.write = vi.fn((data: string) => {
      writeCallCount++;
      if (writeCallCount > 1) {
        // Fail on second write (first interval keepalive)
        throw new Error('connection reset');
      }
      return originalWrite(data);
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    deferredResponseMiddleware(req as any, res as any, next);

    // Activate deferred mode (first write succeeds)
    vi.advanceTimersByTime(75_000);
    const deferred = res.locals._deferred as DeferredResponseState;
    expect(deferred.active).toBe(true);

    // First keepalive interval — write fails
    vi.advanceTimersByTime(25_000);

    expect(deferred.active).toBe(false);
    expect(res.destroy).toHaveBeenCalled();
    expect(res.log.error).toHaveBeenCalledWith(
      expect.objectContaining({ requestId: 'test-request-id' }),
      expect.stringContaining('destroying stream'),
    );
  });

  it('should clean up on client disconnect', () => {
    const req = createMockReq();
    const res = createMockRes();
    const next = vi.fn();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    deferredResponseMiddleware(req as any, res as any, next);

    // Activate deferred mode
    vi.advanceTimersByTime(75_000);
    const deferred = res.locals._deferred as DeferredResponseState;
    expect(deferred.active).toBe(true);

    // Simulate client disconnect
    req.emit('close');

    expect(deferred.active).toBe(false);
    expect(deferred.timer).toBeNull();
    expect(deferred.keepaliveInterval).toBeNull();
    expect(res.log.warn).toHaveBeenCalledWith(
      expect.objectContaining({ requestId: 'test-request-id' }),
      expect.stringContaining('[DEFERRED][CLIENT_DISCONNECT]'),
    );
  });
});

describe('writeDeferredResponse', () => {
  it('should return false when not in deferred mode', () => {
    const res = createMockRes();
    const result = writeDeferredResponse(res as any, { data: 'test' });
    expect(result).toBe(false);
    expect(res.write).not.toHaveBeenCalled();
  });

  it('should return false when deferred state does not exist', () => {
    const res = createMockRes();
    delete res.locals._deferred;
    const result = writeDeferredResponse(res as any, { data: 'test' });
    expect(result).toBe(false);
  });

  it('should write JSON body and end response in deferred mode', () => {
    const res = createMockRes();
    const deferred: DeferredResponseState = {
      active: true,
      timer: null,
      keepaliveInterval: null,
      startTime: Date.now() - 50_000,
      keepaliveCount: 2,
    };
    res.locals._deferred = deferred;

    const body = { data: { message: 'success' } };
    const result = writeDeferredResponse(res as any, body);

    expect(result).toBe(true);
    expect(res.write).toHaveBeenCalledWith(JSON.stringify(body));
    expect(res.end).toHaveBeenCalled();
    expect(deferred.active).toBe(false);
  });

  it('should write error body in deferred mode', () => {
    const res = createMockRes();
    const deferred: DeferredResponseState = {
      active: true,
      timer: null,
      keepaliveInterval: null,
      startTime: Date.now() - 60_000,
      keepaliveCount: 3,
    };
    res.locals._deferred = deferred;

    const errorBody = { error: true, success: false, message: 'Token expired' };
    const result = writeDeferredResponse(res as any, errorBody);

    expect(result).toBe(true);
    expect(res.write).toHaveBeenCalledWith(JSON.stringify(errorBody));
    expect(res.end).toHaveBeenCalled();
    expect(deferred.active).toBe(false);
  });

  it('should handle write errors gracefully', () => {
    const res = createMockRes();
    res.write = vi.fn(() => {
      throw new Error('write failed');
    });
    const deferred: DeferredResponseState = {
      active: true,
      timer: null,
      keepaliveInterval: null,
      startTime: Date.now() - 50_000,
      keepaliveCount: 2,
    };
    res.locals._deferred = deferred;

    const result = writeDeferredResponse(res as any, { data: 'test' });

    expect(result).toBe(true);
    expect(deferred.active).toBe(false);
    expect(res.end).toHaveBeenCalled();
    expect(res.log.error).toHaveBeenCalledWith(
      expect.objectContaining({ requestId: 'test-request-id' }),
      expect.stringContaining('[DEFERRED][WRITE_ERROR]'),
    );
  });

  it('should write fallback error when JSON.stringify fails', () => {
    const res = createMockRes();
    const deferred: DeferredResponseState = {
      active: true,
      timer: null,
      keepaliveInterval: null,
      startTime: Date.now() - 50_000,
      keepaliveCount: 2,
    };
    res.locals._deferred = deferred;

    // Create a circular reference that JSON.stringify can't handle
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    const result = writeDeferredResponse(res as any, circular);

    expect(result).toBe(true);
    expect(deferred.active).toBe(false);
    // Should have written the fallback error body
    expect(res.write).toHaveBeenCalledWith('{"error":true,"success":false,"message":"Internal server error"}');
    expect(res.end).toHaveBeenCalled();
  });

  it('should not write fallback error after partial res.write', () => {
    const res = createMockRes();
    let writeCallCount = 0;
    res.write = vi.fn(() => {
      writeCallCount++;
      if (writeCallCount === 1) {
        // First write (the JSON body) throws mid-write
        throw new Error('write failed mid-stream');
      }
      return true;
    });
    const deferred: DeferredResponseState = {
      active: true,
      timer: null,
      keepaliveInterval: null,
      startTime: Date.now() - 50_000,
      keepaliveCount: 2,
    };
    res.locals._deferred = deferred;

    const result = writeDeferredResponse(res as any, { data: 'test' });

    expect(result).toBe(true);
    // write was called once (the body attempt that threw), not twice (no fallback)
    expect(res.write).toHaveBeenCalledTimes(1);
    expect(res.end).toHaveBeenCalled();
  });

  it('should call res.destroy when res.end also fails', () => {
    const res = createMockRes();
    res.write = vi.fn(() => {
      throw new Error('write failed');
    });
    res.end = vi.fn(() => {
      throw new Error('end failed');
    });
    const deferred: DeferredResponseState = {
      active: true,
      timer: null,
      keepaliveInterval: null,
      startTime: Date.now() - 50_000,
      keepaliveCount: 2,
    };
    res.locals._deferred = deferred;

    const result = writeDeferredResponse(res as any, { data: 'test' });

    expect(result).toBe(true);
    expect(deferred.active).toBe(false);
    expect(res.destroy).toHaveBeenCalled();
  });

  it('should clear timers when writing deferred response', () => {
    vi.useFakeTimers();
    const res = createMockRes();
    const timer = setTimeout(() => {}, 10_000);
    const interval = setInterval(() => {}, 5_000);
    const deferred: DeferredResponseState = {
      active: true,
      timer,
      keepaliveInterval: interval,
      startTime: Date.now() - 50_000,
      keepaliveCount: 2,
    };
    res.locals._deferred = deferred;

    writeDeferredResponse(res as any, { data: 'test' });

    expect(deferred.timer).toBeNull();
    expect(deferred.keepaliveInterval).toBeNull();
    vi.useRealTimers();
  });
});

describe('JSON.parse with space-padded response', () => {
  it('should parse JSON with leading spaces (simulating chunked keepalive)', () => {
    const originalJson = '{"data":{"message":"hello"}}';
    const paddedJson = '   ' + originalJson;

    expect(JSON.parse(paddedJson)).toEqual({ data: { message: 'hello' } });
  });

  it('should parse error JSON with leading spaces', () => {
    const errorJson = '{"error":true,"message":"Token expired"}';
    const paddedJson = '     ' + errorJson;

    const parsed = JSON.parse(paddedJson);
    expect(parsed.error).toBe(true);
    expect(parsed.message).toBe('Token expired');
  });
});
