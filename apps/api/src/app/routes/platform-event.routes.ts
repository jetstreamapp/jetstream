import { ENV, logger } from '@jetstream/api-config';
import { HTTP } from '@jetstream/shared/constants';
import * as express from 'express';
import Router from 'express-promise-router';
import type * as http from 'http';
import { createProxyMiddleware } from 'http-proxy-middleware';
import * as jsforce from 'jsforce';
import { Url } from 'url';
import { getOrgFromHeaderOrQuery } from './route.middleware';

const routes: express.Router = Router();

routes.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  next();
});

/**
 * All requests are proxied to Salesforce based on the org mentioned in the URL
 *
 */
routes.use(
  '/',
  createProxyMiddleware({
    logLevel: 'debug',
    onError: (err: Error, req: http.IncomingMessage, res: http.ServerResponse, target?: string | Partial<Url>) => {
      logger.warn('[PROXY][ERROR]! %s', err.message, { target });
    },
    //TODO: make sure that if we throw here the world does not blow up (ensure server does not freeze)
    router: async (req) => {
      const result = await getOrgFromHeaderOrQuery(req, HTTP.HEADERS.X_SFDC_ID, HTTP.HEADERS.X_SFDC_API_VERSION);
      if (!result) {
        throw new Error('A valid salesforce org must be included with the request');
      }
      (req as any).locals = {
        jsforceConn: result.connection,
      };
      return result.connection.instanceUrl;
    },
    pathRewrite: {
      '^/platform-event': `/cometd/${ENV.SFDC_FALLBACK_API_VERSION}`,
    },
    secure: false, // required or else SSL certificate validation will fail
    cookiePathRewrite: {
      // Required for browser to include cookie with request
      '/cometd/': '/platform-event',
    },
    onProxyReq: (proxyReq: http.ClientRequest, req: http.IncomingMessage, res: http.ServerResponse, options) => {
      try {
        const conn: jsforce.Connection = (req as any).locals.jsforceConn;
        proxyReq.setHeader('Authorization', `Bearer ${conn.accessToken}`);
        // not sure if this one is required
        res.setHeader('Access-Control-Allow-Credentials', 'true');
      } catch (ex) {
        logger.error('[PROXY][EXCEPTION] %s', ex.message);
      }
    },
  })
);

export default routes;
