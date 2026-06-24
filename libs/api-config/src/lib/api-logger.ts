import { HTTP } from '@jetstream/shared/constants';
import type express from 'express';
import { createHash } from 'node:crypto';
import pino from 'pino';
import pinoHttp from 'pino-http';
import { v4 as uuid } from 'uuid';
import { ENV } from './env-config';
import { getHttpLogLevel } from './logging-policy';

const isLocalDevelopment = ENV.ENVIRONMENT === 'development' && !ENV.IS_LOCAL_DOCKER;

export const logger = pino({
  level: ENV.LOG_LEVEL,
  // Secret keys are listed twice on purpose: a bare path (`token`) censors a top-level field, while
  // `*.token` censors the same key one level deep (fast-redact wildcards match a single level only).
  redact: [
    'req.headers.cookie',
    'req.headers.authorization',
    'res.headers["set-cookie"]',
    'token',
    'accessToken',
    'refreshToken',
    'password',
    '*.token',
    '*.accessToken',
    '*.refreshToken',
    '*.password',
  ],
  transport: isLocalDevelopment
    ? {
        targets: [
          ...(ENV.PRETTY_LOGS
            ? [
                {
                  target: 'pino-pretty',
                },
              ]
            : [
                {
                  target: 'pino/file',
                  options: {
                    destination: 1,
                  },
                },
              ]),
          {
            target: 'pino/file',
            options: {
              destination: 'logs/server.log',
              mkdir: true,
            },
          },
        ],
      }
    : undefined,
});

const ignoreLogsFileExtensions = /.*\.(js|map|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|otf|json|xml|txt)$/;

/**
 * Strip the query string from a referer before logging. The path (e.g. `/oauth-link/`) keeps its
 * debugging value, while the query can carry encoded payloads with customer PII (name, email,
 * Salesforce org/instance URLs). Browsers never send the fragment in `referer`, so cutting at the
 * first `?` leaves exactly origin + path. Cheaper than `new URL()` and cannot throw.
 */
export function sanitizeReferer(referer?: string): string | undefined {
  if (!referer) {
    return referer;
  }
  const queryIndex = referer.indexOf('?');
  return queryIndex === -1 ? referer : referer.slice(0, queryIndex);
}

/**
 * Query-string parameters whose VALUES are redacted from a logged `req.url`. These carry OAuth
 * credentials (`code` is a single-use authorization code), CSRF/session state, or PII payloads
 * (`data` on the oauth-link flow). Unlike the referer we keep the rest of the URL — path and
 * non-sensitive params stay intact for debugging.
 */
const REDACTED_URL_PARAMS = ['code', 'state', 'token', 'data', 'access_token', 'refresh_token', 'id_token', 'client_secret'];

/**
 * Redact known-sensitive query parameter values from a URL while preserving the path and any other
 * params. Returns the input byte-for-byte when there is nothing to redact, so untouched URLs are
 * never re-encoded; only mutated URLs are re-serialized.
 */
export function sanitizeUrl(url?: string): string | undefined {
  if (!url) {
    return url;
  }
  const queryIndex = url.indexOf('?');
  if (queryIndex === -1) {
    return url;
  }
  const params = new URLSearchParams(url.slice(queryIndex + 1));
  let mutated = false;
  for (const param of REDACTED_URL_PARAMS) {
    if (params.has(param)) {
      params.set(param, 'REDACTED');
      mutated = true;
    }
  }
  return mutated ? `${url.slice(0, queryIndex)}?${params.toString()}` : url;
}

/**
 * Defensive upper bound on the oauth-link `data` payload we'll `JSON.parse`. URL length is already
 * bounded upstream (proxy/Express limits) and legit payloads are a few hundred bytes, so this only
 * guards against an oversized value ever turning the request-logger parse into a CPU/memory hotspot.
 */
const MAX_ORG_DATA_LENGTH = 10_000;

/**
 * Pull the Salesforce org unique id out of the oauth-link `data` payload so it survives as a
 * structured `orgUniqueId` log field after `sanitizeUrl` redacts the raw `data` param (the source is
 * the only place that payload still exists). Scoped to the oauth-link path so every other request
 * skips the JSON parse. Never throws — returns undefined on any absent/malformed payload.
 */
export function extractOrgUniqueId(url?: string): string | undefined {
  if (!url || !url.includes('/oauth-link/')) {
    return undefined;
  }
  const queryIndex = url.indexOf('?');
  if (queryIndex === -1) {
    return undefined;
  }
  const data = new URLSearchParams(url.slice(queryIndex + 1)).get('data');
  if (!data || data.length > MAX_ORG_DATA_LENGTH) {
    return undefined;
  }
  try {
    const parsed = JSON.parse(data);
    return typeof parsed?.uniqueId === 'string' ? parsed.uniqueId : undefined;
  } catch {
    return undefined;
  }
}

/**
 * The raw session id is the session store's primary key and one half of the session credential
 * (the browser presents it inside a secret-signed cookie). Logging it would copy that key into
 * lower-trust log sinks, so we log a stable SHA-256 prefix instead: irreversible, but still lets us
 * correlate all requests within a single session for debugging.
 */
export function hashSessionId(sessionId?: string): string | undefined {
  return sessionId ? createHash('sha256').update(sessionId).digest('hex').slice(0, 16) : sessionId;
}

export const httpLogger = pinoHttp<express.Request, express.Response>({
  logger,
  genReqId: (_, res) => res.locals.requestId || uuid(),
  customLogLevel: getHttpLogLevel,
  autoLogging: {
    // ignore static files based on file extension
    ignore: (req) =>
      ignoreLogsFileExtensions.test(req.url) || req.url === '/healthz' || req.url === '/api/heartbeat' || req.url === '/api/analytics',
  },
  customSuccessMessage(req, res) {
    if (res.statusCode === 404) {
      // 404s log the full URL (incl. query) rather than `req.path`, so sanitize it here too
      return `[404] [${req.method}] ${sanitizeUrl(req.url)}`;
    }
    return `${req.method} ${req.path}`;
  },
  serializers: {
    req: pino.stdSerializers.wrapRequestSerializer((req) => {
      try {
        return {
          id: req.raw.id,
          method: req.raw.method,
          url: sanitizeUrl(req.raw.url),
          orgUniqueId: extractOrgUniqueId(req.raw.url),
          headers: {
            host: req.raw.headers.host,
            'user-agent': req.raw.headers['user-agent'],
            referer: sanitizeReferer(req.raw.headers.referer),
            'cf-ray': req.raw.headers['cf-ray'],
            'rndr-id': req.raw.headers['rndr-id'],
            'x-sfdc-id': req.raw.headers[HTTP.HEADERS.X_SFDC_ID.toLowerCase()],
            'x-client-request-id': req.raw.headers[HTTP.HEADERS.X_CLIENT_REQUEST_ID.toLowerCase()],
            'x-retry': req.raw.headers[HTTP.HEADERS.X_RETRY.toLowerCase()],
            'x-ext-id': req.raw.headers[HTTP.HEADERS.X_EXT_DEVICE_ID.toLowerCase()],
            'x-app-version': req.raw.headers[HTTP.HEADERS.X_APP_VERSION.toLowerCase()],
            ip: req.raw.headers['cf-connecting-ip'] || req.raw.headers['x-forwarded-for'] || req.raw.socket.remoteAddress,
            country: req.headers['cf-ipcountry'],
          },
        };
      } catch {
        // A serializer that throws escapes as a 500 (see res serializer note below). None of the
        // current helpers throw, but this keeps a future field from crashing request logging:
        // degrade to the essentials (still redacting the url, which can't throw) and flag for alerting.
        return { id: req.raw?.id, method: req.raw?.method, url: sanitizeUrl(req.raw?.url), serializerError: true };
      }
    }),
    res: pino.stdSerializers.wrapResponseSerializer((res) => {
      // `wrapResponseSerializer` wraps to `{ statusCode, headers, raw }` where `raw` is the
      // original value. For live Express responses `raw.headers` exists; for plain objects
      // logged explicitly (e.g. `{ res: { statusCode: 401 } }` from uncaughtErrorHandler)
      // it doesn't — without this guard, reading `raw.headers[...]` throws during logging
      // and escapes into the outer error handler as a 500.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rawHeaders: Record<string, string> | undefined = (res.raw as any)?.headers;
      return {
        statusCode: res.raw?.statusCode ?? res.statusCode,
        headers: rawHeaders
          ? {
              'content-type': rawHeaders['content-type'],
              'content-length': rawHeaders['content-length'],
            }
          : undefined,
      };
    }),
  },
  customProps(req) {
    return {
      userId: (req as any).session?.user?.id,
      sessionIdHash: hashSessionId((req as any).session?.id),
    };
  },
});
