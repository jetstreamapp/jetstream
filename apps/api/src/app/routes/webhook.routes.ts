import { raw } from 'body-parser';
import express from 'express';
import Router from 'express-promise-router';
import { routeDefinition as billingController } from '../controllers/billing.controller';

const routes: express.Router = Router();

routes.use(raw({ type: 'application/json' }));

routes.post('/stripe', billingController.webhook.controllerFn());

export default routes;
