import { ENV } from '@jetstream/api-config';
import { Maybe } from '@jetstream/types';
import type { Request } from 'express';

/** Only the header accessor is needed, which keeps this usable with any of express' Request generics. */
type RequestHeaders = Pick<Request, 'get'>;

/**
 * The Vite dev server uses arbitrary localhost ports in development — several worktrees can each
 * run one at the same time against this single API server.
 */
const LOCALHOST_ORIGIN_REGEX = /^https?:\/\/localhost(:\d+)?$/;

/**
 * Origin of the page that opened the OAuth popup, used as the `postMessage` target when handing the
 * result back through `/oauth-link/`.
 *
 * In production every client is served from JETSTREAM_CLIENT_URL, so the caller's fallback is always
 * correct. In development the app is served by whichever dev server port the developer's worktree
 * landed on, which is rarely the port baked into JETSTREAM_CLIENT_URL — a mismatch here means the
 * browser silently drops the message and the newly connected org never shows up.
 *
 * Returns null unless this is development and the request came from localhost; the target origin of
 * a `postMessage` is a security boundary and must never widen outside of local development.
 */
export function getDevClientOriginFromRequest(req: RequestHeaders): Maybe<string> {
  if (ENV.ENVIRONMENT !== 'development') {
    return null;
  }

  const referer = req.get('referer') || req.get('origin');
  if (!referer) {
    return null;
  }

  try {
    const { origin } = new URL(referer);
    return LOCALHOST_ORIGIN_REGEX.test(origin) ? origin : null;
  } catch {
    return null;
  }
}
