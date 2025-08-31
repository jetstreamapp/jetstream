import { createRateLimit, ENV } from '@jetstream/api-config';
import express, { Router } from 'express';
import helmet from 'helmet';
import * as desktopAppController from '../controllers/desktop-app.controller';
import * as externalAuthService from '../services/external-auth.service';

function getMaxRequests(value: number) {
  return ENV.CI || ENV.ENVIRONMENT === 'development' ? 10000 : value;
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

const authMiddleware = externalAuthService.getExternalAuthMiddleware(externalAuthService.AUDIENCE_DESKTOP);

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
routes.get('/data-sync/pull', authMiddleware, desktopAppController.routeDefinition.dataSyncPull.controllerFn());
routes.post('/data-sync/push', authMiddleware, desktopAppController.routeDefinition.dataSyncPush.controllerFn());

routes.get('/v1/notifications', STRICT_2X_AuthRateLimit, desktopAppController.routeDefinition.notifications.controllerFn());

export default routes;
