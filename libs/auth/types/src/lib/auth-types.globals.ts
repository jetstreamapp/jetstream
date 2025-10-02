import 'express';
import 'express-session';
import { SessionData as JetstreamSessionData, UserProfileSession } from './auth-types';

declare module 'express' {
  interface Request {
    /**
     * Authenticated user for external authenticated routes (e.g. web extension, desktop app)
     * populated in externalAuthService.getExternalAuthMiddleware
     */
    externalAuth?: {
      user: UserProfileSession;
      deviceId?: string;
    };
  }
}

declare module 'express-session' {
  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  interface SessionData extends JetstreamSessionData {}
}
