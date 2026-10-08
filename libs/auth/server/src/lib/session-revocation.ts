import { logger } from '@jetstream/api-config';
import type { Maybe } from '@jetstream/types';

/**
 * Sessions are revoked from many places - the profile page, a team admin, a password reset, an email
 * change, a team deactivating a member, a login policy that no longer allows the session - but a
 * socket opened by a revoked session keeps receiving that user's events until it happens to
 * reconnect. The socket server lives in the api application and cannot be imported here, so revocation
 * is announced through this hook and the application disconnects the matching sockets.
 */
export type SessionRevocationEvent =
  | { type: 'session'; sessionId: string }
  | { type: 'user'; userId: string; exceptSessionId?: Maybe<string> }
  /** A desktop or browser-extension token was revoked; those clients are known by their device id */
  | { type: 'device'; deviceId: string };

export type SessionRevocationListener = (event: SessionRevocationEvent) => void;

const listeners = new Set<SessionRevocationListener>();

/** Registers a listener for every session revocation; returns a function that removes it again. */
export function onSessionsRevoked(listener: SessionRevocationListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Best effort by design: the revocation itself has already been written, and a listener that throws
 * must not turn a successful revocation into a failed request.
 */
export function notifySessionsRevoked(event: SessionRevocationEvent) {
  for (const listener of listeners) {
    try {
      listener(event);
    } catch (ex) {
      logger.error({ err: ex, event }, '[AUTH] Session revocation listener failed');
    }
  }
}
