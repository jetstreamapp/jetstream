import { ENV, getLogger } from '@jetstream/api-config';
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
      getLogger().warn({ envVarName, url }, '[PLATFORM-EVENT] Ignoring malformed URL when building the allowed origin list');
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
    getLogger().warn({ origin }, '[PLATFORM-EVENT][FORBIDDEN-ORIGIN]');
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
    const result = await getOrgFromHeaderOrQuery(req, res, HTTP.HEADERS.X_SFDC_ID, HTTP.HEADERS.X_SFDC_API_VERSION, undefined, {
      allowQueryParam: true,
    });
    if (!result) {
      throw new Error('A valid salesforce org must be included with the request');
    }
    // The client may have left during the org lookup, after `close` already fired - don't start a long-poll for it
    if (res.destroyed) {
      return;
    }
    const jetstreamConn = result.jetstreamConn;
    const proxyPath = req.originalUrl.replace('/platform-event', `/cometd/${ENV.SFDC_API_VERSION}`);
    const proxyUrl = `${jetstreamConn.sessionInfo.instanceUrl}${proxyPath}`;

    getLogger().debug({ proxyUrl }, '[PROXY][REQUEST]');

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

    // CometD long-polls can wait ~2 minutes for Salesforce to respond, so the client may leave before any response
    // arrives - destroying the request also stops a response that is already streaming
    const proxyRequest = https.request(proxyUrl, { method: req.method, headers });
    res.on('close', () => {
      if (!res.writableFinished) {
        proxyRequest.destroy();
      }
    });

    // stream request body to Salesforce
    req.pipe(
      proxyRequest
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
          // An upstream reset mid-body would otherwise be an uncaught exception and leave the response hanging
          proxyResponse.on('error', (err) => {
            if (res.destroyed) {
              // expected when the client disconnected and the request was destroyed above
              return;
            }
            getLogger().warn({ err }, '[PROXY][RESPONSE_ERROR]');
            if (!res.headersSent) {
              next(err);
              return;
            }
            res.destroy(err);
          });
          // stream response back to user
          res.writeHead(proxyResponse.statusCode || 500, responseHeaders);
          proxyResponse.pipe(res, { end: true });
        })
        .on('error', (err) => {
          if (res.destroyed) {
            // expected "socket hang up" from destroying the request after the client disconnected
            return;
          }
          getLogger().error({ err }, '[PROXY][EXCEPTION]');
          next(err);
        }),
    );
  } catch (err) {
    getLogger().error({ err }, '[PROXY][EXCEPTION]');
    next(err);
  }
});

export default routes;
