import { ENV, logger } from '@jetstream/api-config';
import { generateHMACDoubleCSRFToken, getCookieConfig } from '@jetstream/auth/server';
import type { UserProfileSession } from '@jetstream/auth/types';
import { ApiConnection, getApiRequestFactoryFn } from '@jetstream/salesforce-api';
import { salesforceLoginJwtBearer } from '@jetstream/salesforce-oauth';
import { HTTP } from '@jetstream/shared/constants';
import express, { Router } from 'express';
import { initConnectionFromOAuthResponse } from '../controllers/oauth.controller';
import { basicAuthMiddleware } from './route.middleware';

/**
 * Automated-scanner bootstrap endpoint.
 *
 * Returns a fully-authenticated session (cookie + CSRF token) so a scanner
 * (OWASP ZAP, Burp Suite, Nuclei, etc.) can skip the real login / MFA /
 * verification flow and focus on what it is actually scanning.
 *
 * The endpoint is triple-gated. All three must pass or the router 404s (or 401s
 * for missing basic auth). Any one failing alone is enough to deny access:
 *
 *   1. process.env.TEST_ENABLE_SCANNER_ROUTES === 'true' (opt-in, staging-only)
 *   2. JETSTREAM_SERVER_URL must not be the production URL (hardcoded deny)
 *   3. HTTP Basic auth against BASIC_AUTH_USERNAME / BASIC_AUTH_PASSWORD
 *
 * Sessions minted here are flagged with `isScannerSession = true`. That flag
 * only suppresses the User-Agent similarity guard in checkAuth (so a scanner
 * with a rotating UA does not destroy its own session). It does NOT disable
 * CSRF, session auth, or rate limiting.
 *
 * Staging-specific env vars (read directly from process.env to keep this file
 * self-contained; intentionally not in env-config.ts):
 *   - TEST_ENABLE_SCANNER_ROUTES      → router gate ('true' to enable)
 *   - TEST_SFDC_LOGIN_URL             → optional Salesforce login URL for org preload
 *   - TEST_SFDC_LOGIN_USERNAME        → optional JWT-bearer subject
 *   - TEST_SFDC_PRIVATE_KEY_BASE64    → optional JWT signing key (base64)
 */
const PRODUCTION_SERVER_URL = 'https://getjetstream.app';

const routes: express.Router = Router();

routes.use((_req, res, next) => {
  const scannerRoutesEnabled = String(process.env.TEST_ENABLE_SCANNER_ROUTES || '').toLowerCase() === 'true';
  if (!scannerRoutesEnabled || ENV.JETSTREAM_SERVER_URL === PRODUCTION_SERVER_URL) {
    return res.status(404).send('Not Found');
  }
  next();
});

routes.use(basicAuthMiddleware);

interface InitSessionResponse {
  sessionCookieName: string;
  csrfCookieName: string;
  csrfHeaderName: string;
  csrfToken: string;
  user: { id: string; email: string };
  org: { uniqueId: string } | null;
}

routes.post('/init-session', async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  try {
    if (!ENV.EXAMPLE_USER) {
      return res.status(500).json({ error: true, message: 'EXAMPLE_USER is not configured' });
    }

    const userAgent = req.get('User-Agent') || 'scanner';
    const exampleUser: UserProfileSession = {
      id: ENV.EXAMPLE_USER.id,
      userId: ENV.EXAMPLE_USER.userId,
      name: ENV.EXAMPLE_USER.name,
      email: ENV.EXAMPLE_USER.email,
      emailVerified: ENV.EXAMPLE_USER.emailVerified,
      tosAcceptedVersion: ENV.EXAMPLE_USER.tosAcceptedVersion ?? null,
      authFactors: ENV.EXAMPLE_USER.authFactors.map(({ type, enabled }) => ({
        type: type as UserProfileSession['authFactors'][number]['type'],
        enabled,
      })),
    };

    await new Promise<void>((resolve, reject) => {
      req.session.regenerate((error) => {
        if (error) {
          return reject(error);
        }
        req.session.user = exampleUser;
        req.session.userAgent = userAgent;
        req.session.loginTime = Date.now();
        req.session.provider = 'credentials';
        req.session.ipAddress = req.ip || '';
        req.session.pendingMfaEnrollment = undefined;
        req.session.pendingVerification = undefined;
        req.session.pendingTosAcceptance = undefined;
        req.session.isScannerSession = true;
        resolve();
      });
    });

    const cookieConfig = getCookieConfig(ENV.USE_SECURE_COOKIES);
    const csrfToken = generateHMACDoubleCSRFToken(ENV.JETSTREAM_SESSION_SECRET, req.session.id);
    res.cookie(cookieConfig.doubleCSRFToken.name, csrfToken, cookieConfig.doubleCSRFToken.options);

    let org: { uniqueId: string } | null = null;
    const { TEST_SFDC_LOGIN_URL, TEST_SFDC_LOGIN_USERNAME, TEST_SFDC_PRIVATE_KEY_BASE64 } = process.env;
    if (TEST_SFDC_LOGIN_URL && TEST_SFDC_LOGIN_USERNAME && TEST_SFDC_PRIVATE_KEY_BASE64 && ENV.SFDC_CONSUMER_KEY) {
      try {
        const privateKey = Buffer.from(TEST_SFDC_PRIVATE_KEY_BASE64, 'base64').toString('utf-8');
        const { id, access_token, instance_url } = await salesforceLoginJwtBearer({
          clientId: ENV.SFDC_CONSUMER_KEY,
          privateKey,
          loginUrl: TEST_SFDC_LOGIN_URL,
          username: TEST_SFDC_LOGIN_USERNAME,
        });
        const [jwtUserId, organizationId] = new URL(id).pathname.split('/').reverse();
        const jetstreamConn = new ApiConnection({
          apiRequestAdapter: getApiRequestFactoryFn(fetch),
          userId: jwtUserId,
          organizationId,
          accessToken: access_token,
          apiVersion: ENV.SFDC_API_VERSION,
          instanceUrl: instance_url,
          enableLogging: false,
          logger,
        });
        const salesforceOrg = await initConnectionFromOAuthResponse({
          jetstreamConn,
          userId: exampleUser.id,
        });
        org = { uniqueId: salesforceOrg.uniqueId };
      } catch (ex) {
        logger.warn({ err: ex }, '[SCANNER][INIT_SESSION] Optional Salesforce org preload failed');
      }
    }

    const response: InitSessionResponse = {
      sessionCookieName: 'sessionid',
      csrfCookieName: cookieConfig.doubleCSRFToken.name,
      csrfHeaderName: HTTP.HEADERS.X_CSRF_TOKEN,
      csrfToken,
      user: { id: exampleUser.id, email: exampleUser.email },
      org,
    };

    res.json(response);
  } catch (ex) {
    next(ex);
  }
});

export default routes;
