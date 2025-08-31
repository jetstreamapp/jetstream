import { raw } from 'body-parser';
import express, { Router } from 'express';
import { routeDefinition as billingController } from '../controllers/billing.controller';

const routes: express.Router = Router();

routes.use(raw({ type: 'application/json' }));

routes.post('/stripe', billingController.webhook.controllerFn());

export default routes;
