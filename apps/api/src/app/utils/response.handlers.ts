import { ERROR_MESSAGES, HTTP } from '@jetstream/shared/constants';
import * as express from 'express';
import { logger } from '../config/logger.config';
import { SalesforceOrg } from '../db/entites/SalesforceOrg';
import { AuthenticationError, NotFoundError, UserFacingError } from './error-handler';
import * as querystring from 'querystring';
import { ENV } from '../config/env-config';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function healthCheck(req: express.Request, res: express.Response) {
  return res.status(200).end();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function sendJson(res: express.Response, content?: any, status = 200) {
  content = content || {};
  res.status(status);

  return res.json({ data: content });
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
    ip: req.headers[HTTP.HEADERS.X_FORWARDED_FOR] || req.connection.remoteAddress,
    userInfo,
  });

  const isJson = (req.get(HTTP.HEADERS.ACCEPT) || '').includes(HTTP.CONTENT_TYPE.JSON);

  // If org had a connection error, ensure that the database is updated
  if (err.message === ERROR_MESSAGES.SFDC_EXPIRED_TOKEN && res.locals && !!res.locals.org) {
    try {
      res.set(HTTP.HEADERS.X_SFDC_ORG_CONNECTION_ERROR, ERROR_MESSAGES.SFDC_EXPIRED_TOKEN);
      const org = res.locals.org as SalesforceOrg;
      org.connectionError = ERROR_MESSAGES.SFDC_EXPIRED_TOKEN;
      await org.save();
    } catch (ex) {
      logger.warn('[RESPONSE][ERROR UPDATING INVALID ORG] %s', ex.message, { error: ex.message, userInfo });
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
      const params = querystring.stringify({
        error: `Your session is invalid or expired, please login again. Error code: ${err.message}`,
      });
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
      return res.redirect('/404.html');
    }
  }

  // TODO: clean up everything below this

  logger.warn(err.message, { userInfo });
  logger.error(err.stack, { userInfo });

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
