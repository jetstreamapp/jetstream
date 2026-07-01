import { ApiRequestError } from '@jetstream/salesforce-api';
import { ERROR_MESSAGES, HTTP } from '@jetstream/shared/constants';
import { PassThrough } from 'node:stream';
import { describe, expect, it, vi } from 'vitest';
import * as salesforceOrgsDb from '../../db/salesforce-org.db';
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

// Holder so the mocked getLogger() returns the same per-test logger assigned to res.log
// (createMockRes refreshes it each test), keeping the existing res.log.* assertions valid.
const loggerHolder = vi.hoisted(() => ({ current: null as unknown as Record<string, ReturnType<typeof vi.fn>> }));

vi.mock('@jetstream/api-config', () => ({
  ENV: {
    JETSTREAM_SERVER_URL: 'https://getjetstream.app',
  },
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
  getLogger: () => loggerHolder.current,
  prisma: {},
  errorTracker: {
    error: vi.fn(),
    warn: vi.fn(),
    critical: vi.fn(),
    info: vi.fn(),
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
  // Fresh per-test logger, exposed to the code-under-test via the mocked getLogger() holder.
  const log = {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    trace: vi.fn(),
  };
  loggerHolder.current = log;
  const res = {
    headersSent: false,
    locals: {
      cookies: {},
      requestId: 'request-id',
    },
    log,
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

async function handleError(error: unknown, locals?: Record<string, unknown>) {
  const req = createMockReq();
  const res = createMockRes();
  if (locals) {
    Object.assign(res.locals, locals);
  }
  await uncaughtErrorHandler(error, req as any, res as any, vi.fn());
  return { req, res };
}

describe('uncaughtErrorHandler logging levels', () => {
  it('logs expected user-facing 400s at debug only', async () => {
    const { res } = await handleError(new UserFacingError('Invalid SOQL'));

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.log.debug).toHaveBeenCalledWith(
      { err: expect.objectContaining({ message: 'Invalid SOQL' }), res: { statusCode: 400 } },
      '[RESPONSE][ERROR]',
    );
    expect(res.log.warn).not.toHaveBeenCalled();
    expect(res.log.error).not.toHaveBeenCalled();
  });

  it('logs validation/database 400s at warn', async () => {
    const error = new prismaMocks.PrismaClientKnownRequestError('Unique constraint failed') as Error & { isPrismaError: boolean };
    error.isPrismaError = true;

    const { res } = await handleError(error);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.log.warn).toHaveBeenCalledWith(
      { err: expect.objectContaining({ message: 'Unique constraint failed' }), res: { statusCode: 400 } },
      '[RESPONSE][ERROR][DATABASE]',
    );
    expect(res.log.error).not.toHaveBeenCalled();
  });

  it('maps a P2034 serialization conflict to 409', async () => {
    const error = new prismaMocks.PrismaClientKnownRequestError('Write conflict') as Error & { isPrismaError: boolean; code: string };
    error.isPrismaError = true;
    error.code = 'P2034';

    const { res } = await handleError(error);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'This operation conflicted with a concurrent change. Please try again.' }),
    );
  });

  it('logs authentication 401s at warn', async () => {
    const { res } = await handleError(new AuthenticationError('Unauthorized'));

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.log.warn).toHaveBeenCalledWith(
      { err: expect.objectContaining({ message: 'Unauthorized' }), res: { statusCode: 401 } },
      '[RESPONSE][ERROR]',
    );
    expect(res.log.error).not.toHaveBeenCalled();
  });

  it('logs normal 404s at debug only', async () => {
    const { res } = await handleError(new NotFoundError('Route not found'));

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.log.debug).toHaveBeenCalledWith(
      { err: expect.objectContaining({ message: 'Route not found' }), res: { statusCode: 404 } },
      '[RESPONSE][ERROR]',
    );
    expect(res.log.warn).not.toHaveBeenCalled();
    expect(res.log.error).not.toHaveBeenCalled();
  });

  it('logs unknown 500s at error', async () => {
    const { res } = await handleError(new Error('Database unavailable'));

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.log.error).toHaveBeenCalledWith(
      { err: expect.objectContaining({ message: 'Database unavailable' }), res: { statusCode: 500 } },
      '[RESPONSE][ERROR]',
    );
  });

  it('logs fallback errors with the actual computed response status', async () => {
    const error = new Error('Upstream unavailable') as Error & { status: number };
    error.status = 503;

    const { res } = await handleError(error);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.log.error).toHaveBeenCalledWith(
      { err: expect.objectContaining({ message: 'Upstream unavailable' }), res: { statusCode: 503 } },
      '[RESPONSE][ERROR]',
    );
  });
});

describe('uncaughtErrorHandler Salesforce connection error normalization', () => {
  it('normalizes an expired-token error to 401 (and marks the org invalid) even when Salesforce returned a 500', async () => {
    // Mirrors the incident: a SOAP/metadata auth failure whose refresh also fails re-throws with
    // Salesforce's original HTTP 500 (INVALID_SESSION_ID). Left unnormalized, that 500 passes through to
    // the client and trips 5xx alerting, despite being an auth failure.
    const apiRequestError = new ApiRequestError(ERROR_MESSAGES.SFDC_EXPIRED_TOKEN, { status: 500 } as any);
    const { res } = await handleError(new UserFacingError(apiRequestError), { org: { id: 'org-1', uniqueId: 'unique-1' } });

    expect(res.status).toHaveBeenLastCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: ERROR_MESSAGES.SFDC_EXPIRED_TOKEN }));
    // The org is still marked invalid and the client is signaled to prompt a reconnect.
    expect(res.set).toHaveBeenCalledWith(HTTP.HEADERS.X_SFDC_ORG_CONNECTION_ERROR, ERROR_MESSAGES.SFDC_EXPIRED_TOKEN);
    expect(salesforceOrgsDb.updateOrg_UNSAFE).toHaveBeenCalledWith(expect.objectContaining({ id: 'org-1' }), {
      connectionError: ERROR_MESSAGES.SFDC_EXPIRED_TOKEN,
    });
  });

  it('normalizes a "REST API not enabled" error to 403', async () => {
    const apiRequestError = new ApiRequestError('API is not enabled for this Organization or Partner', { status: 500 } as any);
    const { res } = await handleError(new UserFacingError(apiRequestError));

    expect(res.status).toHaveBeenLastCalledWith(403);
  });

  it('normalizes a bare (unwrapped) connection error that reaches the generic handler to 401 instead of 500', async () => {
    const error = new Error(ERROR_MESSAGES.SFDC_EXPIRED_TOKEN) as Error & { status: number };
    error.status = 500;

    const { res } = await handleError(error);

    expect(res.status).toHaveBeenLastCalledWith(401);
  });

  it('still passes through the upstream status for non-connection UserFacingErrors', async () => {
    const apiRequestError = new ApiRequestError('Some other Salesforce error', { status: 404 } as any);
    const { res } = await handleError(new UserFacingError(apiRequestError));

    expect(res.status).toHaveBeenLastCalledWith(404);
  });
});

function createMockStreamRes() {
  const chunks: string[] = [];
  const log = {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    trace: vi.fn(),
  };
  loggerHolder.current = log;
  const res = {
    locals: {
      requestId: 'request-id',
    },
    log,
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
