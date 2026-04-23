import { HTTP } from '@jetstream/shared/constants';
import type express from 'express';
import pino from 'pino';
import pinoHttp from 'pino-http';
import { v4 as uuid } from 'uuid';
import { ENV } from './env-config';
import { getHttpLogLevel } from './logging-policy';

export const logger = pino({
  level: ENV.LOG_LEVEL,
  transport:
    ENV.ENVIRONMENT === 'development' && ENV.PRETTY_LOGS && !ENV.IS_LOCAL_DOCKER
      ? {
          target: 'pino-pretty',
        }
      : undefined,
});

const ignoreLogsFileExtensions = /.*\.(js|map|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|otf|json|xml|txt)$/;

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
      return `[404] [${req.method}] ${req.url}`;
    }
    return `${req.method} ${req.path}`;
  },
  serializers: {
    req: pino.stdSerializers.wrapRequestSerializer((req) => {
      return {
        id: req.raw.id,
        method: req.raw.method,
        url: req.raw.url,
        headers: {
          host: req.raw.headers.host,
          'user-agent': req.raw.headers['user-agent'],
          referer: req.raw.headers.referer,
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
      sessionId: (req as any).session?.id,
    };
  },
});
