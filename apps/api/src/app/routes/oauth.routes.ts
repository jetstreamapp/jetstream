import * as express from 'express';
import Router from 'express-promise-router';
import {
  jetstreamOauthLogin,
  jetstreamOauthInitAuth,
  salesforceOauthCallback,
  salesforceOauthInitAuth,
  jetstreamLogout,
} from '../controllers/oauth.controller';
import { checkAuth } from './route.middleware';

export const routes: express.Router = Router();

// jetstream authentication
routes.get('/login', jetstreamOauthInitAuth); // redirects to auth server
routes.get('/callback', jetstreamOauthLogin); // callback from oauth
routes.get('/logout', jetstreamLogout);

// salesforce org authentication
routes.get('/sfdc/auth', checkAuth, salesforceOauthInitAuth);
routes.get('/sfdc/callback', checkAuth, salesforceOauthCallback);

export default routes;
