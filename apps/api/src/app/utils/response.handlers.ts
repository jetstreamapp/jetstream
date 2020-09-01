import * as express from 'express';
import { UserFacingError, AuthenticationError, NotFoundError } from './error-handler';
import { getLoginUrl, getLogoutUrl } from '../services/auth';
import { HTTP, ERROR_MESSAGES } from '@jetstream/shared/constants';
import { logger } from '../config/logger.config';
import { SalesforceOrg } from '../db/entites/SalesforceOrg';

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
  logger.info('[RESPONSE][ERROR] %s', err.message, { error: err.message || err });
  const isJson = (req.get(HTTP.HEADERS.ACCEPT) || '').includes(HTTP.CONTENT_TYPE.JSON);

  // If org had a connection error, ensure that the database is updated
  if (err.message === ERROR_MESSAGES.SFDC_EXPIRED_TOKEN && res.locals && !!res.locals.org) {
    try {
      res.set(HTTP.HEADERS.X_SFDC_ORG_CONNECTION_ERROR, ERROR_MESSAGES.SFDC_EXPIRED_TOKEN);
      const org = res.locals.org as SalesforceOrg;
      org.connectionError = ERROR_MESSAGES.SFDC_EXPIRED_TOKEN;
      await org.save();
    } catch (ex) {
      logger.info('[RESPONSE][ERROR UPDATING INVALID ORG] %s', ex.message, { error: ex.message });
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
    res.set(HTTP.HEADERS.X_LOGOUT_URL, getLogoutUrl());
    if (isJson) {
      return res.json({
        error: true,
        message: err.message,
        data: err.additionalData,
      });
    } else {
      return res.redirect('/oauth/login'); // TODO: can we show an error message to the user on this page or redirect to alternate page?
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

  logger.info(err.message);
  logger.error(err.stack);

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
