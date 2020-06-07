import * as express from 'express';
import { decryptString, hexToBase64, getJsforceOauth2 } from '@jetstream/shared/node-utils';
import * as jsforce from 'jsforce';
import { UserFacingError } from '../utils/error-handler';

export function logRoute(req: express.Request, res: express.Response, next: express.NextFunction) {
  res.locals.path = req.path;
  // logger.info(req.method, req.originalUrl);
  console.info('[REQ]', req.method, req.originalUrl);
  next();
}

export function notFoundMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
  const error = new Error('Not Found');
  error['status'] = 404;
  res['message'] = 'Route not found';
  next(error);
}

export function addOrgsToLocal(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (req.get('X-SFDC-ID')) {
    try {
      const loginUrl = req.get('X-SFDC-LOGIN-URL');
      const instanceUrl = req.get('X-SFDC-INSTANCE-URL');
      const encryptedAccessToken = req.get('X-SFDC-ACCESS-TOKEN');
      const apiVersion = req.get('X-SFDC-API-VER');
      const orgNamespacePrefix = req.get('X-SFDC-NAMESPACE-PREFIX');

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
    } catch (ex) {
      console.log('[INIT-ORG][ERROR]', ex);
      return next(new UserFacingError('There was an error initializing the connection to Salesforce'));
    }
  }

  next();
}

export function ensureOrgExists(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!res.locals?.jsforceConn) {
    console.log('[INIT-ORG][ERROR]', 'An org did not exist on locals');
    return next(new UserFacingError('An org is required for this action'));
  }
  next();
}
