import { ENV, logger, rollbarServer, telemetryAddUserToAttributes } from '@jetstream/api-config';
import { ApiConnection, getApiRequestFactoryFn } from '@jetstream/salesforce-api';
import { HTTP } from '@jetstream/shared/constants';
import { ensureBoolean } from '@jetstream/shared/utils';
import { ApplicationCookie, UserProfileServer } from '@jetstream/types';
import { AxiosError } from 'axios';
import { addDays, fromUnixTime, getUnixTime } from 'date-fns';
import * as express from 'express';
import { ValidationChain, validationResult } from 'express-validator';
import { isNumber } from 'lodash';
import { v4 as uuid } from 'uuid';
import * as salesforceOrgsDb from '../db/salesforce-org.db';
import { updateUserLastActivity } from '../services/auth0';
import { AuthenticationError, NotFoundError, UserFacingError } from '../utils/error-handler';

export function addContextMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
  res.locals.requestId = uuid();
  next();
}

/**
 * Set's cookie that is used by front-end application
 * @param req
 * @param res
 * @param next
 */
export function setApplicationCookieMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
  const appCookie: ApplicationCookie = {
    serverUrl: ENV.JETSTREAM_SERVER_URL!,
    environment: ENV.ENVIRONMENT as any,
    defaultApiVersion: `v${ENV.SFDC_API_VERSION}`,
    google_appId: ENV.GOOGLE_APP_ID!,
    google_apiKey: ENV.GOOGLE_API_KEY!,
    google_clientId: ENV.GOOGLE_CLIENT_ID!,
  };
  res.cookie(HTTP.COOKIE.JETSTREAM, appCookie, { httpOnly: false, sameSite: 'strict' });
  next();
}

export function logRoute(req: express.Request, res: express.Response, next: express.NextFunction) {
  res.locals.path = req.path;
  const userInfo = req.user ? { username: (req.user as any)?.displayName, userId: (req.user as any)?.user_id } : undefined;
  logger.debug('[REQ] %s %s', req.method, req.originalUrl, {
    method: req.method,
    url: req.originalUrl,
    requestId: res.locals.requestId,
    agent: req.header('User-Agent'),
    ip: req.headers[HTTP.HEADERS.CF_Connecting_IP] || req.headers[HTTP.HEADERS.X_FORWARDED_FOR] || req.connection.remoteAddress,
    country: req.headers[HTTP.HEADERS.CF_IPCountry],
    ...userInfo,
  });
  next();
}

export function validate(validations: ValidationChain[]) {
  return async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    await Promise.all(validations.map((validation) => validation.run(req)));
    const errors = validationResult(req);
    if (errors.isEmpty()) {
      return next();
    }
    return next(new UserFacingError('The provided input is invalid', errors.array()));
  };
}

export function notFoundMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
  const error = new NotFoundError('Route not found');
  next(error);
}

/**
 * Check user agent and block if it does not appear to be a browser
 * @param req
 * @param res
 * @param next
 * @returns
 */
export function blockBotByUserAgentMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
  const userAgent = req.header('User-Agent');
  if (userAgent?.toLocaleLowerCase().includes('python')) {
    logger.debug('[BLOCKED REQUEST][USER AGENT] %s %s', req.method, req.originalUrl, {
      blocked: true,
      method: req.method,
      url: req.originalUrl,
      requestId: res.locals.requestId,
      agent: req.header('User-Agent'),
      referrer: req.get('Referrer'),
      ip: req.headers[HTTP.HEADERS.CF_Connecting_IP] || req.headers[HTTP.HEADERS.X_FORWARDED_FOR] || req.connection.remoteAddress,
      country: req.headers[HTTP.HEADERS.CF_IPCountry],
    });
    return res.status(403).send('Forbidden');
  }
  next();
}

function getActivityExp() {
  return getUnixTime(addDays(new Date(), 1));
}

export async function checkAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (ENV.EXAMPLE_USER_OVERRIDE && ENV.EXAMPLE_USER && req.hostname === 'localhost') {
    req.user = ENV.EXAMPLE_USER;
    return next();
  }
  if (req.user) {
    telemetryAddUserToAttributes(req.user as UserProfileServer);
    try {
      if (!isNumber(req.session.activityExp)) {
        req.session.activityExp = getActivityExp();
      } else if (req.session.activityExp < getUnixTime(new Date())) {
        req.session.activityExp = getActivityExp();
        // Update auth0 with expiration date
        updateUserLastActivity(req.user as UserProfileServer, fromUnixTime(req.session.activityExp))
          .then(() => {
            logger.debug('[AUTH][LAST-ACTIVITY][UPDATED] %s', req.session.activityExp, {
              userId: (req.user as any)?.user_id,
              requestId: res.locals.requestId,
            });
          })
          .catch((err) => {
            // send error to rollbar
            const error: AxiosError = err;
            if (error.response) {
              logger.error('[AUTH][LAST-ACTIVITY][ERROR] %o', error.response.data, {
                userId: (req.user as any)?.user_id,
                requestId: res.locals.requestId,
              });
            } else if (error.request) {
              logger.error('[AUTH][LAST-ACTIVITY][ERROR] %s', error.message || 'An unknown error has occurred.', {
                userId: (req.user as any)?.user_id,
                requestId: res.locals.requestId,
              });
            }
            rollbarServer.error('Error updating Auth0 activityExp', {
              message: err.message,
              stack: err.stack,
              requestId: res.locals.requestId,
            });
          });
      }
    } catch (ex) {
      logger.warn('[AUTH][LAST-ACTIVITY][ERROR] Exception: %s', ex.message, {
        userId: (req.user as any)?.user_id,
        requestId: res.locals.requestId,
      });
    }
    return next();
  }
  logger.error('[AUTH][UNAUTHORIZED] %s %s', req.method, req.originalUrl, {
    blocked: true,
    method: req.method,
    url: req.originalUrl,
    requestId: res.locals.requestId,
    agent: req.header('User-Agent'),
    ip: req.headers[HTTP.HEADERS.CF_Connecting_IP] || req.headers[HTTP.HEADERS.X_FORWARDED_FOR] || req.connection.remoteAddress,
    country: req.headers[HTTP.HEADERS.CF_IPCountry],
  });
  next(new AuthenticationError('Unauthorized'));
}

export async function addOrgsToLocal(req: express.Request, res: express.Response, next: express.NextFunction) {
  try {
    if (req.get(HTTP.HEADERS.X_SFDC_ID) || req.query[HTTP.HEADERS.X_SFDC_ID]) {
      res.locals = res.locals || {};
      const results = await getOrgFromHeaderOrQuery(req, HTTP.HEADERS.X_SFDC_ID, HTTP.HEADERS.X_SFDC_API_VERSION, res.locals.requestId);
      if (results) {
        const { org, jetstreamConn } = results;
        res.locals.org = org;
        res.locals.jetstreamConn = jetstreamConn;
      }
    }
    if (req.get(HTTP.HEADERS.X_SFDC_ID_TARGET) || req.query[HTTP.HEADERS.X_SFDC_ID_TARGET]) {
      res.locals = res.locals || {};
      const results = await getOrgFromHeaderOrQuery(
        req,
        HTTP.HEADERS.X_SFDC_ID_TARGET,
        HTTP.HEADERS.X_SFDC_API_TARGET_VERSION,
        res.locals.requestId
      );
      if (results) {
        if (results) {
          const { org, jetstreamConn } = results;
          res.locals.targetOrg = org;
          res.locals.targetJetstreamConn = jetstreamConn;
        }
      }
    }
  } catch (ex) {
    logger.warn('[INIT-ORG][ERROR] %o', ex, { requestId: res.locals.requestId });
    return next(new UserFacingError('There was an error initializing the connection to Salesforce'));
  }

  next();
}

export function ensureOrgExists(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!res.locals?.jetstreamConn) {
    logger.info('[INIT-ORG][ERROR] An org did not exist on locals', { requestId: res.locals.requestId });
    return next(new UserFacingError('An org is required for this action'));
  }
  next();
}

export function ensureTargetOrgExists(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!res.locals?.targetJetstreamConn) {
    logger.info('[INIT-ORG][ERROR] A target org did not exist on locals', { requestId: res.locals.requestId });
    return next(new UserFacingError('A target org is required for this action'));
  }
  next();
}

/**
 * Get org id from header/query param
 * query org for user
 * add refresh token callback
 * return org
 *
 * @param req
 * @param headerKey
 * @param versionHeaderKey
 */
export async function getOrgFromHeaderOrQuery(req: express.Request, headerKey: string, versionHeaderKey: string, requestId?: string) {
  const uniqueId = (req.get(headerKey) || req.query[headerKey]) as string;
  // TODO: not yet implemented on the front-end
  const apiVersion = (req.get(versionHeaderKey) || req.query[versionHeaderKey]) as string | undefined;
  const includeCallOptions = ensureBoolean(
    req.get(HTTP.HEADERS.X_INCLUDE_CALL_OPTIONS) || (req.query.includeCallOptions as string | undefined)
  );
  const user = req.user as UserProfileServer;

  if (!uniqueId) {
    return;
  }

  return getOrgForRequest(user, uniqueId, apiVersion, includeCallOptions, requestId);
}

export async function getOrgForRequest(
  user: UserProfileServer,
  uniqueId: string,
  apiVersion?: string,
  includeCallOptions?: boolean,
  requestId?: string
) {
  const org = await salesforceOrgsDb.findByUniqueId_UNSAFE(user.id, uniqueId);
  if (!org) {
    throw new UserFacingError('An org was not found with the provided id');
  }

  const { accessToken: encryptedAccessToken, instanceUrl, orgNamespacePrefix, userId, organizationId } = org;
  const [accessToken, refreshToken] = salesforceOrgsDb.decryptAccessToken(encryptedAccessToken);

  apiVersion = apiVersion || org.apiVersion || ENV.SFDC_API_VERSION;
  let callOptions = {
    client: 'jetstream',
  };

  if (orgNamespacePrefix && includeCallOptions) {
    callOptions = { ...callOptions, defaultNamespace: orgNamespacePrefix } as any;
  }

  // Handle org refresh - then remove event listener if refreshed
  const handleRefresh = async (accessToken: string, refreshToken: string) => {
    // Refresh event will be fired when renewed access token
    // to store it in your storage for next request
    try {
      if (!refreshToken) {
        return;
      }
      await salesforceOrgsDb.updateAccessToken_UNSAFE(org, accessToken, refreshToken);
      logger.info('[ORG][REFRESH] Org refreshed successfully', { requestId });
    } catch (ex) {
      logger.error('[ORG][REFRESH] Error saving refresh token', ex, { requestId });
    }
  };

  const jetstreamConn = new ApiConnection(
    {
      apiRequestAdapter: getApiRequestFactoryFn(fetch),
      userId,
      organizationId,
      accessToken,
      apiVersion,
      callOptions,
      instanceUrl,
      refreshToken,
    },
    handleRefresh
  );

  return { org, jetstreamConn };
}
