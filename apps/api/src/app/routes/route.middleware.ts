import { HTTP } from '@jetstream/shared/constants';
import { decryptString, encryptString, getJsforceOauth2, hexToBase64 } from '@jetstream/shared/node-utils';
import { UserProfileServer } from '@jetstream/types';
import * as express from 'express';
import * as jsforce from 'jsforce';
import { logger } from '../config/logger.config';
import { SalesforceOrg } from '../db/entites/SalesforceOrg';
import { AuthenticationError, NotFoundError, UserFacingError } from '../utils/error-handler';

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
  if (req.user) {
    return next();
  }
  logger.error('[AUTH][UNAUTHORIZED]');
  next(new AuthenticationError('Unauthorized'));
}

export async function addOrgsToLocal(req: express.Request, res: express.Response, next: express.NextFunction) {
  try {
    const uniqueId = (req.get(HTTP.HEADERS.X_SFDC_ID) || req.query[HTTP.HEADERS.X_SFDC_ID]) as string;
    const user = req.user as UserProfileServer;

    if (!uniqueId) {
      return next();
    }

    const org = await SalesforceOrg.findByUniqueId(user.id, uniqueId);

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
