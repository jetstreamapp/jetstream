import * as express from 'express';
import Router from 'express-promise-router';
import type * as http from 'http';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { monkeyPatchOrgsToRequest, checkAuth, ensureOrgExists, getOrgFromHeaderOrQuery } from './route.middleware';
import * as jsforce from 'jsforce';
import { HTTP } from '@jetstream/shared/constants';

const routes: express.Router = Router();

// routes.use(checkAuth);
// routes.use(monkeyPatchOrgsToRequest);

// routes.use(
//   '/',
//   createProxyMiddleware({
//     // target: 'http://localhost:3333',
//     router: async (req) => {
//       const result = await getOrgFromHeaderOrQuery(req, HTTP.HEADERS.X_SFDC_ID, HTTP.HEADERS.X_SFDC_API_VERSION);
//       if (!result) {
//         throw new Error('A valid salesforce org must be included with the request');
//       }
//       const conn: jsforce.Connection = (req as any).locals.jsforceConn;
//       return conn.instanceUrl;
//     },
//     // router: {
//     //   '': '',
//     // },
//     pathRewrite: { '^/platform-event': '/cometd/v52.0' }, // TODO: version needs to be dynamic
//     onProxyReq: (proxyReq: http.ClientRequest, req: http.IncomingMessage, res: http.ServerResponse, options) => {
//       // req.user & res.locals to get data that we need to add to request
//       const conn: jsforce.Connection = (res as any).locals.jsforceConn;
//       options.headers['Authorization'] = `Bearer ${conn.accessToken}`;
//       console.log('MIDDLEWARE');
//     },
//   })
// );

export default routes;
