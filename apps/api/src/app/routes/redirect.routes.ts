import { ENV } from '@jetstream/api-config';
import { getCookieConfig } from '@jetstream/auth/server';
import { serialize } from 'cookie';
import * as express from 'express';
import Router from 'express-promise-router';
import { isString } from 'lodash';
import { UserFacingError } from '../utils/error-handler';

export const routes: express.Router = Router();

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

  if (
    !redirectUrl.startsWith('/') &&
    !redirectUrl.startsWith(ENV.JETSTREAM_CLIENT_URL) &&
    !redirectUrl.startsWith(ENV.JETSTREAM_SERVER_URL)
  ) {
    res.log.warn('Redirect URL is not a valid path or is an external URL:', redirectUrl);
    throw new UserFacingError('Invalid redirect URL', { redirectUrl });
  }

  // If the user is logged in, redirect them to desired redirectUrl
  if (isLoggedIn) {
    return res.redirect(redirectUrl);
  }

  const cookieConfig = getCookieConfig(ENV.USE_SECURE_COOKIES);
  res.appendHeader('Set-Cookie', serialize(cookieConfig.redirectUrl.name, redirectUrl, cookieConfig.redirectUrl.options));

  const params = new URLSearchParams();
  if (isString(email)) {
    params.append('email', email);
  }
  // Set cookie to handle team invite state so we can auto-join after sign up/login
  if (action === 'team-invite' && isString(teamId) && isString(token)) {
    res.appendHeader(
      'Set-Cookie',
      serialize(cookieConfig.teamInviteState.name, new URLSearchParams({ token, teamId }).toString(), cookieConfig.teamInviteState.options),
    );
  }

  res.redirect(`${ENV.JETSTREAM_SERVER_URL}/auth/login/?${params.toString()}`);
});

export default routes;
