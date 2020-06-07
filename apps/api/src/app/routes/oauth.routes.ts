import * as express from 'express';
import Router from 'express-promise-router';
import { logRoute } from './route.middleware';
import { salesforceOauthInitAuth, salesforceOauthCallback } from '../controllers/oauth.controller';

export const routes: express.Router = Router();

routes.use(logRoute);

routes.get('/sfdc/auth', salesforceOauthInitAuth);
routes.get('/sfdc/callback', salesforceOauthCallback);

export default routes;
