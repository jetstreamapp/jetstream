import type express from 'express';
import pino from 'pino';
import pinoHttp from 'pino-http';
import { v4 as uuid } from 'uuid';
import { ENV } from './env-config';

export const logger = pino({
  level: ENV.LOG_LEVEL,
  transport:
    ENV.ENVIRONMENT === 'development' && !ENV.IS_LOCAL_DOCKER && !ENV.CI
      ? {
          target: 'pino-pretty',
        }
      : undefined,
});

const ignoreLogsFileExtensions = /.*\.(js|map|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|otf|json|xml|txt)$/;

export const httpLogger = pinoHttp<express.Request, express.Response>({
  logger,
  genReqId: (req, res) => res.locals.requestId || uuid(),
  autoLogging: {
    // ignore static files based on file extension
    ignore: (req) =>
      ignoreLogsFileExtensions.test(req.url) || req.url === '/healthz' || req.url === '/api/heartbeat' || req.url === '/api/analytics',
  },
  customLogLevel: function (req, res, error) {
    if (res.statusCode > 400) {
      // these are manually logged in the request handler
      return 'silent';
    }
    return ENV.LOG_LEVEL;
  },
  customSuccessMessage: function (req, res) {
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
          'x-sfdc-id': req.raw.headers['x-sfdc-id'],
          'x-client-request-id': req.raw.headers['x-client-request-id'],
          'x-retry': req.raw.headers['x-retry'],
          ip: req.raw.headers['cf-connecting-ip'] || req.raw.headers['x-forwarded-for'] || req.raw.socket.remoteAddress,
          country: req.headers['cf-ipcountry'],
        },
      };
    }),
    res: pino.stdSerializers.wrapResponseSerializer((res) => {
      return {
        statusCode: res.raw.statusCode,
        headers: {
          'content-type': (res.raw as any).headers['content-type'],
          'content-length': (res.raw as any).headers['content-length'],
        },
      };
    }),
  },
  customProps: function (req, res) {
    return {
      userId: (req as any).session?.user?.id,
      sessionId: (req as any).session?.id,
    };
  },
});

export function getExceptionLog(error: unknown, includeStack = false) {
  const status = (error as any) /** UserFacingError */?.apiRequestError?.status || (error as any) /** ApiRequestError */?.status;
  if (error instanceof Error) {
    return {
      error: error.message,
      status,
      stack: includeStack ? error.stack : undefined,
    };
  }
  return {
    error,
  };
}
