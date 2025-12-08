import { createRateLimit, ENV } from '@jetstream/api-config';
import express, { Router } from 'express';
import helmet from 'helmet';
import * as userFeedbackController from '../controllers/user-feedback.controller';
import * as webExtensionController from '../controllers/web-extension.controller';
import * as externalAuthService from '../services/external-auth.service';
import { feedbackRateLimit, feedbackUploadMiddleware } from './route.middleware';

function getMaxRequests(value: number) {
  return ENV.CI || ENV.ENVIRONMENT === 'development' ? 10000 : value;
}

export const LAX_AuthRateLimit = createRateLimit('web-ext_lax', {
  windowMs: 1000 * 60 * 1, // 1 minutes
  limit: getMaxRequests(25),
});

const STRICT_AuthRateLimit = createRateLimit('web-ext_strict', {
  windowMs: 1000 * 60 * 5, // 5 minutes
  limit: getMaxRequests(20),
});

const STRICT_2X_AuthRateLimit = createRateLimit('web-ext_strict_2x', {
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        scriptSrc: ["'self'", (_, res) => `'nonce-${(res as any)?.locals?.nonce}'`],
        scriptSrcAttr: ["'none'"],
        styleSrc: ["'self'", 'https:', "'unsafe-inline'"],
        upgradeInsecureRequests: [],
      },
    },
  }),
);

const authMiddleware = externalAuthService.getExternalAuthMiddleware(externalAuthService.AUDIENCE_WEB_EXT);

/**
 * Authentication routes
 */
// NOTE: MIDDLEWARE ROUTE - will either redirect to login or will call next() to allow static page to be served
routes.get('/init', LAX_AuthRateLimit, webExtensionController.routeDefinition.initAuthMiddleware.controllerFn());

// API endpoint that /init calls to get tokens to avoid having them defined in the HTML directly - this endpoint issues tokens
routes.get('/session', STRICT_2X_AuthRateLimit, webExtensionController.routeDefinition.initSession.controllerFn());
// Validate authentication status from browser extension
routes.post('/verify', STRICT_AuthRateLimit, webExtensionController.routeDefinition.verifyTokens.controllerFn());
routes.delete('/logout', STRICT_AuthRateLimit, webExtensionController.routeDefinition.logout.controllerFn());

/**
 * Other Routes
 */
routes.get('/data-sync/pull', authMiddleware, webExtensionController.routeDefinition.dataSyncPull.controllerFn());
routes.post('/data-sync/push', authMiddleware, webExtensionController.routeDefinition.dataSyncPush.controllerFn());

routes.post(
  '/feedback',
  feedbackRateLimit,
  authMiddleware,
  feedbackUploadMiddleware.array('screenshots', 5),
  userFeedbackController.sendUserFeedbackEmail,
);

export default routes;
