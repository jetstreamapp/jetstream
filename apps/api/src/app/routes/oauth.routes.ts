import * as express from 'express';
import Router from 'express-promise-router';
import * as passport from 'passport';
import * as authController from '../controllers/auth.controller';
import * as oauthController from '../controllers/oauth.controller';
import { checkAuth } from './route.middleware';

export const routes: express.Router = Router();

routes.get('/signup', oauthController.signup);
routes.get('/login', oauthController.login);
routes.get('/logout', oauthController.logout);
routes.get('/callback', oauthController.callback);

// FIXME: figure out how to do this
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
routes.get('/sfdc/auth', checkAuth, oauthController.salesforceOauthInitAuth);
routes.get('/sfdc/callback', checkAuth, oauthController.salesforceOauthCallback);

export default routes;
