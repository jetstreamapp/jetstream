import * as express from 'express';
import Router from 'express-promise-router';
import { routeDefinition as oauthController } from '../controllers/oauth.controller';
import { checkAuth } from './route.middleware';

export const routes: express.Router = Router();

// salesforce org authentication
routes.get('/sfdc/auth', checkAuth, oauthController.salesforceOauthInitAuth.controllerFn());
routes.get('/sfdc/callback', checkAuth, oauthController.salesforceOauthCallback.controllerFn());

export default routes;
