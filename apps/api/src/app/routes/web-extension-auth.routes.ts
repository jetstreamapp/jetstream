import { createRateLimit, ENV } from '@jetstream/api-config';
import * as express from 'express';
import Router from 'express-promise-router';
import helmet from 'helmet';
import * as webExtensionController from '../controllers/web-extension.controller';

/**
 * Authentication routes
 */

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
        scriptSrc: ["'self'", (req, res) => `'nonce-${(res as any)?.locals?.nonce}'`],
        scriptSrcAttr: ["'none'"],
        styleSrc: ["'self'", 'https:', "'unsafe-inline'"],
        upgradeInsecureRequests: [],
      },
    },
  })
);

// NOTE: MIDDLEWARE ROUTE - will either redirect to login or will call next() to allow static page to be served
routes.get('/init', LAX_AuthRateLimit, webExtensionController.routeDefinition.initAuthMiddleware.controllerFn());

// API endpoint that /init calls to get tokens to avoid having them defined in the HTML directly - this endpoint issues tokens
routes.get('/session', STRICT_2X_AuthRateLimit, webExtensionController.routeDefinition.initSession.controllerFn());
// Validate authentication status from chrome extension
routes.post('/verify', STRICT_AuthRateLimit, webExtensionController.routeDefinition.verifyTokens.controllerFn());
routes.delete('/logout', STRICT_AuthRateLimit, webExtensionController.routeDefinition.logout.controllerFn());

export default routes;
