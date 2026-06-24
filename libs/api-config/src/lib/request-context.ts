import type { Maybe } from '@jetstream/types';
import type express from 'express';
import { AsyncLocalStorage } from 'node:async_hooks';
import type pino from 'pino';
import { v4 as uuid } from 'uuid';
import { logger as baseLogger } from './api-logger';

/**
 * Per-request logging context propagated via AsyncLocalStorage.
 *
 * The store holds a re-bindable child logger so that context discovered late in the request
 * lifecycle (userId after auth, orgId after org resolution) can be folded into the logger
 * without having to thread `req`/`res`/`logger` through every function. Any code — however
 * deep — can call `getLogger()` to obtain the request-scoped logger.
 */
export interface RequestContextStore {
  requestId: string;
  /** Re-bindable child logger; always carries at least `requestId`. */
  logger: pino.Logger;
  /** Accumulated bindings so each enrichment is additive rather than lossy. */
  bindings: Record<string, unknown>;
  userId?: Maybe<string>;
  sessionId?: Maybe<string>;
  orgId?: string | number;
  deviceId?: Maybe<string>;
}

const asyncLocalStorage = new AsyncLocalStorage<RequestContextStore>();

/**
 * The logger for the current request, or the base logger when called outside of a request
 * scope (socket handlers, cron tasks, startup, etc.).
 */
export function getLogger(): pino.Logger {
  return asyncLocalStorage.getStore()?.logger ?? baseLogger;
}

export function getRequestContext(): RequestContextStore | undefined {
  return asyncLocalStorage.getStore();
}

/**
 * Entry point for a request scope. The callback (and every async continuation it spawns)
 * runs with access to the store. `next()` MUST be invoked inside the callback so the rest of
 * the middleware chain inherits the context.
 */
export function runWithRequestContext<T>(seed: { requestId: string; bindings?: Record<string, unknown> }, callback: () => T): T {
  const bindings = { requestId: seed.requestId, ...(seed.bindings ?? {}) };
  const store: RequestContextStore = {
    requestId: seed.requestId,
    bindings,
    logger: baseLogger.child(bindings),
  };
  return asyncLocalStorage.run(store, callback);
}

type EnrichableContext = Partial<Pick<RequestContextStore, 'userId' | 'sessionId' | 'orgId' | 'deviceId'>> & Record<string, unknown>;

/**
 * Fold additional context into the current request's logger. No-op when called outside a
 * request scope. Re-childs from the base logger using the accumulated bindings so repeated
 * enrichment stays idempotent and the binding set remains flat.
 */
export function enrichRequestContext(extra: EnrichableContext): void {
  const store = asyncLocalStorage.getStore();
  if (!store) {
    return;
  }
  const defined = Object.fromEntries(Object.entries(extra).filter(([, value]) => value != null));
  if (Object.keys(defined).length === 0) {
    return;
  }
  Object.assign(store.bindings, defined);
  store.logger = baseLogger.child(store.bindings);
  if (typeof defined.userId === 'string') {
    store.userId = defined.userId;
  }
  if (typeof defined.sessionId === 'string') {
    store.sessionId = defined.sessionId;
  }
  if (typeof defined.orgId === 'string' || typeof defined.orgId === 'number') {
    store.orgId = defined.orgId;
  }
  if (typeof defined.deviceId === 'string') {
    store.deviceId = defined.deviceId;
  }
}

/**
 * Opens an AsyncLocalStorage scope for the request so `getLogger()` resolves a request-scoped
 * logger anywhere downstream. Mount right after `httpLogger` so the access log is wired and
 * `res.locals.requestId` is finalized; self-sufficient (falls back to `req.id`/uuid) so it also
 * works for apps without a dedicated request-id middleware (e.g. geo-ip-api). `next()` runs
 * inside the scope so the entire chain, including the terminal error handler, inherits context.
 */
export function requestContextMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
  const requestId = res.locals.requestId || (req as express.Request & { id?: string }).id || uuid();
  res.locals.requestId = requestId;
  runWithRequestContext({ requestId }, () => next());
}
