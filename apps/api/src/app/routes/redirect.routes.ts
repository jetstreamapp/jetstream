import { ENV } from '@jetstream/api-config';
import { getCookieConfig, validateRedirectUrl } from '@jetstream/auth/server';
import { stringifySetCookie } from 'cookie';
import * as express from 'express';
import { isString } from 'lodash';

export const routes = express.Router();

routes.get('/', (req, res, next) => {
  const action = req.query.action as 'team-invite' | undefined;
  const teamId = req.query.teamId;
  const token = req.query.token;
  const email = req.query.email;
  const redirectUrl = req.query.redirectUrl;

  // query params are not set, ignore, which should result in a 404
  if (!isString(redirectUrl)) {
    next();
    return;
  }
  const isLoggedIn = !!req.session.user;

  // Validate redirect URL to prevent open redirect attacks
  const safeRedirectUrl = validateRedirectUrl(redirectUrl, [ENV.JETSTREAM_CLIENT_URL, ENV.JETSTREAM_SERVER_URL], ENV.JETSTREAM_CLIENT_URL);

  // If validation changed the URL, log the attempted redirect
  if (safeRedirectUrl !== redirectUrl) {
    res.log.warn({ originalUrl: redirectUrl, validatedUrl: safeRedirectUrl }, '[SECURITY] Invalid redirect URL blocked');
  }

  // If the user is logged in, redirect them to desired redirectUrl
  if (isLoggedIn) {
    return res.redirect(safeRedirectUrl);
  }

  const cookieConfig = getCookieConfig(ENV.USE_SECURE_COOKIES);
  res.appendHeader('Set-Cookie', stringifySetCookie(cookieConfig.redirectUrl.name, safeRedirectUrl, cookieConfig.redirectUrl.options));

  const params = new URLSearchParams();
  if (isString(email)) {
    params.append('email', email);
  }
  // Set cookie to handle team invite state so we can auto-join after sign up/login
  if (action === 'team-invite' && isString(teamId) && isString(token)) {
    res.appendHeader(
      'Set-Cookie',
      stringifySetCookie(
        cookieConfig.teamInviteState.name,
        new URLSearchParams({ token, teamId }).toString(),
        cookieConfig.teamInviteState.options,
      ),
    );
  }

  res.redirect(`${ENV.JETSTREAM_SERVER_URL}/auth/login/?${params.toString()}`);
});

export default routes;
