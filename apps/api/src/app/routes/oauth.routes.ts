import * as express from 'express';
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
  passport.authenticate('auth0', {
    scope: 'openid email profile',
  }),
  authController.login
);
routes.get('/callback', authController.callback);
routes.get('/logout', authController.logout);

// salesforce org authentication
routes.get('/sfdc/auth', checkAuth, salesforceOauthInitAuth);
routes.get('/sfdc/callback', checkAuth, salesforceOauthCallback);

export default routes;
