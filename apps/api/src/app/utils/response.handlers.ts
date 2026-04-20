import { ENV, errorTracker, getExceptionLog, logger, prisma } from '@jetstream/api-config';
import type { Response } from '@jetstream/api-types';
import { AuthError, createCSRFToken, getCookieConfig } from '@jetstream/auth/server';
import { isPrismaError, Prisma, SalesforceOrg, toTypedPrismaError } from '@jetstream/prisma';
import { ERROR_MESSAGES, HTTP } from '@jetstream/shared/constants';
import { getErrorMessage } from '@jetstream/shared/utils';
import { Maybe } from '@jetstream/types';
import { stringifySetCookie } from 'cookie';
import * as express from 'express';
import { Duplex } from 'stream';
import * as salesforceOrgsDb from '../db/salesforce-org.db';
import { clearDeferredTimers, writeDeferredResponse, type DeferredResponseState } from './deferred-response.middleware';
import { AuthenticationError, NotFoundError, UserFacingError } from './error-handler';

export async function healthCheck(_: express.Request, res: express.Response) {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({
      error: false,
      uptime: process.uptime(),
      message: 'Healthy',
    });
  } catch (ex) {
    res.status(500).json({
      error: true,
      success: false,
      uptime: process.uptime(),
      message: `Unhealthy: ${getErrorMessage(ex)}`,
    });
  }
}

export function setCsrfCookie(res: Response) {
  const { csrfToken, cookie: csrfCookie } = createCSRFToken({ secret: ENV.JETSTREAM_AUTH_SECRET });
  const cookieConfig = getCookieConfig(ENV.USE_SECURE_COOKIES);
  res.locals.cookies = res.locals.cookies || {};
  res.locals.cookies[cookieConfig.csrfToken.name] = {
    name: cookieConfig.csrfToken.name,
    value: csrfCookie,
    options: cookieConfig.csrfToken.options,
  };
  return csrfToken;
}

/**
 * Sets all cookies stored in res.locals to actual headers
 * This is centralized here to ensure all cookies are set and to avoid clearing and setting the same cookie
 */
export function setCookieHeaders(res: Response) {
  try {
    Object.values(res.locals?.cookies || {}).forEach(({ name, options, clear, value }) => {
      try {
        if (clear) {
          res.appendHeader('Set-Cookie', stringifySetCookie(name, '', { ...options, expires: new Date(0) }));
          return;
        }
        res.appendHeader('Set-Cookie', stringifySetCookie(name, value, options));
      } catch (ex) {
        logger.error({ ...getExceptionLog(ex) }, 'Error setting cookie: %s', name);
      }
    });
  } catch (ex) {
    logger.error({ ...getExceptionLog(ex) }, 'Error setting cookies');
  }
}

export function redirect(res: Response, url: string, status = 302) {
  setCookieHeaders(res);
  res.redirect(status, url);
}

export function sendHtml(res: Response, html: string, status = 200) {
  setCookieHeaders(res);
  res.status(status);
  res.send(html);
}

export function sendJson<ResponseType = unknown>(res: Response, content?: ResponseType, status = 200) {
  const deferred = res.locals._deferred;

  // Deferred response mode: write body to the existing chunked stream
  if (deferred?.active) {
    const elapsedMs = Date.now() - deferred.startTime;
    res.log.info({ requestId: res.locals.requestId, elapsedMs }, '[DEFERRED][COMPLETE] Deferred response completed successfully');
    writeDeferredResponse(res, { data: content || {} });
    return;
  }

  // Clear the deferred timer on fast responses to avoid holding req/res references for 45s
  if (deferred) {
    clearDeferredTimers(deferred);
  }

  if (res.headersSent) {
    res.log.warn('Response headers already sent');
    try {
      errorTracker.warn('Response not handled by sendJson, headers already sent', new Error('headers already sent'), {
        context: `route#sendJson`,
        requestId: res.locals.requestId,
        status,
      });
    } catch (ex) {
      res.log.error(getExceptionLog(ex), 'Error sending to error tracker');
    }
    return;
  }
  setCookieHeaders(res);
  res.status(status);
  return res.json({ data: content || {} });
}

/**
 * Given a CSV parse stream, stream as JSON to the client
 */
export function streamParsedCsvAsJson(res: express.Response, csvParseStream: Duplex) {
  let isFirstChunk = true;
  const _logger = res.log || logger;

  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  csvParseStream.on('data', (data) => {
    data = JSON.stringify(data);
    if (isFirstChunk) {
      isFirstChunk = false;
      data = `{"data":[${data}`;
    } else {
      data = `,${data}`;
    }
    res.write(data);
  });

  csvParseStream.on('finish', () => {
    res.write(isFirstChunk ? '{"data":[]}' : ']}');
    res.end();
    _logger.debug({ requestId: res.locals.requestId }, 'Finished streaming CSV');
  });

  csvParseStream.on('error', (err) => {
    _logger.warn({ requestId: res.locals.requestId, ...getExceptionLog(err) }, 'Error streaming CSV.');
    if (!res.headersSent) {
      res.status(400).json({ error: true, success: false, message: 'Error streaming CSV' });
    } else {
      res.status(400).end();
    }
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars
export async function uncaughtErrorHandler(err: any, req: express.Request, res: express.Response, next: express.NextFunction) {
  try {
    // Only set cookies if headers haven't been committed yet (e.g., not in deferred mode)
    if (!res.headersSent) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setCookieHeaders(res as any);
    }
    // Logger is not added to the response object in all cases depending on where error is encountered
    const responseLogger = res.log || logger;

    // If org had a connection error, ensure that the database is updated
    // This runs before the headersSent/deferred checks so the DB side effect always happens
    // TODO: what about alternate org?
    if (
      (err.message === ERROR_MESSAGES.SFDC_EXPIRED_TOKEN ||
        err.message === ERROR_MESSAGES.SFDC_EXPIRED_SESSION ||
        err.message === ERROR_MESSAGES.SFDC_EXPIRED_TOKEN_VALIDITY ||
        ERROR_MESSAGES.SFDC_ORG_DOES_NOT_EXIST.test(err.message)) &&
      !!res.locals?.org
    ) {
      try {
        if (!res.headersSent) {
          res.set(HTTP.HEADERS.X_SFDC_ORG_CONNECTION_ERROR, ERROR_MESSAGES.SFDC_EXPIRED_TOKEN);
        }
        const org = res.locals.org as SalesforceOrg;
        await salesforceOrgsDb.updateOrg_UNSAFE(org, { connectionError: ERROR_MESSAGES.SFDC_EXPIRED_TOKEN });
      } catch (ex) {
        responseLogger.warn(getExceptionLog(ex), '[RESPONSE][ERROR UPDATING INVALID ORG]');
      }
    } else if (ERROR_MESSAGES.SFDC_REST_API_NOT_ENABLED.test(err.message) && !!res.locals?.org) {
      try {
        if (!res.headersSent) {
          res.set(HTTP.HEADERS.X_SFDC_ORG_CONNECTION_ERROR, ERROR_MESSAGES.SFDC_REST_API_NOT_ENABLED_MSG);
        }
        const org = res.locals.org as SalesforceOrg;
        await salesforceOrgsDb.updateOrg_UNSAFE(org, { connectionError: ERROR_MESSAGES.SFDC_REST_API_NOT_ENABLED_MSG });
      } catch (ex) {
        responseLogger.warn(getExceptionLog(ex), '[RESPONSE][ERROR UPDATING INVALID ORG]');
      }
    }

    // Deferred response mode: write error body to the existing chunked stream
    // Headers are already committed (200), so error details must go in the body
    const deferred = (res.locals as { _deferred?: DeferredResponseState })?._deferred;
    if (deferred?.active) {
      const elapsedMs = Date.now() - deferred.startTime;
      const errorMessage = err.message || 'An unknown error has occurred';
      responseLogger.error(
        {
          requestId: res.locals.requestId,
          method: req.method,
          url: req.originalUrl,
          elapsedMs,
          errorMessage,
          ...getExceptionLog(err, true),
        },
        '[DEFERRED][ERROR] Deferred response completed with error',
      );

      // Build deferred error body with fields that would normally be sent as headers
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const deferredErrorBody: Record<string, any> = {
        error: true,
        success: false,
        message: errorMessage,
        data:
          err instanceof UserFacingError || err instanceof AuthenticationError || err instanceof NotFoundError
            ? err.additionalData
            : undefined,
      };

      // Include org connection error info that would normally be sent via X-SFDC-ORG-CONNECTION-ERROR header
      if (
        err.message === ERROR_MESSAGES.SFDC_EXPIRED_TOKEN ||
        err.message === ERROR_MESSAGES.SFDC_EXPIRED_SESSION ||
        err.message === ERROR_MESSAGES.SFDC_EXPIRED_TOKEN_VALIDITY ||
        ERROR_MESSAGES.SFDC_ORG_DOES_NOT_EXIST.test(err.message)
      ) {
        deferredErrorBody.orgConnectionError = ERROR_MESSAGES.SFDC_EXPIRED_TOKEN;
      } else if (ERROR_MESSAGES.SFDC_REST_API_NOT_ENABLED.test(err.message)) {
        deferredErrorBody.orgConnectionError = ERROR_MESSAGES.SFDC_REST_API_NOT_ENABLED_MSG;
      }

      // Include auth error type so client can trigger logout if needed
      if (err instanceof AuthenticationError && !err.skipLogout) {
        deferredErrorBody.logout = true;
        let logoutUrl = `${ENV.JETSTREAM_SERVER_URL}/auth/login`;
        if (req.session?.pendingVerification && req.session.pendingVerification.some(({ exp }) => exp > Date.now())) {
          logoutUrl = `${ENV.JETSTREAM_SERVER_URL}/auth/verify?type=${req.session.pendingVerification[0].type}`;
        }
        deferredErrorBody.logoutUrl = logoutUrl;
      } else if (err instanceof AuthError) {
        deferredErrorBody.errorType = err.type;
        deferredErrorBody.logout = true;
        deferredErrorBody.logoutUrl = `${ENV.JETSTREAM_SERVER_URL}/auth/login/?${new URLSearchParams({ error: err.type }).toString()}`;
      }

      writeDeferredResponse(res, deferredErrorBody);
      return;
    }

    // Clear the deferred timer on fast responses to avoid holding req/res references for 45s
    if (deferred) {
      clearDeferredTimers(deferred);
    }

    if (res.headersSent) {
      responseLogger.warn('Response headers already sent');
      try {
        errorTracker.warn('Error not handled by error handler, headers already sent', req, err, {
          context: `route#errorHandler`,
          url: req.url,
          params: req.params,
          query: req.query,
          body: req.body,
          userId: req.session.user?.id,
          requestId: res.locals.requestId,
        });
      } catch (ex) {
        responseLogger.error(getExceptionLog(ex), 'Error sending to error tracker');
      }
      return;
    }

    const isJson = (req.get(HTTP.HEADERS.ACCEPT) || '').includes(HTTP.CONTENT_TYPE.JSON);

    let status = err.status as Maybe<number>;
    if (typeof err?.status === 'number') {
      res.status(err.status);
    }

    if (err instanceof AuthError) {
      res.status(status || 400);
      // These errors are emitted during the authentication process
      responseLogger.warn({ ...getExceptionLog(err, true), type: err.type }, '[RESPONSE][AUTH_ERROR]');
      if (isJson) {
        return res.json({
          error: true,
          success: false,
          errorType: err.type,
          data: {
            error: true,
            success: false,
            errorType: err.type,
            message: err.message,
          },
        });
      }
      const params = new URLSearchParams({ error: err.type }).toString();
      return res.redirect(`${ENV.JETSTREAM_SERVER_URL}/auth/login/?${params}`);
    } else if (err instanceof UserFacingError) {
      // Attempt to use response code from 3rd party request if we have it available
      const statusCode = err.apiRequestError?.status || status || 400;
      res.status(statusCode);
      responseLogger.debug({ ...getExceptionLog(err, true), statusCode }, '[RESPONSE][ERROR]');
      return res.json({
        error: true,
        success: false,
        message: err.message,
        data: err.additionalData,
      });
    } else if (isPrismaError(err)) {
      const message = getPrismaErrorMessage(err);
      responseLogger.warn({ ...getExceptionLog(err), statusCode: 400 }, '[RESPONSE][ERROR][DATABASE]');
      res.status(status || 400);
      return res.json({
        error: true,
        success: false,
        message,
      });
    } else if (err instanceof AuthenticationError) {
      // This error is emitted when a user attempts to make a request that requires authentication, but the user is not logged in
      responseLogger.warn({ ...getExceptionLog(err), statusCode: 401 }, '[RESPONSE][ERROR]');
      res.status(status || 401);
      if (!err.skipLogout) {
        res.set(HTTP.HEADERS.X_LOGOUT, '1');
        let redirectUrl = `${ENV.JETSTREAM_SERVER_URL}/auth/login`;
        if (req.session?.pendingVerification && req.session.pendingVerification.some(({ exp }) => exp > Date.now())) {
          redirectUrl = `${ENV.JETSTREAM_SERVER_URL}/auth/verify?type=${req.session.pendingVerification[0].type}`;
        }
        res.set(HTTP.HEADERS.X_LOGOUT_URL, redirectUrl);
      }
      if (isJson) {
        return res.json({
          error: true,
          success: false,
          message: err.message,
          data: err.additionalData,
        });
      } else {
        const params = new URLSearchParams({
          error: `Your session is invalid or expired, please login again. Error code: ${err.message}`,
        }).toString();
        return res.redirect(`/?${params}`); // TODO: can we show an error message to the user on this page or redirect to alternate page?
      }
    } else if (err instanceof NotFoundError) {
      responseLogger.debug({ ...getExceptionLog(err), statusCode: 404 }, '[RESPONSE][ERROR]');
      res.status(status || 404);
      if (isJson) {
        return res.json({
          error: true,
          success: false,
          message: err.message,
          data: err.additionalData,
        });
      }
      // Serve the landing 404 page inline with a real 404 status so the URL stays
      // visible in the access log (previously a 302 → /404/ redirect masked it).
      const notFoundHtml = req.app.locals.notFoundHtml as string | null | undefined;
      res.setHeader('Cache-Control', 'no-store');
      if (notFoundHtml) {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.send(notFoundHtml);
      }
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      return res.send('404');
    }

    const errorMessage = 'There was an error processing the request';
    if (!status || status < 100 || status > 599) {
      status = 500;
    }
    res.status(status);
    responseLogger.error({ ...getExceptionLog(err, true), statusCode: status }, '[RESPONSE][ERROR]');
    // Return JSON error response for all other scenarios
    return res.json({
      error: errorMessage,
      message: err.message,
      data: err.data,
    });
  } catch (ex) {
    try {
      errorTracker.warn('Exception in error handler', req, ex, {
        context: `route#errorHandler`,
        originalError: getExceptionLog(err, true),
        url: req.url,
        params: req.params,
        query: req.query,
        body: req.body,
        userId: req.session.user?.id,
        requestId: res.locals.requestId,
      });
    } catch (trackerEx) {
      logger.error(getExceptionLog(trackerEx), 'Error sending to error tracker');
    }
    logger.error(getExceptionLog(ex, true), 'Error in uncaughtErrorHandler');
    res.status(500).json({ error: true, success: false, message: 'Internal Server Error' });
  }
}

function getPrismaErrorMessage(
  error: Prisma.PrismaClientKnownRequestError | Prisma.PrismaClientUnknownRequestError | Prisma.PrismaClientValidationError,
) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const prismaError = toTypedPrismaError(error);
    logger.warn({ error: error.message, code: error.code }, '[DB][PRISMA][WARN]');
    if (prismaError.code === 'P2002') {
      return `A record with the same unique field already exists.`;
    } else if (prismaError.code === 'P2022') {
      return `The requested record is ambiguous.`;
    } else if (prismaError.code === 'P2025') {
      return `The requested record does not exist.`;
    }
  }
  return `An error occurred while processing your request.`;
}
