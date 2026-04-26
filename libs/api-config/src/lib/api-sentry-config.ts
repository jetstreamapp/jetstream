import * as Sentry from '@sentry/node';
import type { NextFunction, Request, Response } from 'express';
import { LRUCache } from 'lru-cache';
import { logger } from './api-logger';
import { ENV } from './env-config';

type RequestWithSession = Request & { session?: { user?: { id?: string; email?: string } } };

type Severity = 'error' | 'warning' | 'fatal' | 'info';

const isEnabled = !!ENV.SENTRY_DSN && ENV.ENVIRONMENT !== 'development';

if (isEnabled) {
  Sentry.init({
    dsn: ENV.SENTRY_DSN,
    release: ENV.VERSION || undefined,
    environment: ENV.ENVIRONMENT,
    sendDefaultPii: false,
    tracesSampleRate: 0,
    beforeSend(event) {
      const rateLimitKey = getRateLimitKey(event);
      if (isUserRateLimited(rateLimitKey)) {
        return null;
      }
      return event;
    },
  });
}

interface RateLimitWindow {
  minute: number[];
  hour: number[];
}

const PER_USER_MINUTE_LIMIT = 5;
const PER_USER_HOUR_LIMIT = 30;

const rateLimitCache = new LRUCache<string, RateLimitWindow>({
  max: 10_000,
  ttl: 1000 * 60 * 60,
});

function getRateLimitKey(event: Sentry.Event): string {
  const userKey = event.user?.id || event.user?.ip_address;
  if (userKey) {
    return `user:${userKey}`;
  }
  // Uncaught events captured by auto-instrumentation have no user context.
  // Fingerprint by exception type+message so a single noisy error doesn't
  // silence dissimilar errors under a shared 'anonymous' bucket.
  const exception = event.exception?.values?.[0];
  if (exception) {
    return `anon:${exception.type ?? 'Error'}:${exception.value ?? ''}`;
  }
  if (event.message) {
    return `anon:message:${event.message}`;
  }
  return 'anonymous';
}

function isUserRateLimited(userKey: string): boolean {
  const now = Date.now();
  const oneMinuteAgo = now - 60_000;
  const oneHourAgo = now - 3_600_000;
  const existing = rateLimitCache.get(userKey) ?? { minute: [], hour: [] };
  const minute = existing.minute.filter((timestamp) => timestamp > oneMinuteAgo);
  const hour = existing.hour.filter((timestamp) => timestamp > oneHourAgo);
  if (minute.length >= PER_USER_MINUTE_LIMIT || hour.length >= PER_USER_HOUR_LIMIT) {
    rateLimitCache.set(userKey, { minute, hour });
    return true;
  }
  minute.push(now);
  hour.push(now);
  rateLimitCache.set(userKey, { minute, hour });
  return false;
}

function isExpressRequest(value: unknown): value is Request {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Request).method === 'string' &&
    typeof (value as Request).url === 'string' &&
    typeof (value as Request).headers === 'object'
  );
}

function partitionArgs(args: unknown[]): { req?: Request; extras: Record<string, unknown>; errorFromExtras?: Error } {
  let req: Request | undefined;
  let errorFromExtras: Error | undefined;
  const extras: Record<string, unknown> = {};
  for (const arg of args) {
    if (!req && isExpressRequest(arg)) {
      req = arg;
    } else if (arg instanceof Error) {
      errorFromExtras = errorFromExtras ?? arg;
    } else if (arg && typeof arg === 'object') {
      Object.assign(extras, arg as Record<string, unknown>);
    }
  }
  return { req, extras, errorFromExtras };
}

function getFirstHeaderValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function getFullUrl(req: Request): string | undefined {
  const host = req.get?.('host') ?? getFirstHeaderValue(req.headers?.host);
  if (!host) {
    return undefined;
  }
  const protocol = req.protocol || ((req.socket as { encrypted?: boolean } | undefined)?.encrypted === true ? 'https' : 'http');
  const path = (req as Request & { originalUrl?: string }).originalUrl || req.url;
  return `${protocol}://${host}${path}`;
}

function applyRequestScope(scope: Sentry.Scope, req: Request) {
  const userId = (req as RequestWithSession).session?.user?.id;
  const userEmail = (req as RequestWithSession).session?.user?.email;
  const userAgent = req.get('user-agent');
  const ip = req.ipAddress;
  if (userId || userEmail) {
    scope.setUser({ id: userId, email: userEmail, ...(ip ? { ip_address: ip } : {}) });
  } else if (ip) {
    scope.setUser({ ip_address: ip });
  }
  scope.setContext('request', {
    method: req.method,
    url: req.url,
    full_url: getFullUrl(req),
    query: req.query,
    params: req.params,
    ip,
    userAgent,
  });
}

/**
 * Express middleware that stamps the current request's user/IP/URL onto Sentry's
 * isolation scope. Mount after `sessionMiddleware` so `req.session.user` is available.
 *
 * Any `errorTracker.*` call during the request — even from services that don't
 * receive `req` — will inherit this context. Cheap no-op when Sentry isn't enabled.
 */
export function sentryRequestContextMiddleware(req: Request, _res: Response, next: NextFunction): void {
  if (!isEnabled) {
    next();
    return;
  }
  try {
    applyRequestScope(Sentry.getIsolationScope(), req);
  } catch (ex) {
    logger.error({ err: ex }, '[ERROR_TRACKER] Failed to apply request context');
  }
  next();
}

function capture(severity: Severity, messageOrError: unknown, args: unknown[]) {
  if (!isEnabled) {
    return;
  }
  const { req, extras, errorFromExtras } = partitionArgs(args);
  try {
    Sentry.withScope((scope) => {
      scope.setLevel(severity);
      if (req) {
        applyRequestScope(scope, req);
      }
      if (Object.keys(extras).length > 0) {
        scope.setExtras(extras);
      }
      if (messageOrError instanceof Error) {
        Sentry.captureException(messageOrError);
      } else if (errorFromExtras) {
        if (typeof messageOrError === 'string') {
          scope.setExtra('message', messageOrError);
        }
        Sentry.captureException(errorFromExtras);
      } else if (typeof messageOrError === 'string') {
        Sentry.captureMessage(messageOrError, severity);
      } else {
        Sentry.captureException(new Error(String(messageOrError)));
      }
    });
  } catch (ex) {
    logger.error({ err: ex }, '[ERROR_TRACKER] Failed to capture event');
  }
}

export const errorTracker = {
  error: (messageOrError: unknown, ...rest: unknown[]) => capture('error', messageOrError, rest),
  warn: (messageOrError: unknown, ...rest: unknown[]) => capture('warning', messageOrError, rest),
  critical: (messageOrError: unknown, ...rest: unknown[]) => capture('fatal', messageOrError, rest),
  info: (messageOrError: unknown, ...rest: unknown[]) => capture('info', messageOrError, rest),
};

export type ErrorTracker = typeof errorTracker;
