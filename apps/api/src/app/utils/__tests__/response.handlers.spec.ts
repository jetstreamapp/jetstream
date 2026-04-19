import { PassThrough } from 'node:stream';
import { describe, expect, it, vi } from 'vitest';
import { AuthenticationError, NotFoundError, UserFacingError } from '../error-handler';
import { streamParsedCsvAsJson, uncaughtErrorHandler } from '../response.handlers';

const prismaMocks = vi.hoisted(() => {
  class PrismaClientKnownRequestError extends Error {
    code = 'P2002';
  }
  class PrismaClientUnknownRequestError extends Error {}
  class PrismaClientValidationError extends Error {}

  return {
    PrismaClientKnownRequestError,
    PrismaClientUnknownRequestError,
    PrismaClientValidationError,
  };
});

vi.mock('@jetstream/api-config', () => ({
  ENV: {
    JETSTREAM_SERVER_URL: 'https://getjetstream.app',
  },
  getExceptionLog: (error: unknown, includeStack = false) => ({
    error: error instanceof Error ? error.message : error,
    stack: includeStack && error instanceof Error ? error.stack : undefined,
  }),
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
  prisma: {},
  rollbarServer: {
    warn: vi.fn(),
  },
}));

vi.mock('@jetstream/auth/server', () => ({
  AuthError: class AuthError extends Error {
    type = 'auth_error';
  },
  createCSRFToken: vi.fn(),
  getCookieConfig: vi.fn(),
}));

vi.mock('@jetstream/prisma', () => ({
  isPrismaError: (error: unknown) => Boolean((error as { isPrismaError?: boolean })?.isPrismaError),
  Prisma: {
    PrismaClientKnownRequestError: prismaMocks.PrismaClientKnownRequestError,
    PrismaClientUnknownRequestError: prismaMocks.PrismaClientUnknownRequestError,
    PrismaClientValidationError: prismaMocks.PrismaClientValidationError,
  },
  toTypedPrismaError: (error: { code?: string }) => ({ code: error.code }),
}));

vi.mock('../../db/salesforce-org.db', () => ({
  updateOrg_UNSAFE: vi.fn(),
}));

function createMockReq() {
  return {
    get: vi.fn(() => 'application/json'),
    method: 'POST',
    originalUrl: '/api/test',
    params: {},
    query: {},
    body: {},
    session: {},
    url: '/api/test',
  };
}

function createMockRes() {
  const res = {
    headersSent: false,
    locals: {
      cookies: {},
      requestId: 'request-id',
    },
    log: {
      debug: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
    },
    json: vi.fn(),
    redirect: vi.fn(),
    set: vi.fn(),
    status: vi.fn(),
    appendHeader: vi.fn(),
  };
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  res.redirect.mockReturnValue(res);
  res.set.mockReturnValue(res);
  return res;
}

async function handleError(error: unknown) {
  const req = createMockReq();
  const res = createMockRes();
  await uncaughtErrorHandler(error, req as any, res as any, vi.fn());
  return { req, res };
}

describe('uncaughtErrorHandler logging levels', () => {
  it('logs expected user-facing 400s at debug only', async () => {
    const { res } = await handleError(new UserFacingError('Invalid SOQL'));

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.log.debug).toHaveBeenCalledWith(expect.objectContaining({ error: 'Invalid SOQL', statusCode: 400 }), '[RESPONSE][ERROR]');
    expect(res.log.warn).not.toHaveBeenCalled();
    expect(res.log.error).not.toHaveBeenCalled();
  });

  it('logs validation/database 400s at warn', async () => {
    const error = new prismaMocks.PrismaClientKnownRequestError('Unique constraint failed') as Error & { isPrismaError: boolean };
    error.isPrismaError = true;

    const { res } = await handleError(error);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.log.warn).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Unique constraint failed', statusCode: 400 }),
      '[RESPONSE][ERROR][DATABASE]',
    );
    expect(res.log.error).not.toHaveBeenCalled();
  });

  it('logs authentication 401s at warn', async () => {
    const { res } = await handleError(new AuthenticationError('Unauthorized'));

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.log.warn).toHaveBeenCalledWith(expect.objectContaining({ error: 'Unauthorized', statusCode: 401 }), '[RESPONSE][ERROR]');
    expect(res.log.error).not.toHaveBeenCalled();
  });

  it('logs normal 404s at debug only', async () => {
    const { res } = await handleError(new NotFoundError('Route not found'));

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.log.debug).toHaveBeenCalledWith(expect.objectContaining({ error: 'Route not found', statusCode: 404 }), '[RESPONSE][ERROR]');
    expect(res.log.warn).not.toHaveBeenCalled();
    expect(res.log.error).not.toHaveBeenCalled();
  });

  it('logs unknown 500s at error', async () => {
    const { res } = await handleError(new Error('Database unavailable'));

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.log.error).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Database unavailable', statusCode: 500 }),
      '[RESPONSE][ERROR]',
    );
  });

  it('logs fallback errors with the actual computed response status', async () => {
    const error = new Error('Upstream unavailable') as Error & { status: number };
    error.status = 503;

    const { res } = await handleError(error);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.log.error).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Upstream unavailable', statusCode: 503 }),
      '[RESPONSE][ERROR]',
    );
  });
});

function createMockStreamRes() {
  const chunks: string[] = [];
  const res = {
    locals: {
      requestId: 'request-id',
    },
    log: {
      debug: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
    },
    setHeader: vi.fn(),
    status: vi.fn(),
    json: vi.fn(),
    write: vi.fn((data: string) => {
      chunks.push(data);
      return true;
    }),
    end: vi.fn(),
    headersSent: false,
    _chunks: chunks,
  };
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  return res;
}

describe('streamParsedCsvAsJson', () => {
  it('sets JSON content type and streams rows as a data array', async () => {
    const res = createMockStreamRes();
    const stream = new PassThrough({ objectMode: true });
    const done = new Promise<void>((resolve) => res.end.mockImplementation(() => resolve()));

    streamParsedCsvAsJson(res as any, stream);
    stream.write({ Id: '001' });
    stream.write({ Id: '002' });
    stream.end();

    await done;

    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/json; charset=utf-8');
    expect(res._chunks.join('')).toBe('{"data":[{"Id":"001"},{"Id":"002"}]}');
  });

  it('streams an empty data array when there are no rows', async () => {
    const res = createMockStreamRes();
    const stream = new PassThrough({ objectMode: true });
    const done = new Promise<void>((resolve) => res.end.mockImplementation(() => resolve()));

    streamParsedCsvAsJson(res as any, stream);
    stream.end();

    await done;

    expect(res._chunks.join('')).toBe('{"data":[]}');
  });
});
