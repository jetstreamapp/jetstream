import { createRateLimit } from '@jetstream/api-config';
import { raw } from 'body-parser';
import express, { Router } from 'express';
import { routeDefinition as billingController } from '../controllers/billing.controller';
import { routeDefinition as mailgunWebhookController } from '../controllers/mailgun-webhook.controller';
import { rateLimitGetKeyGenerator, rateLimitGetMaxRequests } from '../utils/route.utils';

const routes: express.Router = Router();

const webhookRateLimit = createRateLimit('webhook', {
  windowMs: 1000 * 60 * 1, // 1 minute
  limit: rateLimitGetMaxRequests(1000),
  keyGenerator: rateLimitGetKeyGenerator(),
});

routes.use(raw({ type: 'application/json' }));

routes.post('/stripe', webhookRateLimit, billingController.webhook.controllerFn());
routes.post('/mailgun', webhookRateLimit, mailgunWebhookController.webhook.controllerFn());

export default routes;
