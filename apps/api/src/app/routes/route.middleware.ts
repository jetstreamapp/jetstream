import * as express from 'express';
import { decryptString, hexToBase64, getJsforceOauth2 } from '@jetstream/shared/node-utils';
import * as jsforce from 'jsforce';
import { UserFacingError, AuthenticationError, NotFoundError } from '../utils/error-handler';
import { UserAuthSession } from '@jetstream/types';
import { dateFromTimestamp } from '@jetstream/shared/utils';
import { HTTP } from '@jetstream/shared/constants';
import * as moment from 'moment';
import { refreshAuthToken, createOrUpdateSession } from '../services/auth';
import { isNumber } from 'lodash';
import { logger } from '../config/logger.config';

export function logRoute(req: express.Request, res: express.Response, next: express.NextFunction) {
  res.locals.path = req.path;
  // logger.info(req.method, req.originalUrl);
  logger.info('[REQ]', req.method, req.originalUrl);
  next();
}

export function notFoundMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
  const error = new NotFoundError('Route not found');
  next(error);
}

export async function checkAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  /**
   * 1. ensure auth token exists
   * 2. check expiration of token, and if required refresh token
   */

  try {
    if (!req.session || !req.session.id || !isNumber(req.session.auth?.user?.exp)) {
      logger.info('[AUTH][INVALID SESSION]');
      return next(new AuthenticationError('Unauthorized'));
    }

    const sessionAuth: UserAuthSession = req.session.auth;
    const fusionAuthExpires = dateFromTimestamp(sessionAuth.user.exp);

    if (moment().isAfter(fusionAuthExpires)) {
      const accessToken = await refreshAuthToken(sessionAuth.refresh_token);
      createOrUpdateSession(req, accessToken);
    }

    next();
  } catch (ex) {
    logger.error('[AUTH][EXCEPTION]', ex);
    next(new AuthenticationError('Unauthorized'));
  }
}

export function addOrgsToLocal(req: express.Request, res: express.Response, next: express.NextFunction) {
  try {
    let loginUrl: string;
    let instanceUrl: string;
    let encryptedAccessToken: string;
    let apiVersion: string;
    let orgNamespacePrefix: string;

    if (req.get(HTTP.HEADERS.X_SFDC_ID)) {
      // orgs in header (default path)

      loginUrl = req.get(HTTP.HEADERS.X_SFDC_LOGIN_URL);
      instanceUrl = req.get(HTTP.HEADERS.X_SFDC_INSTANCE_URL);
      encryptedAccessToken = req.get(HTTP.HEADERS.X_SFDC_ACCESS_TOKEN);
      apiVersion = req.get(HTTP.HEADERS.X_SFDC_API_VER);
      orgNamespacePrefix = req.get(HTTP.HEADERS.X_SFDC_NAMESPACE_PREFIX);
    } else if (req.query[HTTP.HEADERS.X_SFDC_ID]) {
      // orgs in query string (alternative path)

      loginUrl = req.query[HTTP.HEADERS.X_SFDC_LOGIN_URL] as string;
      instanceUrl = req.query[HTTP.HEADERS.X_SFDC_INSTANCE_URL] as string;
      encryptedAccessToken = req.query[HTTP.HEADERS.X_SFDC_ACCESS_TOKEN] as string;
      apiVersion = req.query[HTTP.HEADERS.X_SFDC_API_VER] as string;
      orgNamespacePrefix = req.query[HTTP.HEADERS.X_SFDC_NAMESPACE_PREFIX] as string;
    } else {
      return next();
    }

    if (loginUrl) {
      const [accessToken, refreshToken] = decryptString(encryptedAccessToken, hexToBase64(process.env.SFDC_CONSUMER_SECRET)).split(' ');

      const connData: jsforce.ConnectionOptions = {
        oauth2: getJsforceOauth2(loginUrl),
        instanceUrl,
        accessToken,
        refreshToken,
        maxRequest: 5,
        version: apiVersion || undefined,
      };

      if (orgNamespacePrefix) {
        connData.callOptions = { ...connData.callOptions, defaultNamespace: orgNamespacePrefix };
      }

      res.locals = res.locals || {};
      res.locals.jsforceConn = new jsforce.Connection(connData);
    }
  } catch (ex) {
    logger.info('[INIT-ORG][ERROR]', ex);
    return next(new UserFacingError('There was an error initializing the connection to Salesforce'));
  }

  next();
}

export function ensureOrgExists(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!res.locals?.jsforceConn) {
    logger.info('[INIT-ORG][ERROR]', 'An org did not exist on locals');
    return next(new UserFacingError('An org is required for this action'));
  }
  next();
}
