import express, { Router } from 'express';
import { routeDefinition as oauthController } from '../controllers/oauth.controller';
import { checkAuth, verifyWebAppAllowed } from './route.middleware';

export const routes: express.Router = Router();

// salesforce org authentication
routes.get('/sfdc/auth', checkAuth, verifyWebAppAllowed, oauthController.salesforceOauthInitAuth.controllerFn());
routes.get('/sfdc/callback', checkAuth, verifyWebAppAllowed, oauthController.salesforceOauthCallback.controllerFn());

export default routes;
