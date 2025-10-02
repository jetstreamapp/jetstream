import express, { Router } from 'express';
import { routeDefinition as billingController } from '../controllers/billing.controller';
import { checkAuth } from './route.middleware';

/**
 * Route Prefix: /api/billing
 */

const routes: express.Router = Router();

routes.use(checkAuth);

/**
 * ************************************
 * Billing Routes
 * ************************************
 */
routes.post('/checkout-session', billingController.createCheckoutSession.controllerFn());
routes.get('/checkout-session/:action', billingController.processCheckoutSuccess.controllerFn());
routes.get('/subscriptions', billingController.getSubscriptions.controllerFn());
routes.post('/portal', billingController.createBillingPortalSession.controllerFn());

export default routes;
