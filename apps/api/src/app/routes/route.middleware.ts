import * as express from 'express';
import { decryptString, hexToBase64, getJsforceOauth2, encryptString } from '@jetstream/shared/node-utils';
import * as jsforce from 'jsforce';
import { UserFacingError, AuthenticationError, NotFoundError } from '../utils/error-handler';
import { UserAuthSession } from '@jetstream/types';
import { dateFromTimestamp } from '@jetstream/shared/utils';
import { HTTP } from '@jetstream/shared/constants';
import * as moment from 'moment';
import { refreshAuthToken, createOrUpdateSession, getUserDetails } from '../services/auth';
import { isNumber } from 'lodash';
import { logger } from '../config/logger.config';
import { SalesforceOrg } from '../db/entites/SalesforceOrg';

export function logRoute(req: express.Request, res: express.Response, next: express.NextFunction) {
  res.locals.path = req.path;
  // logger.info(req.method, req.originalUrl);
  logger.debug('[REQ] %s %s %s', req.method, req.originalUrl, { method: req.method, url: req.originalUrl });
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
    if (!req.session || !req.session.id) {
      logger.info('[AUTH][INVALID SESSION]');
      return next(new AuthenticationError('Unauthorized'));
    }

    const sessionAuth: UserAuthSession = req.session.auth;
    const authExpires = dateFromTimestamp(sessionAuth.userAuth.exp);

    if (moment().isAfter(authExpires)) {
      const authenticationToken = await refreshAuthToken(sessionAuth.refresh_token);
      const userProfile = await getUserDetails(authenticationToken.access_token);
      createOrUpdateSession(req, authenticationToken, userProfile);
    }

    next();
  } catch (ex) {
    logger.error('[AUTH][EXCEPTION]', ex);
    next(new AuthenticationError('Unauthorized'));
  }
}

export async function addOrgsToLocal(req: express.Request, res: express.Response, next: express.NextFunction) {
  try {
    const uniqueId = (req.get(HTTP.HEADERS.X_SFDC_ID) || req.query[HTTP.HEADERS.X_SFDC_ID]) as string;
    const sessionAuth: UserAuthSession = req.session.auth;

    if (!uniqueId) {
      return next();
    }

    const org = await SalesforceOrg.findByUniqueId(sessionAuth.userId, uniqueId);

    if (!org) {
      return next(new UserFacingError('An org was not found with the provided id'));
    }

    const { accessToken: encryptedAccessToken, loginUrl, instanceUrl, apiVersion, orgNamespacePrefix } = org;

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
    res.locals.org = org;
    res.locals.jsforceConn = new jsforce.Connection(connData);

    // Handle org refresh - then remove event listener if refreshed
    const handleRefresh = async (accessToken) => {
      // Refresh event will be fired when renewed access token
      // to store it in your storage for next request
      try {
        org.accessToken = encryptString(`${accessToken} ${refreshToken}`, hexToBase64(process.env.SFDC_CONSUMER_SECRET));
        await org.save();
        logger.info('[ORG][REFRESH] Org refreshed successfully');
      } catch (ex) {
        logger.error('[ORG][REFRESH] Error saving refresh token', ex);
      }
    };

    (res.locals.jsforceConn as jsforce.Connection).on('refresh', handleRefresh);
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
