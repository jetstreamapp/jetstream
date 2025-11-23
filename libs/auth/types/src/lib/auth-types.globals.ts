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
  interface SessionData extends JetstreamSessionData {}
}
