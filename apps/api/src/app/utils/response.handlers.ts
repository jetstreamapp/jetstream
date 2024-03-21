import { ENV, logger, prisma, rollbarServer } from '@jetstream/api-config';
import { ERROR_MESSAGES, HTTP } from '@jetstream/shared/constants';
import { SalesforceOrg } from '@prisma/client';
import * as express from 'express';
import * as salesforceOrgsDb from '../db/salesforce-org.db';
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

export function sendJson<ResponseType = any>(res: express.Response, content?: ResponseType, status = 200) {
  if (res.headersSent) {
    logger.warn('Response headers already sent', { requestId: res.locals.requestId });
    try {
      rollbarServer.warn('Response not handled by sendJson, headers already sent', new Error('headers already sent'), {
        requestId: res.locals.requestId,
      });
    } catch (ex) {
      logger.error('Error sending to Rollbar', ex, { requestId: res.locals.requestId });
    }
    return;
  }
  res.status(status);
  return res.json({ data: content || {} });
}

export function blockBotHandler(req: express.Request, res: express.Response) {
  logger.debug('[BLOCKED REQUEST] %s %s', req.method, req.originalUrl, {
    blocked: true,
    method: req.method,
    url: req.originalUrl,
    requestId: res.locals.requestId,
    agent: req.header('User-Agent'),
    referrer: req.get('Referrer'),
    ip: req.headers[HTTP.HEADERS.CF_Connecting_IP] || req.headers[HTTP.HEADERS.X_FORWARDED_FOR] || req.connection.remoteAddress,
    country: req.headers[HTTP.HEADERS.CF_IPCountry],
  });
  res.status(403).send('Forbidden');
}

// TODO: implement user facing errors and system facing errors and separate them
// TODO: this should handle ALL errors, and controllers need to throw proper errors!
// eslint-disable-next-line @typescript-eslint/no-explicit-any
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function uncaughtErrorHandler(err: any, req: express.Request, res: express.Response, next: express.NextFunction) {
  const userInfo = req.user ? { username: (req.user as any)?.displayName, userId: (req.user as any)?.user_id } : undefined;
  logger.warn('[RESPONSE][ERROR] %s', err.message, {
    error: err.message || err,
    method: req.method,
    url: req.originalUrl,
    requestId: res.locals.requestId,
    agent: req.header('User-Agent'),
    ip: req.headers[HTTP.HEADERS.CF_Connecting_IP] || req.headers[HTTP.HEADERS.X_FORWARDED_FOR] || req.connection.remoteAddress,
    country: req.headers[HTTP.HEADERS.CF_IPCountry],
    ...userInfo,
  });

  if (res.headersSent) {
    logger.warn('Response headers already sent', { requestId: res.locals.requestId });
    try {
      rollbarServer.warn('Error not handled by error handler, headers already sent', req, userInfo, err, new Error('headers already sent'));
    } catch (ex) {
      logger.error('Error sending to Rollbar', ex, { requestId: res.locals.requestId });
    }
    return;
  }

  const isJson = (req.get(HTTP.HEADERS.ACCEPT) || '').includes(HTTP.CONTENT_TYPE.JSON);

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
      logger.warn('[RESPONSE][ERROR UPDATING INVALID ORG] %s', ex.message, {
        error: ex.message,
        userInfo,
        requestId: res.locals.requestId,
      });
    }
  }

  if (err instanceof UserFacingError) {
    res.status(400);
    return res.json({
      error: true,
      message: err.message,
      data: err.additionalData,
    });
  } else if (err instanceof AuthenticationError) {
    res.status(401);
    res.set(HTTP.HEADERS.X_LOGOUT, '1');
    res.set(HTTP.HEADERS.X_LOGOUT_URL, `${ENV.JETSTREAM_SERVER_URL}/oauth/login`);
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
    res.status(404);
    if (isJson) {
      return res.json({
        error: true,
        message: err.message,
        data: err.additionalData,
      });
    } else {
      // TODO: do something better with localhost
      if (req.hostname === 'localhost') {
        return res.send('404');
      }
      return res.redirect('/404/');
    }
  }

  // TODO: clean up everything below this

  logger.error(err.message, { userInfo, requestId: res.locals.requestId });
  logger.error(err.stack, { userInfo, requestId: res.locals.requestId });

  try {
    rollbarServer.warn('Error not handled by error handler', req, userInfo, err);
  } catch (ex) {
    logger.error('Error sending to Rollbar', ex, { requestId: res.locals.requestId });
  }

  const errorMessage = 'There was an error processing the request';
  let status = err.status || 500;
  if (status < 100 || status > 500) {
    status = 500;
  }
  res.status(status);

  // Return JSON error response for all other scenarios
  return res.json({
    error: errorMessage,
    message: err.message,
    data: err.data,
  });
}
