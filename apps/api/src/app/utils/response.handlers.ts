import { ENV, getExceptionLog, logger, prisma, rollbarServer } from '@jetstream/api-config';
import { ERROR_MESSAGES, HTTP } from '@jetstream/shared/constants';
import { UserProfileServer } from '@jetstream/types';
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
    res.log.warn('Response headers already sent');
    try {
      rollbarServer.warn('Response not handled by sendJson, headers already sent', new Error('headers already sent'), {
        context: `route#sendJson`,
        custom: {
          requestId: res.locals.requestId,
        },
      });
    } catch (ex) {
      res.log.error(getExceptionLog(ex), 'Error sending to Rollbar');
    }
    return;
  }
  res.status(status);
  return res.json({ data: content || {} });
}

export function blockBotHandler(req: express.Request, res: express.Response) {
  res.log.debug('[BLOCKED REQUEST] %s %s');
  res.status(403).send('Forbidden');
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function uncaughtErrorHandler(err: any, req: express.Request, res: express.Response, next: express.NextFunction) {
  try {
    // Logger is not added to the response object in all cases depending on where error is encountered
    const responseLogger = res.log || logger;

    if (res.headersSent) {
      responseLogger.warn('Response headers already sent');
      try {
        rollbarServer.warn('Error not handled by error handler, headers already sent', req, {
          context: `route#errorHandler`,
          custom: {
            ...getExceptionLog(err, true),
            url: req.url,
            params: req.params,
            query: req.query,
            body: req.body,
            userId: (req.user as UserProfileServer)?.id,
            requestId: res.locals.requestId,
          },
        });
      } catch (ex) {
        responseLogger.error(getExceptionLog(ex), 'Error sending to Rollbar');
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

    if (err instanceof UserFacingError) {
      // Attempt to use response code from 3rd party request if we have it available
      const statusCode = err.apiRequestError?.status || 400;
      res.status(statusCode);
      // TODO: should we log 400s? They happen a lot and are not necessarily errors we care about
      responseLogger.debug({ ...getExceptionLog(err), statusCode }, '[RESPONSE][ERROR]');
      return res.json({
        error: true,
        message: err.message,
        data: err.additionalData,
      });
    } else if (err instanceof AuthenticationError) {
      responseLogger.warn({ ...getExceptionLog(err), statusCode: 401 }, '[RESPONSE][ERROR]');
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
      responseLogger.warn({ ...getExceptionLog(err), statusCode: 404 }, '[RESPONSE][ERROR]');
      res.status(404);
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
      rollbarServer.warn('Error not handled by error handler', req, {
        context: `route#errorHandler`,
        custom: {
          ...getExceptionLog(err, true),
          url: req.url,
          params: req.params,
          query: req.query,
          body: req.body,
          userId: (req.user as UserProfileServer)?.id,
          requestId: res.locals.requestId,
        },
      });
    } catch (ex) {
      responseLogger.error(getExceptionLog(ex), 'Error sending to Rollbar');
    }

    const errorMessage = 'There was an error processing the request';
    let status = err.status || 500;
    if (status < 100 || status > 500) {
      status = 500;
    }
    res.status(status);
    responseLogger.warn({ ...getExceptionLog(err), statusCode: 500 }, '[RESPONSE][ERROR]');
    // Return JSON error response for all other scenarios
    return res.json({
      error: errorMessage,
      message: err.message,
      data: err.data,
    });
  } catch (ex) {
    logger.error(getExceptionLog(ex), 'Error in uncaughtErrorHandler');
    res.status(500).json({ error: true, message: 'Internal Server Error' });
  }
}
