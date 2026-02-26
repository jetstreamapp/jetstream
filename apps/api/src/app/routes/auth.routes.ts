import { createRateLimit } from '@jetstream/api-config';
import express, { Router } from 'express';
import * as authController from '../controllers/auth.controller';
import { rateLimitGetKeyGenerator, rateLimitGetMaxRequests } from '../utils/route.utils';
import { verifyCaptcha } from './route.middleware';

/**
 * Authentication routes
 */

export const LAX_AuthRateLimit = createRateLimit('auth_lax', {
  windowMs: 1000 * 60 * 1, // 1 minutes
  limit: rateLimitGetMaxRequests(25),
  keyGenerator: rateLimitGetKeyGenerator(),
});

const STRICT_AuthRateLimit = createRateLimit('auth_strict', {
  windowMs: 1000 * 60 * 5, // 5 minutes
  limit: rateLimitGetMaxRequests(20),
  keyGenerator: rateLimitGetKeyGenerator(),
});

const STRICT_2X_AuthRateLimit = createRateLimit('auth_strict_2x', {
  windowMs: 1000 * 60 * 15, // 15 minutes
  limit: rateLimitGetMaxRequests(10),
  keyGenerator: rateLimitGetKeyGenerator(),
});

export const routes: express.Router = Router();

routes.get('/logout', LAX_AuthRateLimit, authController.routeDefinition.logout.controllerFn());
// Get oauth provider information
routes.get('/providers', LAX_AuthRateLimit, authController.routeDefinition.getProviders.controllerFn());
// Get CSRF token
routes.get('/csrf', LAX_AuthRateLimit, authController.routeDefinition.getCsrfToken.controllerFn());
// Get session information (e.x. is logged in, is pending verification, etc - this drives UI)
routes.get('/session', LAX_AuthRateLimit, authController.routeDefinition.getSession.controllerFn());

// Init OAuth flow
routes.post('/signin/:provider', STRICT_AuthRateLimit, authController.routeDefinition.signin.controllerFn());
// Login via OAuth or credentials
routes.get('/callback/:provider', STRICT_AuthRateLimit, authController.routeDefinition.callback.controllerFn());
routes.post('/callback/:provider', STRICT_AuthRateLimit, verifyCaptcha, authController.routeDefinition.callback.controllerFn());
// 2FA and email verification
routes.post('/verify', STRICT_AuthRateLimit, authController.routeDefinition.verification.controllerFn());
routes.post('/verify/resend', STRICT_2X_AuthRateLimit, authController.routeDefinition.resendVerification.controllerFn());
// Request a password reset
routes.post(
  '/password/reset/init',
  STRICT_2X_AuthRateLimit,
  verifyCaptcha,
  authController.routeDefinition.requestPasswordReset.controllerFn(),
);
// Finish resetting password
routes.post('/password/reset/verify', STRICT_AuthRateLimit, authController.routeDefinition.validatePasswordReset.controllerFn());

// Get otp enrollment
routes.get('/2fa-otp/enroll', STRICT_AuthRateLimit, authController.routeDefinition.getOtpEnrollmentData.controllerFn());
// enroll otp factor
routes.post('/2fa-otp/enroll', STRICT_AuthRateLimit, authController.routeDefinition.enrollOtpFactor.controllerFn());

// SSO Discovery
routes.post('/sso/discover', STRICT_AuthRateLimit, authController.routeDefinition.discoverSso.controllerFn());
// Start SSO Login Flow for SAML or OIDC
routes.post('/sso/start', STRICT_AuthRateLimit, authController.routeDefinition.startSso.controllerFn());

// SAML Login Flow
routes.post('/sso/saml/:teamId/acs', STRICT_2X_AuthRateLimit, authController.routeDefinition.handleSamlCallback.controllerFn());
routes.get('/sso/saml/:teamId/metadata', LAX_AuthRateLimit, authController.routeDefinition.getSamlMetadata.controllerFn());

// OIDC Login Flow
routes.get('/sso/oidc/:teamId/callback', STRICT_2X_AuthRateLimit, authController.routeDefinition.handleOidcCallback.controllerFn());

export default routes;
