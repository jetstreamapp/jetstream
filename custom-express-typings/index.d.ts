import { Maybe } from '@jetstream/types';
import 'express';
import 'express-session';
import { SessionData as JetstreamSessionData, UserProfileSession } from '../libs/auth/types/src';

// Augment Express Request interface
// This is here so that apps and libraries can both share it and avoid circular dependencies

declare module 'express' {
  interface Request {
    /**
     * Authenticated user for external authenticated routes (e.g. web extension, desktop app)
     * populated in externalAuthService.getExternalAuthMiddleware
     */
    externalAuth?: {
      user: UserProfileSession;
      deviceId?: Maybe<string>;
    };
  }
}

declare module 'express-session' {
  interface SessionData extends JetstreamSessionData {}
}
