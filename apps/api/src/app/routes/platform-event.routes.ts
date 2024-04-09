import { ENV, getExceptionLog, logger } from '@jetstream/api-config';
import { HTTP } from '@jetstream/shared/constants';
import * as express from 'express';
import Router from 'express-promise-router';
import https from 'https';
import { checkAuth, getOrgFromHeaderOrQuery } from './route.middleware';

const routes: express.Router = Router();

routes.use(checkAuth);

routes.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  next();
});

/**
 * Proxy platform event requests to Salesforce
 * We limit the headers we pass along to known working headers
 * The cookie path is re-written to match the proxy path
 * response are streamed back to the client
 */
routes.use('/', async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  try {
    const result = await getOrgFromHeaderOrQuery(req, HTTP.HEADERS.X_SFDC_ID, HTTP.HEADERS.X_SFDC_API_VERSION);
    if (!result) {
      throw new Error('A valid salesforce org must be included with the request');
    }
    const jetstreamConn = result.jetstreamConn;
    const proxyPath = req.originalUrl.replace('/platform-event', `/cometd/${ENV.SFDC_API_VERSION}`);
    const proxyUrl = `${jetstreamConn.sessionInfo.instanceUrl}${proxyPath}`;

    res.log.debug({ proxyUrl }, '[PROXY][REQUEST]');

    const headers = {
      Authorization: `Bearer ${jetstreamConn.sessionInfo.accessToken}`,
      Accept: req.headers.accept || '*/*',
      'Accept-Encoding': req.headers['accept-encoding'] || 'gzip, deflate, br, zstd',
      Cookie: req.headers.cookie,
      'user-agent': req.headers['user-agent'],
    };

    if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
      headers['Content-Type'] = req.headers['content-type'];
    }

    // stream request body to Salesforce
    req.pipe(
      https
        .request(proxyUrl, {
          method: req.method,
          headers,
        })
        .on('response', (proxyResponse) => {
          // re-write cookie path to match Jetstream's path
          if (proxyResponse.headers['set-cookie']) {
            proxyResponse.headers['set-cookie'] = proxyResponse.headers['set-cookie'].map((cookie) =>
              cookie.replaceAll('/cometd/', '/platform-event')
            );
          }
          // stream response back to user
          res.writeHead(proxyResponse.statusCode || 500, { ...proxyResponse.headers, 'Access-Control-Allow-Credentials': 'true' });
          proxyResponse.pipe(res, { end: true });
        })
        .on('error', (err) => {
          logger.error(getExceptionLog(err), '[PROXY][EXCEPTION]');
          next(err);
        })
    );
  } catch (err) {
    logger.error(getExceptionLog(err), '[PROXY][EXCEPTION]');
    next(err);
  }
});

export default routes;
