import { HTTP } from '@jetstream/shared/constants';
import { decryptString, encryptString, hexToBase64 } from '@jetstream/shared/node-utils';
import { UserProfileServer } from '@jetstream/types';
import * as express from 'express';
import { ValidationChain, validationResult } from 'express-validator';
import * as jsforce from 'jsforce';
import { ENV } from '../config/env-config';
import { logger } from '../config/logger.config';
import { SalesforceOrg } from '../db/entites/SalesforceOrg';
import { getJsforceOauth2 } from '../utils/auth-utils';
import { AuthenticationError, NotFoundError, UserFacingError } from '../utils/error-handler';

export function logRoute(req: express.Request, res: express.Response, next: express.NextFunction) {
  res.locals.path = req.path;
  // logger.info(req.method, req.originalUrl);
  const userInfo = req.user ? { username: (req.user as any)?.displayName, userId: (req.user as any)?.user_id } : undefined;
  logger.debug('[REQ] %s %s %s', req.method, req.originalUrl, {
    method: req.method,
    url: req.originalUrl,
    ip: req.headers[HTTP.HEADERS.X_FORWARDED_FOR] || req.connection.remoteAddress,
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

export async function checkAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (req.user) {
    return next();
  }
  logger.error('[AUTH][UNAUTHORIZED]');
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
async function getOrgFromHeaderOrQuery(req: express.Request, headerKey: string, versionHeaderKey: string) {
  const uniqueId = (req.get(headerKey) || req.query[headerKey]) as string;
  // TODO: not yet implemented on the front-end
  const apiVersion = (req.get(versionHeaderKey) || req.query[versionHeaderKey]) as string | undefined;
  const user = req.user as UserProfileServer;

  if (!uniqueId) {
    return;
  }

  const org = await SalesforceOrg.findByUniqueId(user.id, uniqueId);
  if (!org) {
    throw new UserFacingError('An org was not found with the provided id');
  }

  const { accessToken: encryptedAccessToken, loginUrl, instanceUrl, orgNamespacePrefix } = org;
  const [accessToken, refreshToken] = decryptString(encryptedAccessToken, hexToBase64(ENV.SFDC_CONSUMER_SECRET)).split(' ');

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

  if (orgNamespacePrefix) {
    connData.callOptions = { ...connData.callOptions, defaultNamespace: orgNamespacePrefix };
  }

  const conn = new jsforce.Connection(connData);

  // Handle org refresh - then remove event listener if refreshed
  const handleRefresh = async (accessToken, res) => {
    // Refresh event will be fired when renewed access token
    // to store it in your storage for next request
    try {
      org.accessToken = encryptString(`${accessToken} ${conn.refreshToken}`, hexToBase64(ENV.SFDC_CONSUMER_SECRET));
      await org.save();
      logger.info('[ORG][REFRESH] Org refreshed successfully');
    } catch (ex) {
      logger.error('[ORG][REFRESH] Error saving refresh token', ex);
    }
  };

  conn.on('refresh', handleRefresh);

  return { org, connection: conn };
}
