import { ADMIN_LOGIN_ERROR_PARAM, AdminLoginErrorCode } from '@jetstream/admin/types';
import { createRateLimit, getLogger } from '@jetstream/api-config';
import express, { type Response } from 'express';
import { ADMIN_ENV } from '../config/admin-env.config';
import { evaluateAdminSignIn, sanitizeReturnTo } from './admin-access';
import { clearOauthStateCookie, clearSessionCookie, readOauthStateCookie, setOauthStateCookie, setSessionCookie } from './admin-session';
import { requireAdminRequestHeader } from './auth.middleware';
import { completeGoogleAuthorization, createGoogleAuthorizationRequest } from './google-oauth';

export const authRoutes: express.Router = express.Router();

authRoutes.use(createRateLimit('admin-auth', { limit: 30 }));

function redirectToLoginWithError(res: Response, code: AdminLoginErrorCode) {
  res.redirect(`/login?${ADMIN_LOGIN_ERROR_PARAM}=${code}`);
}

authRoutes.get('/login', async (req, res, next) => {
  try {
    const { authorizationUrl, codeVerifier, state, nonce } = await createGoogleAuthorizationRequest();
    await setOauthStateCookie(res, { codeVerifier, state, nonce, returnTo: sanitizeReturnTo(req.query.returnTo) });
    res.redirect(authorizationUrl.href);
  } catch (ex) {
    next(ex);
  }
});

authRoutes.get('/callback', async (req, res) => {
  const oauthState = await readOauthStateCookie(req);
  clearOauthStateCookie(res);
  if (!oauthState) {
    redirectToLoginWithError(res, 'INVALID_STATE');
    return;
  }

  try {
    const callbackUrl = new URL(req.originalUrl, ADMIN_ENV.ADMIN_BASE_URL);
    const claims = await completeGoogleAuthorization(callbackUrl, oauthState);
    const decision = evaluateAdminSignIn(claims, {
      allowedDomain: ADMIN_ENV.ADMIN_ALLOWED_DOMAIN,
      allowedEmails: ADMIN_ENV.allowedEmails,
    });

    if (!decision.allowed) {
      getLogger().warn({ reason: decision.reason, ipAddress: req.ip }, '[ADMIN][AUTH] Sign-in rejected');
      redirectToLoginWithError(res, 'NOT_ALLOWED');
      return;
    }

    await setSessionCookie(res, decision.user);
    getLogger().info({ adminEmail: decision.user.email, ipAddress: req.ip }, '[ADMIN][AUTH] Signed in');
    res.redirect(oauthState.returnTo);
  } catch (ex) {
    getLogger().warn({ err: ex, ipAddress: req.ip }, '[ADMIN][AUTH] Google sign-in failed');
    redirectToLoginWithError(res, 'SIGN_IN_FAILED');
  }
});

authRoutes.post('/logout', requireAdminRequestHeader, (_, res) => {
  clearSessionCookie(res);
  res.status(204).end();
});
