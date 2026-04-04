import { ENV, getExceptionLog } from '@jetstream/api-config';
import type { DeferredResponseState, Response } from '@jetstream/api-types';
import { HTTP } from '@jetstream/shared/constants';
import type { NextFunction, Request, Response as ExpressResponse } from 'express';
import { setCookieHeaders } from './response.handlers';

export type { DeferredResponseState };

/**
 * Middleware that prevents Cloudflare 524 timeouts for long-running Salesforce API requests.
 *
 * When a response takes longer than the threshold (default 45s), the middleware begins
 * streaming space characters as chunked keepalive bytes. When the actual response is ready,
 * it is written to the stream. JSON.parse natively ignores leading whitespace, so Axios
 * on the client handles this transparently.
 *
 * NOTE: If compression middleware is re-enabled, chunks may be buffered and not flushed
 * to Cloudflare in time. This middleware requires compression to be disabled.
 */
export function deferredResponseMiddleware(req: Request, res: Response, next: NextFunction) {
  if (!ENV.DEFERRED_RESPONSE_ENABLED) {
    return next();
  }

  const deferred: DeferredResponseState = {
    active: false,
    timer: null,
    keepaliveInterval: null,
    startTime: Date.now(),
    keepaliveCount: 0,
  };

  // Store deferred state on res.locals so sendJson and uncaughtErrorHandler can access it
  res.locals._deferred = deferred;

  deferred.timer = setTimeout(
    () => {
      // If the response has already started (e.g., streaming controller), do nothing
      if (res.headersSent || res.writableEnded) {
        return;
      }

      const elapsedMs = Date.now() - deferred.startTime;

      res.log.warn(
        { requestId: res.locals.requestId, method: req.method, url: req.originalUrl, elapsedMs },
        '[DEFERRED][ACTIVATED] Response deferred due to slow upstream',
      );

      // Flush pending cookies before committing headers
      setCookieHeaders(res);

      // Commit response headers -- from this point, status code is locked at 200
      // Transfer-Encoding: chunked is set explicitly since the entire mechanism depends on it
      res.writeHead(200, {
        'Content-Type': HTTP.CONTENT_TYPE.JSON,
        'Transfer-Encoding': 'chunked',
        [HTTP.HEADERS.X_DEFERRED_RESPONSE]: '1',
        [HTTP.HEADERS.X_REQUEST_ID]: res.locals.requestId,
      });

      // Set active after writeHead so writeDeferredResponse can't see active=true before headers are committed
      deferred.active = true;

      // Send first keepalive byte
      try {
        res.write(' ');
        deferred.keepaliveCount++;
      } catch (ex) {
        res.log.error(
          { requestId: res.locals.requestId, elapsedMs: Date.now() - deferred.startTime, ...getExceptionLog(ex) },
          '[DEFERRED][WRITE_ERROR] Failed to write initial keepalive',
        );
        cleanupDeferred(deferred);
        try {
          res.destroy();
        } catch {
          // Nothing left to do
        }
        return;
      }

      // Start periodic keepalive
      deferred.keepaliveInterval = setInterval(
        () => {
          if (res.writableEnded) {
            cleanupDeferred(deferred);
            return;
          }
          try {
            res.write(' ');
            deferred.keepaliveCount++;
            res.log.debug(
              { requestId: res.locals.requestId, keepaliveCount: deferred.keepaliveCount, elapsedMs: Date.now() - deferred.startTime },
              '[DEFERRED][KEEPALIVE]',
            );
          } catch (ex) {
            res.log.error(
              { requestId: res.locals.requestId, elapsedMs: Date.now() - deferred.startTime, ...getExceptionLog(ex) },
              '[DEFERRED][WRITE_ERROR] Failed to write keepalive, destroying stream',
            );
            cleanupDeferred(deferred);
            // Stream is broken — destroy to avoid leaked socket
            try {
              res.destroy();
            } catch {
              // Nothing left to do
            }
          }
        },
        Number(ENV.DEFERRED_RESPONSE_KEEPALIVE_MS) || 25_000,
      );
    },
    Number(ENV.DEFERRED_RESPONSE_THRESHOLD_MS) || 75_000,
  );

  // Clean up timers if client disconnects
  req.on('close', () => {
    if (deferred.active) {
      res.log.warn(
        { requestId: res.locals.requestId, elapsedMs: Date.now() - deferred.startTime },
        '[DEFERRED][CLIENT_DISCONNECT] Client disconnected during deferred response',
      );
    }
    cleanupDeferred(deferred);
  });

  next();
}

/**
 * Write the final JSON body to a deferred response stream and end it.
 * Returns true if the response was in deferred mode and was written, false otherwise.
 *
 * Call this from sendJson and uncaughtErrorHandler before their existing headersSent guards.
 */
export function writeDeferredResponse(res: Response | ExpressResponse, body: unknown): boolean {
  const deferred = (res.locals as { _deferred?: DeferredResponseState })?._deferred;
  if (!deferred?.active) {
    return false;
  }

  // Clear timers immediately, but keep active=true until after the write succeeds
  // so that if res.write throws and triggers the error handler, it can still detect deferred mode
  clearDeferredTimers(deferred);

  const elapsedMs = Date.now() - deferred.startTime;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const resLog = (res as any).log;

  let stringifySucceeded = false;
  try {
    const jsonBody = JSON.stringify(body);
    stringifySucceeded = true;
    res.write(jsonBody);
    res.end();
    deferred.active = false;
  } catch (ex) {
    deferred.active = false;
    resLog?.error(
      { requestId: res.locals?.requestId, elapsedMs, ...getExceptionLog(ex) },
      '[DEFERRED][WRITE_ERROR] Failed to write deferred response body',
    );
    try {
      // Only write fallback error if JSON.stringify failed (not after a partial res.write)
      // A partial write + fallback would produce unparseable JSON for the client
      if (!stringifySucceeded) {
        try {
          res.write('{"error":true,"success":false,"message":"Internal server error"}');
        } catch {
          // Write failed, stream is likely broken
        }
      }
      res.end();
    } catch {
      // res.end() also failed — force-close the connection to avoid a leaked socket
      try {
        res.destroy();
      } catch {
        // Nothing left to do
      }
    }
  }

  return true;
}

export function clearDeferredTimers(deferred: DeferredResponseState) {
  if (deferred.timer) {
    clearTimeout(deferred.timer);
    deferred.timer = null;
  }
  if (deferred.keepaliveInterval) {
    clearInterval(deferred.keepaliveInterval);
    deferred.keepaliveInterval = null;
  }
}

function cleanupDeferred(deferred: DeferredResponseState) {
  deferred.active = false;
  clearDeferredTimers(deferred);
}
