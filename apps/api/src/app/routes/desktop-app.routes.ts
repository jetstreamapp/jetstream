import { createRateLimit, ENV } from '@jetstream/api-config';
import { convertUserProfileToSession } from '@jetstream/auth/server';
import { UserProfileSession } from '@jetstream/auth/types';
import { HTTP } from '@jetstream/shared/constants';
import * as express from 'express';
import Router from 'express-promise-router';
import helmet from 'helmet';
import { LRUCache } from 'lru-cache';
import * as desktopAppController from '../controllers/desktop-app.controller';
import * as externalAuthService from '../services/external-auth.service';
import { AuthenticationError } from '../utils/error-handler';

const cache = new LRUCache<string, externalAuthService.JwtDecodedPayload>({ max: 500 });

function getMaxRequests(value: number) {
  return ENV.CI || ENV.ENVIRONMENT === 'development' ? 10000 : value;
}

async function useExternalAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  try {
    const accessToken = req.get('Authorization')?.split(' ')[1];
    const deviceId = req.get(HTTP.HEADERS.X_WEB_EXTENSION_DEVICE_ID);
    let user: UserProfileSession | null = null;
    if (accessToken && deviceId) {
      const cacheKey = `${accessToken}-${deviceId}`;
      const userFromCache = cache.get(cacheKey);
      if (!userFromCache || userFromCache.exp < Date.now() / 1000) {
        const decodedJwtToken = await externalAuthService.verifyToken(
          { token: accessToken, deviceId },
          externalAuthService.AUDIENCE_DESKTOP
        );
        user = convertUserProfileToSession(decodedJwtToken.userProfile);
        cache.set(cacheKey, decodedJwtToken);
      } else {
        user = convertUserProfileToSession(userFromCache.userProfile);
      }
    }
    if (!user) {
      throw new AuthenticationError('Unauthorized');
    }
    req.chromeExtension = {
      deviceId,
      user,
    };
    next();
  } catch (ex) {
    req.log.info('[DESKTOP-AUTH][AUTH ERROR] Error decoding token', ex);
    next(new AuthenticationError('Unauthorized'));
  }
}

export const LAX_AuthRateLimit = createRateLimit('desktop_lax', {
  windowMs: 1000 * 60 * 1, // 1 minutes
  limit: getMaxRequests(25),
});

const STRICT_AuthRateLimit = createRateLimit('desktop_strict', {
  windowMs: 1000 * 60 * 5, // 5 minutes
  limit: getMaxRequests(20),
});

const STRICT_2X_AuthRateLimit = createRateLimit('desktop_strict_2x', {
  windowMs: 1000 * 60 * 15, // 15 minutes
  limit: getMaxRequests(10),
});

export const routes: express.Router = Router();

routes.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        baseUri: ["'self'"],
        blockAllMixedContent: [],
        fontSrc: ["'self'", 'https:'],
        frameAncestors: ["'self'"],
        imgSrc: ["'self'", '*.cloudinary.com'],
        objectSrc: ["'none'"],
        scriptSrc: ["'self'", (req, res) => `'nonce-${(res as any)?.locals?.nonce}'`],
        scriptSrcAttr: ["'none'"],
        styleSrc: ["'self'", 'https:', "'unsafe-inline'"],
        upgradeInsecureRequests: [],
      },
    },
  })
);

/**
 * Authentication routes
 */
// NOTE: MIDDLEWARE ROUTE - will either redirect to login or will call next() to allow static page to be served
routes.get('/auth', LAX_AuthRateLimit, desktopAppController.routeDefinition.initAuthMiddleware.controllerFn());

// API endpoint that /auth/desktop calls to get tokens to avoid having them defined in the HTML directly - this endpoint issues tokens
routes.get('/auth/session', STRICT_2X_AuthRateLimit, desktopAppController.routeDefinition.initSession.controllerFn());
// Validate authentication status from desktop app
routes.post('/auth/verify', STRICT_AuthRateLimit, desktopAppController.routeDefinition.verifyTokens.controllerFn());
routes.delete('/auth/logout', STRICT_AuthRateLimit, desktopAppController.routeDefinition.logout.controllerFn());

/**
 * Other Routes
 */
routes.get('/data-sync/pull', useExternalAuth, desktopAppController.routeDefinition.dataSyncPull.controllerFn());
routes.post('/data-sync/push', useExternalAuth, desktopAppController.routeDefinition.dataSyncPush.controllerFn());

export default routes;
