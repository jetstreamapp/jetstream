import { Maybe } from '@jetstream/types';
import 'express';
import 'express-session';
import { SessionData as JetstreamSessionData, StepUpMethod, UserProfileSession } from '../libs/auth/types/src';

// Augment Express Request interface
// This is here so that apps and libraries can both share it and avoid circular dependencies

declare global {
  namespace Express {
    interface Locals {
      requestId: string;
      cspNonce: string;
      /**
       * Which factor satisfied step-up re-authentication, set by the requireStepUpAuth middleware.
       * Consuming the grant clears it from the session, so this is the only way a controller can
       * record which factor authorized the action.
       */
      stepUpMethod?: StepUpMethod;
    }
  }
}

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
