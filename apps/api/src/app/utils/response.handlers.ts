import { ENV, getExceptionLog, logger, prisma, sentryServer } from '@jetstream/api-config';
import { AuthError, createCSRFToken, getCookieConfig } from '@jetstream/auth/server';
import { ERROR_MESSAGES, HTTP } from '@jetstream/shared/constants';
import { Maybe } from '@jetstream/types';
import { SalesforceOrg } from '@prisma/client';
import { serialize } from 'cookie';
import * as express from 'express';
import { Duplex } from 'stream';
import * as salesforceOrgsDb from '../db/salesforce-org.db';
import { Response } from '../types/types';
import { AuthenticationError, NotFoundError, UserFacingError } from './error-handler';

export async function healthCheck(req: express.Request, res: express.Response) {
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
      uptime: process.uptime(),
      message: `Unhealthy: ${ex.message}`,
    });
  }
}

export async function setCsrfCookie(res: Response) {
  const { csrfToken, cookie: csrfCookie } = await createCSRFToken({ secret: ENV.JETSTREAM_AUTH_SECRET });
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
function setCookieHeaders(res: Response) {
  try {
    Object.values(res.locals?.cookies || {}).forEach(({ name, options, clear, value }) => {
      try {
        if (clear) {
          res.appendHeader('Set-Cookie', serialize(name, '', { ...options, expires: new Date(0) }));
          return;
        }
        res.appendHeader('Set-Cookie', serialize(name, value, options));
      } catch (ex) {
        logger.error({ ...getExceptionLog(ex) }, 'Error setting cookie: %s', name);
      }
    });
  } catch (ex) {
    logger.error({ ...getExceptionLog(ex) }, 'Error setting cookies');
  }
}

export function redirect(res: Response, url, status = 302) {
  setCookieHeaders(res);
  res.redirect(status, url);
}

export function sendHtml(res: Response, html: string, status = 200) {
  setCookieHeaders(res);
  res.status(status);
  res.send(html);
}

export function sendJson<ResponseType = unknown>(res: Response, content?: ResponseType, status = 200) {
  if (res.headersSent) {
    res.log.warn('Response headers already sent');
    try {
      sentryServer.captureException(new Error('headers already sent'), {
        tags: {
          requestId: res.locals.requestId,
        },
        extra: {
          message: 'Response not handled by sendJson, headers already sent',
          location: `route#sendJson`,
        },
      });
    } catch (ex) {
      res.log.error(getExceptionLog(ex), 'Error sending to Sentry');
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
    res.write(']}');
    res.end();
    res.log.info({ requestId: res.locals.requestId }, 'Finished streaming CSV');
  });

  csvParseStream.on('error', (err) => {
    res.log.warn({ requestId: res.locals.requestId, ...getExceptionLog(err) }, 'Error streaming CSV.');
    if (!res.headersSent) {
      res.status(400).json({ error: true, message: 'Error streaming CSV' });
    } else {
      res.status(400).end();
    }
  });
}

export function blockBotHandler(req: express.Request, res: express.Response) {
  res.log.debug('[BLOCKED REQUEST]');
  res.status(403).send('Forbidden');
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars
export async function uncaughtErrorHandler(err: any, req: express.Request, res: express.Response, next: express.NextFunction) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setCookieHeaders(res as any);
    // Logger is not added to the response object in all cases depending on where error is encountered
    const responseLogger = res.log || logger;

    if (res.headersSent) {
      responseLogger.warn('Response headers already sent');
      try {
        sentryServer.captureException(new Error('headers already sent'), {
          user: {
            id: req.session.user?.id,
            email: req.session.user?.email,
            name: req.session.user?.name,
          },
          tags: {
            requestId: res.locals.requestId,
          },
          extra: {
            message: 'Response not handled by sendJson, headers already sent',
            location: `route#sendJson`,
            url: req.url,
            params: req.params,
            query: req.query,
          },
        });
      } catch (ex) {
        responseLogger.error(getExceptionLog(ex), 'Error sending to Sentry');
      }
      return;
    }

    const isJson = (req.get(HTTP.HEADERS.ACCEPT) || '').includes(HTTP.CONTENT_TYPE.JSON);

    let status = err.status as Maybe<number>;
    if (typeof err?.status === 'number') {
      res.status(err.status);
    }

    // If org had a connection error, ensure that the database is updated
    // TODO: what about alternate org?
    if (
      (err.message === ERROR_MESSAGES.SFDC_EXPIRED_TOKEN ||
        err.message === ERROR_MESSAGES.SFDC_EXPIRED_TOKEN_VALIDITY ||
        ERROR_MESSAGES.SFDC_ORG_DOES_NOT_EXIST.test(err.message)) &&
      !!res.locals?.org
    ) {
      try {
        res.set(HTTP.HEADERS.X_SFDC_ORG_CONNECTION_ERROR, ERROR_MESSAGES.SFDC_EXPIRED_TOKEN);
        const org = res.locals.org as SalesforceOrg;
        await salesforceOrgsDb.updateOrg_UNSAFE(org, { connectionError: ERROR_MESSAGES.SFDC_EXPIRED_TOKEN });
      } catch (ex) {
        responseLogger.warn(getExceptionLog(ex), '[RESPONSE][ERROR UPDATING INVALID ORG');
      }
    } else if (ERROR_MESSAGES.SFDC_REST_API_NOT_ENABLED.test(err.message) && !!res.locals?.org) {
      try {
        res.set(HTTP.HEADERS.X_SFDC_ORG_CONNECTION_ERROR, ERROR_MESSAGES.SFDC_REST_API_NOT_ENABLED_MSG);
        const org = res.locals.org as SalesforceOrg;
        await salesforceOrgsDb.updateOrg_UNSAFE(org, { connectionError: ERROR_MESSAGES.SFDC_REST_API_NOT_ENABLED_MSG });
      } catch (ex) {
        responseLogger.warn(getExceptionLog(ex), '[RESPONSE][ERROR UPDATING INVALID ORG');
      }
    }

    if (err instanceof AuthError) {
      res.status(status || 400);
      // These errors are emitted during the authentication process
      responseLogger.warn({ ...getExceptionLog(err, true), type: err.type }, '[RESPONSE][AUTH_ERROR]');
      if (isJson) {
        return res.json({
          error: true,
          errorType: err.type,
          data: {
            error: true,
            errorType: err.type,
          },
        });
      }
      const params = new URLSearchParams({ error: err.type }).toString();
      return res.redirect(`${ENV.JETSTREAM_SERVER_URL}/auth/login/?${params}`);
    } else if (err instanceof UserFacingError) {
      // Attempt to use response code from 3rd party request if we have it available
      const statusCode = err.apiRequestError?.status || status || 400;
      res.status(statusCode);
      // TODO: should we log 400s? They happen a lot and are not necessarily errors we care about
      responseLogger.debug({ ...getExceptionLog(err, true), statusCode }, '[RESPONSE][ERROR]');
      return res.json({
        error: true,
        message: err.message,
        data: err.additionalData,
      });
    } else if (err instanceof AuthenticationError) {
      // This error is emitted when a user attempts to make a request taht requires authentication, but the user is not logged in
      responseLogger.warn({ ...getExceptionLog(err), statusCode: 401 }, '[RESPONSE][ERROR]');
      res.status(status || 401);
      res.set(HTTP.HEADERS.X_LOGOUT, '1');
      let redirectUrl = `${ENV.JETSTREAM_SERVER_URL}/auth/login`;
      if (req.session?.pendingVerification && req.session.pendingVerification.some(({ exp }) => exp > Date.now())) {
        redirectUrl = `${ENV.JETSTREAM_SERVER_URL}/auth/verify?type=${req.session.pendingVerification[0].type}`;
      }
      res.set(HTTP.HEADERS.X_LOGOUT_URL, redirectUrl);
      if (isJson) {
        return res.json({
          error: true,
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
      responseLogger.warn({ ...getExceptionLog(err), statusCode: 404 }, '[RESPONSE][ERROR]');
      res.status(status || 404);
      if (isJson) {
        return res.json({
          error: true,
          message: err.message,
          data: err.additionalData,
        });
      } else {
        if (req.hostname === 'localhost') {
          return res.send('404');
        }
        return res.redirect('/404/');
      }
    }

    try {
      sentryServer.captureException(new Error('headers already sent'), {
        user: {
          id: req.session.user?.id,
          email: req.session.user?.email,
          name: req.session.user?.name,
        },
        tags: {
          requestId: res.locals.requestId,
        },
        extra: {
          message: 'Error not handled by ErrorHandler',
          location: `route#errorHandler`,
          url: req.url,
          params: req.params,
          query: req.query,
        },
      });
    } catch (ex) {
      responseLogger.error(getExceptionLog(ex), 'Error sending to Sentry');
    }

    const errorMessage = 'There was an error processing the request';
    if (!status || status < 100 || status > 500) {
      status = 500;
    }
    res.status(status);
    responseLogger.warn({ ...getExceptionLog(err, true), statusCode: 500 }, '[RESPONSE][ERROR]');
    // Return JSON error response for all other scenarios
    return res.json({
      error: errorMessage,
      message: err.message,
      data: err.data,
    });
  } catch (ex) {
    logger.error(getExceptionLog(ex, true), 'Error in uncaughtErrorHandler');
    res.status(500).json({ error: true, message: 'Internal Server Error' });
  }
}
