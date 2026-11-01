import { AuthError, ProviderNotAllowed, StepUpAuthRequiredError } from '@jetstream/auth/server';
import { ApiRequestError } from '@jetstream/salesforce-api';
import { ERROR_MESSAGES, HTTP } from '@jetstream/shared/constants';
import { PassThrough, Writable } from 'node:stream';
import { describe, expect, it, vi } from 'vitest';
import * as salesforceOrgsDb from '../../db/salesforce-org.db';
import { AuthenticationError, NotFoundError, UserFacingError } from '../error-handler';
import { pipeWebStreamToResponse, streamParsedCsvAsJson, uncaughtErrorHandler } from '../response.handlers';

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

vi.mock('@jetstream/auth/server', () => {
  class AuthError extends Error {
    type = 'auth_error';
  }

  // Mirrors the real class: extends AuthError, so the handler's AuthError branch claims it first.
  class ProviderNotAllowed extends AuthError {
    override type = 'ProviderNotAllowed';
    attemptedMethod?: string;
    allowedMethods?: string[];

    constructor(message?: string, options?: { attemptedMethod?: string; allowedMethods?: string[] }) {
      super(message);
      this.attemptedMethod = options?.attemptedMethod;
      this.allowedMethods = options?.allowedMethods;
    }
  }

  return {
    AuthError,
    ProviderNotAllowed,
    // Mirrors the real class: extends Error, NOT AuthError. See the "step-up" describe block below.
    StepUpAuthRequiredError: class StepUpAuthRequiredError extends Error {
      status = 403;
      errorType = 'STEP_UP_AUTH_REQUIRED';
    },
    createCSRFToken: vi.fn(),
    getCookieConfig: vi.fn(),
  };
});

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

function createMockReq(accept = 'application/json') {
  return {
    get: vi.fn(() => accept),
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

async function handleError(error: unknown, locals?: Record<string, unknown>, accept?: string) {
  const req = createMockReq(accept);
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
    const error = new prismaMocks.PrismaClientKnownRequestError('Unique constraint failed') as unknown as Error & {
      isPrismaError: boolean;
    };
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

  /**
   * The load-bearing contract for step-up re-authentication: this response must prompt the user to
   * verify, NOT sign them out. The AuthError branch redirects non-JSON requests to the login page
   * and AuthenticationError sets X-AUTH-LOGOUT, which the client honours unconditionally - so this
   * error is deliberately neither, and must be handled before both.
   */
  it('returns a 403 step-up prompt without logging the user out', async () => {
    const { res } = await handleError(new StepUpAuthRequiredError('Please verify your identity to continue'));

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: true,
        errorType: 'STEP_UP_AUTH_REQUIRED',
        message: 'Please verify your identity to continue',
      }),
    );
    // Neither of the two ways this handler can end a session may fire.
    expect(res.set).not.toHaveBeenCalledWith(HTTP.HEADERS.X_LOGOUT, expect.anything());
    expect(res.set).not.toHaveBeenCalledWith(HTTP.HEADERS.X_LOGOUT_URL, expect.anything());
    expect(res.redirect).not.toHaveBeenCalled();
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

/**
 * The sign in screen cannot name the methods a team permits on its own, so ProviderNotAllowed is the
 * one auth error whose details have to survive the trip to the client - as JSON for the app and as
 * query params for the browser redirect. Every other auth error maps to static copy.
 */
describe('uncaughtErrorHandler auth error login method details', () => {
  const providerNotAllowed = () =>
    new ProviderNotAllowed('The credentials provider is not allowed for this team', {
      attemptedMethod: 'credentials',
      allowedMethods: ['google', 'sso'],
    });

  it('includes the attempted and allowed methods in the JSON response', async () => {
    const { res } = await handleError(providerNotAllowed());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        errorType: 'ProviderNotAllowed',
        data: expect.objectContaining({
          errorType: 'ProviderNotAllowed',
          attemptedMethod: 'credentials',
          allowedMethods: ['google', 'sso'],
        }),
      }),
    );
  });

  it('carries the attempted and allowed methods through the login redirect', async () => {
    const { res } = await handleError(providerNotAllowed(), undefined, 'text/html');

    expect(res.redirect).toHaveBeenCalledWith(
      'https://getjetstream.app/auth/login/?error=ProviderNotAllowed&allowedMethods=google%2Csso&attemptedMethod=credentials',
    );
  });

  it('omits the details when the team permits no methods at all', async () => {
    // An empty allowed list would render as an empty query param, leaving the screen with copy it
    // cannot fill in - the generic message for the error type is the better fallback.
    const { res } = await handleError(
      new ProviderNotAllowed('No providers allowed', { attemptedMethod: 'credentials', allowedMethods: [] }),
      undefined,
      'text/html',
    );

    expect(res.redirect).toHaveBeenCalledWith('https://getjetstream.app/auth/login/?error=ProviderNotAllowed');
  });

  it('leaves other auth errors without login method details', async () => {
    const { res } = await handleError(new AuthError('Something else went wrong'));

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.not.objectContaining({ allowedMethods: expect.anything() }),
      }),
    );
  });
});

/**
 * The app's HTTP client only reads the top-level message, so an auth error thrown from an in-app
 * route (e.g. a rejected email change) needs it there to reach the user as anything but a generic error.
 */
describe('uncaughtErrorHandler auth error message', () => {
  it('includes the message at the top level as well as in data', async () => {
    const { res } = await handleError(new AuthError('Disposable email addresses are not supported'));

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Disposable email addresses are not supported',
        data: expect.objectContaining({ message: 'Disposable email addresses are not supported' }),
      }),
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

function createWritableRes() {
  const chunks: Buffer[] = [];
  createMockStreamRes(); // refresh the shared logger mock
  const res = Object.assign(
    new Writable({
      write(chunk, _encoding, callback) {
        res.headersSent = true;
        chunks.push(chunk);
        callback();
      },
    }),
    { headersSent: false, chunks },
  );
  vi.spyOn(res, 'destroy');
  // a destroyed response emits 'error' here; a real ServerResponse hands that to the socket instead
  res.on('error', () => undefined);
  return res;
}

const tick = (ms = 10) => new Promise((resolve) => setTimeout(resolve, ms));

describe('pipeWebStreamToResponse', () => {
  const encoder = new TextEncoder();

  it('streams the source to the response', async () => {
    const res = createWritableRes();
    const next = vi.fn();
    const finished = new Promise((resolve) => res.on('finish', resolve));

    pipeWebStreamToResponse(res as any, new Response('a,b\n1,2\n').body as ReadableStream<Uint8Array>, next);
    await finished;

    expect(Buffer.concat(res.chunks).toString()).toBe('a,b\n1,2\n');
    expect(next).not.toHaveBeenCalled();
  });

  it('destroys the response when the source fails after data was sent', async () => {
    const res = createWritableRes();
    const next = vi.fn();
    const uncaughtExceptionListener = vi.fn();
    process.on('uncaughtException', uncaughtExceptionListener);
    const upstreamError = new Error('ECONNRESET');
    const source = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('a,b\n'));
      },
      async pull(controller) {
        await tick();
        controller.error(upstreamError);
      },
    });

    try {
      pipeWebStreamToResponse(res as any, source, next);
      await vi.waitFor(() => expect(res.destroy).toHaveBeenCalledWith(upstreamError));
    } finally {
      process.off('uncaughtException', uncaughtExceptionListener);
    }

    expect(Buffer.concat(res.chunks).toString()).toBe('a,b\n');
    expect(next).not.toHaveBeenCalled();
    expect(uncaughtExceptionListener).not.toHaveBeenCalled();
  });

  it('passes the error to next when the source fails before anything was sent', async () => {
    const res = createWritableRes();
    const next = vi.fn();
    const source = new ReadableStream<Uint8Array>({
      async pull(controller) {
        await tick();
        controller.error(new Error('Salesforce unavailable'));
      },
    });

    pipeWebStreamToResponse(res as any, source, next);
    await vi.waitFor(() => expect(next).toHaveBeenCalledTimes(1));

    expect(next.mock.calls[0][0]).toBeInstanceOf(UserFacingError);
    expect(next.mock.calls[0][0].message).toBe('Salesforce unavailable');
    expect(res.destroy).not.toHaveBeenCalled();
  });

  it('cancels the source when the client goes away before the download finishes', async () => {
    const res = createWritableRes();
    const onCancel = vi.fn();
    const source = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('a,b\n'));
      },
      async pull() {
        // never produces more data, like a slow upstream
        await new Promise(() => undefined);
      },
      cancel: onCancel,
    });

    pipeWebStreamToResponse(res as any, source, vi.fn());
    await vi.waitFor(() => expect(res.chunks.length).toBe(1));
    res.destroy();

    await vi.waitFor(() => expect(onCancel).toHaveBeenCalled());
  });

  it('cancels the source without piping when the client left before the source was ready', async () => {
    const res = createWritableRes();
    const next = vi.fn();
    const onCancel = vi.fn();
    const source = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('a,b\n'));
      },
      cancel: onCancel,
    });
    res.destroy();

    pipeWebStreamToResponse(res as any, source, next);

    await vi.waitFor(() => expect(onCancel).toHaveBeenCalledWith('client disconnected'));
    expect(res.chunks).toHaveLength(0);
    expect(next).not.toHaveBeenCalled();
  });
});

describe('streamParsedCsvAsJson errors', () => {
  it('destroys the response instead of ending it when parsing fails after rows were written', async () => {
    const res = createMockStreamRes();
    const destroy = vi.fn();
    Object.assign(res, { destroy });
    const stream = new PassThrough({ objectMode: true });
    res.write.mockImplementation((data: string) => {
      res._chunks.push(data);
      res.headersSent = true;
      return true;
    });

    streamParsedCsvAsJson(res as any, stream);
    stream.write({ Id: '001' });
    await tick(0);
    const streamError = new Error('batch 2 failed');
    stream.destroy(streamError);
    await vi.waitFor(() => expect(destroy).toHaveBeenCalledWith(streamError));

    expect(res.end).not.toHaveBeenCalled();
    expect(res._chunks.join('')).toBe('{"data":[{"Id":"001"}');
  });

  it('responds with a 400 when parsing fails before anything was written', async () => {
    const res = createMockStreamRes();
    const stream = new PassThrough({ objectMode: true });

    streamParsedCsvAsJson(res as any, stream);
    stream.destroy(new Error('bad csv'));
    await vi.waitFor(() => expect(res.status).toHaveBeenCalledWith(400));

    expect(res.json).toHaveBeenCalledWith({ error: true, success: false, message: 'Error streaming CSV' });
  });
});
