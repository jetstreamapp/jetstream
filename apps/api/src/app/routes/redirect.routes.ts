import { ENV, logger } from '@jetstream/api-config';
import { getCookieConfig } from '@jetstream/auth/server';
import { serialize } from 'cookie';
import * as express from 'express';
import Router from 'express-promise-router';
import { isString } from 'lodash';
import { UserFacingError } from '../utils/error-handler';

export const routes: express.Router = Router();

routes.get('/', (req, res, next) => {
  const redirectUrl = req.query.redirectUrl;
  const email = req.query.email;

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
    logger.warn('Redirect URL is not a valid path or external URL:', redirectUrl);
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

  res.redirect(`${ENV.JETSTREAM_SERVER_URL}/auth/login/?${params.toString()}`);
});

export default routes;
