import { ENV, logger, rollbarServer, telemetryAddUserToAttributes } from '@jetstream/api-config';
import { HTTP } from '@jetstream/shared/constants';
import { ensureBoolean } from '@jetstream/shared/utils';
import { ApplicationCookie, UserProfileServer } from '@jetstream/types';
import { AxiosError } from 'axios';
import { addDays, fromUnixTime, getUnixTime } from 'date-fns';
import * as express from 'express';
import { ValidationChain, validationResult } from 'express-validator';
import * as jsforce from 'jsforce';
import { isNumber } from 'lodash';
import * as salesforceOrgsDb from '../db/salesforce-org.db';
import { updateUserLastActivity } from '../services/auth0';
import { getJsforceOauth2 } from '../utils/auth-utils';
import { AuthenticationError, NotFoundError, UserFacingError } from '../utils/error-handler';

/**
 * Set's cookie that is used by front-end application
 * @param req
 * @param res
 * @param next
 */
export function setApplicationCookieMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
  const appCookie: ApplicationCookie = {
    serverUrl: ENV.JETSTREAM_SERVER_URL,
    environment: ENV.ENVIRONMENT as any,
    defaultApiVersion: `v${ENV.SFDC_FALLBACK_API_VERSION}`,
    google_appId: ENV.GOOGLE_APP_ID,
    google_apiKey: ENV.GOOGLE_API_KEY,
    google_clientId: ENV.GOOGLE_CLIENT_ID,
  };
  res.cookie(HTTP.COOKIE.JETSTREAM, appCookie, { httpOnly: false, sameSite: 'strict' });
  next();
}

export function logRoute(req: express.Request, res: express.Response, next: express.NextFunction) {
  res.locals.path = req.path;
  // logger.info(req.method, req.originalUrl);
  const userInfo = req.user ? { username: (req.user as any)?.displayName, userId: (req.user as any)?.user_id } : undefined;
  logger.debug('[REQ] %s %s', req.method, req.originalUrl, {
    method: req.method,
    url: req.originalUrl,
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
  if (userAgent.toLocaleLowerCase().includes('python')) {
    logger.debug('[BLOCKED REQUEST][USER AGENT] %s %s', req.method, req.originalUrl, {
      blocked: true,
      method: req.method,
      url: req.originalUrl,
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
          .then((response) => {
            logger.debug('[AUTH][LAST-ACTIVITY][UPDATED] %s', req.session.activityExp, { userId: (req.user as any)?.user_id });
          })
          .catch((err) => {
            // send error to rollbar
            const error: AxiosError = err;
            if (error.response) {
              logger.error('[AUTH][LAST-ACTIVITY][ERROR] %o', error.response.data, { userId: (req.user as any)?.user_id });
            } else if (error.request) {
              logger.error('[AUTH][LAST-ACTIVITY][ERROR] %s', error.message || 'An unknown error has occurred.', {
                userId: (req.user as any)?.user_id,
              });
            }
            rollbarServer.error('Error updating Auth0 activityExp', { message: err.message, stack: err.stack });
          });
      }
    } catch (ex) {
      logger.warn('[AUTH][LAST-ACTIVITY][ERROR] Exception: %s', ex.message, { userId: (req.user as any)?.user_id });
    }
    return next();
  }
  logger.error('[AUTH][UNAUTHORIZED] %s %s', req.method, req.originalUrl, {
    blocked: true,
    method: req.method,
    url: req.originalUrl,
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
      const results = await getOrgFromHeaderOrQuery(req, HTTP.HEADERS.X_SFDC_ID, HTTP.HEADERS.X_SFDC_API_VERSION);
      if (results) {
        const { org, connection } = results;
        res.locals.org = org;
        res.locals.jsforceConn = connection;
      }
    }
    if (req.get(HTTP.HEADERS.X_SFDC_ID_TARGET) || req.query[HTTP.HEADERS.X_SFDC_ID_TARGET]) {
      res.locals = res.locals || {};
      const results = await getOrgFromHeaderOrQuery(req, HTTP.HEADERS.X_SFDC_ID_TARGET, HTTP.HEADERS.X_SFDC_API_TARGET_VERSION);
      if (results) {
        if (results) {
          const { org, connection } = results;
          res.locals.targetOrg = org;
          res.locals.targetJsforceConn = connection;
        }
      }
    }
  } catch (ex) {
    logger.warn('[INIT-ORG][ERROR] %o', ex);
    return next(new UserFacingError('There was an error initializing the connection to Salesforce'));
  }

  next();
}

/**
 * Add locals to request object
 */
export async function monkeyPatchOrgsToRequest(req: express.Request, res: express.Response, next: express.NextFunction) {
  try {
    if (req.get(HTTP.HEADERS.X_SFDC_ID) || req.query[HTTP.HEADERS.X_SFDC_ID]) {
      const results = await getOrgFromHeaderOrQuery(req, HTTP.HEADERS.X_SFDC_ID, HTTP.HEADERS.X_SFDC_API_VERSION);
      if (results) {
        const { org, connection } = results;
        res.locals = { org, jsforceConn: connection };
        (req as any).locals = res.locals;
      } else {
        logger.info('[INIT-ORG][ERROR] An org did not exist on locals - Monkey Patch');
        return next(new UserFacingError('An org is required for this action'));
      }
    }
  } catch (ex) {
    logger.warn('[INIT-ORG][ERROR] %o', ex);
    return next(new UserFacingError('There was an error initializing the connection to Salesforce'));
  }

  next();
}

export function ensureOrgExists(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!res.locals?.jsforceConn) {
    logger.info('[INIT-ORG][ERROR] An org did not exist on locals');
    return next(new UserFacingError('An org is required for this action'));
  }
  next();
}

export function ensureTargetOrgExists(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!res.locals?.targetJsforceConn) {
    logger.info('[INIT-ORG][ERROR] A target org did not exist on locals');
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
export async function getOrgFromHeaderOrQuery(req: express.Request, headerKey: string, versionHeaderKey: string) {
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

  return getOrgForRequest(user, uniqueId, apiVersion, includeCallOptions);
}

export async function getOrgForRequest(user: UserProfileServer, uniqueId: string, apiVersion?: string, includeCallOptions?: boolean) {
  const org = await salesforceOrgsDb.findByUniqueId_UNSAFE(user.id, uniqueId);
  if (!org) {
    throw new UserFacingError('An org was not found with the provided id');
  }

  const { accessToken: encryptedAccessToken, loginUrl, instanceUrl, orgNamespacePrefix } = org;
  const [accessToken, refreshToken] = salesforceOrgsDb.decryptAccessToken(encryptedAccessToken);

  const connData: jsforce.ConnectionOptions = {
    oauth2: getJsforceOauth2(loginUrl),
    instanceUrl,
    accessToken,
    refreshToken,
    maxRequest: 5,
    version: apiVersion || org.apiVersion || ENV.SFDC_FALLBACK_API_VERSION,
    callOptions: {
      // Magical metadata shows up when using this
      // http://www.fishofprey.com/2016/03/salesforce-forcecom-ide-superpowers.html
      // FIXME: this breaks some orgs
      // client: `apex_eclipse/v${apiVersion || org.apiVersion || ENV.SFDC_FALLBACK_API_VERSION}`,
    },
  };

  if (orgNamespacePrefix && includeCallOptions) {
    connData.callOptions = { ...connData.callOptions, defaultNamespace: orgNamespacePrefix };
  }

  const conn = new jsforce.Connection(connData);

  // Handle org refresh - then remove event listener if refreshed
  const handleRefresh = async (accessToken, res) => {
    // Refresh event will be fired when renewed access token
    // to store it in your storage for next request
    try {
      await salesforceOrgsDb.updateAccessToken_UNSAFE(org, accessToken, conn.refreshToken);
      logger.info('[ORG][REFRESH] Org refreshed successfully');
    } catch (ex) {
      logger.error('[ORG][REFRESH] Error saving refresh token', ex);
    }
  };

  conn.on('refresh', handleRefresh);

  return { org, connection: conn };
}
