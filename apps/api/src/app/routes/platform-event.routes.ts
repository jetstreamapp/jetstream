import { ENV, logger } from '@jetstream/api-config';
import { HTTP } from '@jetstream/shared/constants';
import express, { Router } from 'express';
import https from 'https';
import { normalizePlatformEventSetCookie, stripJetstreamCookies } from '../utils/proxy-cookie.utils';
import { checkAuth, getOrgFromHeaderOrQuery } from './route.middleware';

const routes: express.Router = Router();

// Same-origin allowlist for this cookie-authenticated, state-forwarding proxy. It is mounted
// outside /api so it never passes through validateDoubleCSRF; an explicit Origin check is a CSRF
// backstop (the session cookie is SameSite=Lax, so this is defense-in-depth).
function getAllowedProxyOrigins(): Set<string> {
  const origins = new Set<string>();
  const originSources = { JETSTREAM_CLIENT_URL: ENV.JETSTREAM_CLIENT_URL, JETSTREAM_SERVER_URL: ENV.JETSTREAM_SERVER_URL };
  for (const [envVarName, url] of Object.entries(originSources)) {
    try {
      origins.add(new URL(url).origin);
    } catch {
      // A malformed URL shrinks the allowlist and every cross-origin request 403s, so make the cause findable.
      logger.warn({ envVarName, url }, '[PLATFORM-EVENT] Ignoring malformed URL when building the allowed origin list');
    }
  }
  return origins;
}
const ALLOWED_PROXY_ORIGINS = getAllowedProxyOrigins();

// Salesforce response headers we forward back to the browser. Everything else (notably upstream
// HSTS / CSP / X-Frame-Options / Cache-Control) is dropped so Salesforce cannot override the
// security headers Helmet set for our same-origin response.
const FORWARDED_PROXY_RESPONSE_HEADERS = new Set(['content-type', 'content-length', 'transfer-encoding', 'content-encoding']);

routes.use(checkAuth);

routes.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
  const origin = req.headers.origin;
  if (origin && !ALLOWED_PROXY_ORIGINS.has(origin)) {
    res.log.warn({ origin }, '[PLATFORM-EVENT][FORBIDDEN-ORIGIN]');
    res.status(403).send('Forbidden');
    return;
  }
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
    const result = await getOrgFromHeaderOrQuery(req, res, HTTP.HEADERS.X_SFDC_ID, HTTP.HEADERS.X_SFDC_API_VERSION);
    if (!result) {
      throw new Error('A valid salesforce org must be included with the request');
    }
    const jetstreamConn = result.jetstreamConn;
    const proxyPath = req.originalUrl.replace('/platform-event', `/cometd/${ENV.SFDC_API_VERSION}`);
    const proxyUrl = `${jetstreamConn.sessionInfo.instanceUrl}${proxyPath}`;

    res.log.debug({ proxyUrl }, '[PROXY][REQUEST]');

    const forwardedCookie = stripJetstreamCookies(req.headers.cookie);
    const headers: Record<string, string | string[] | undefined> = {
      Authorization: `Bearer ${jetstreamConn.sessionInfo.accessToken}`,
      Accept: req.headers.accept || '*/*',
      'Accept-Encoding': req.headers['accept-encoding'] || 'gzip, deflate, br, zstd',
      'user-agent': req.get('user-agent'),
    };
    if (forwardedCookie) {
      headers.Cookie = forwardedCookie;
    }

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
          // Forward only an allowlist of upstream headers so Salesforce cannot override the
          // security/caching headers Helmet set for our same-origin response.
          const responseHeaders: Record<string, string | string[] | undefined> = {
            'Access-Control-Allow-Credentials': 'true',
          };
          for (const [headerName, headerValue] of Object.entries(proxyResponse.headers)) {
            if (FORWARDED_PROXY_RESPONSE_HEADERS.has(headerName.toLowerCase())) {
              responseHeaders[headerName] = headerValue;
            }
          }
          // Re-write Salesforce cookies for Jetstream's same-origin CometD proxy.
          if (proxyResponse.headers['set-cookie']) {
            responseHeaders['set-cookie'] = proxyResponse.headers['set-cookie'].map(normalizePlatformEventSetCookie);
          }
          // stream response back to user
          res.writeHead(proxyResponse.statusCode || 500, responseHeaders);
          proxyResponse.pipe(res, { end: true });
        })
        .on('error', (err) => {
          logger.error({ err }, '[PROXY][EXCEPTION]');
          next(err);
        }),
    );
  } catch (err) {
    logger.error({ err }, '[PROXY][EXCEPTION]');
    next(err);
  }
});

export default routes;
