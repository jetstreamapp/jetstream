import { ENV } from '@jetstream/api-config';
import express from 'express';
import Router from 'express-promise-router';
import * as passport from 'passport';
import * as authController from '../controllers/auth.controller';
import { salesforceOauthCallback, salesforceOauthInitAuth } from '../controllers/oauth.controller';
import { checkAuth } from './route.middleware';

export const routes: express.Router = Router();

// https://auth0.com/docs/universal-login/new-experience#signup
routes.get(
  '/signup',
  passport.authenticate('auth0', {
    scope: 'openid email profile',
    screen_hint: 'signup',
  } as any),
  authController.login
);

routes.get(
  '/login',
  passport.authenticate(
    ['custom', 'auth0'].filter((item) => item === 'auth0' || (ENV.EXAMPLE_USER_OVERRIDE && ENV.EXAMPLE_USER)),
    {
      scope: 'openid email profile',
    }
  ),
  authController.login
);
routes.get('/callback', authController.callback);
routes.get('/logout', authController.logout);

// Link additional accounts
routes.get('/identity/link', (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const options: passport.AuthenticateOptions & { connection?: string } = {
    scope: 'openid email profile',
    prompt: 'select_account',
  };

  if (req.query.connection) {
    options.connection = req.query.connection as string;
  }
  passport.authorize('auth0-authz', options as any)(req, res, next);
});
routes.get('/identity/link/callback', authController.linkCallback);

// salesforce org authentication
routes.get('/sfdc/auth', checkAuth, salesforceOauthInitAuth);
routes.get('/sfdc/callback', checkAuth, salesforceOauthCallback);

export default routes;
