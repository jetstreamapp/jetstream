/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { ENV, logger } from '@jetstream/api-config';
import { ApiConnection, getApiRequestFactoryFn } from '@jetstream/salesforce-api';
import { salesforceLoginJwtBearer } from '@jetstream/salesforce-oauth';
import express, { Router } from 'express';
import { initConnectionFromOAuthResponse } from '../controllers/oauth.controller';
import { NotAllowedError } from '../utils/error-handler';
import { sendJson } from '../utils/response.handlers';

const routes: express.Router = Router();

routes.use((req, _, next) => {
  const E2E_LOGIN_URL = process.env.E2E_LOGIN_URL;
  const E2E_LOGIN_USERNAME = process.env.E2E_LOGIN_USERNAME;
  const SFDC_CI_CONSUMER_KEY = process.env.SFDC_CI_CONSUMER_KEY;
  const SFDC_CI_PRIVATE_KEY_BASE64 = process.env.SFDC_CI_PRIVATE_KEY_BASE64;

  if (
    !E2E_LOGIN_URL ||
    !E2E_LOGIN_USERNAME ||
    !SFDC_CI_PRIVATE_KEY_BASE64 ||
    !SFDC_CI_CONSUMER_KEY ||
    !ENV.EXAMPLE_USER ||
    req.hostname !== 'localhost'
  ) {
    return next(new NotAllowedError('Route not allowed in this environment'));
  }
  next();
});

/**
 * Create an org for the integration user to use in testing
 * Uses JWT bearer flow to avoid interactive browser login
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
routes.post('/e2e-integration-org', async (_: express.Request, res: express.Response, next: express.NextFunction) => {
  const E2E_LOGIN_URL = process.env.E2E_LOGIN_URL!;
  const E2E_LOGIN_USERNAME = process.env.E2E_LOGIN_USERNAME!;
  const SFDC_CI_CONSUMER_KEY = process.env.SFDC_CI_CONSUMER_KEY!;
  const privateKey = Buffer.from(process.env.SFDC_CI_PRIVATE_KEY_BASE64!, 'base64').toString('utf-8');

  const { id, access_token, instance_url } = await salesforceLoginJwtBearer({
    clientId: SFDC_CI_CONSUMER_KEY,
    privateKey,
    loginUrl: E2E_LOGIN_URL,
    username: E2E_LOGIN_USERNAME,
  });
  const [userId, organizationId] = new URL(id).pathname.split('/').reverse();

  logger.info({ organizationId, userId });

  const jetstreamConn = new ApiConnection({
    apiRequestAdapter: getApiRequestFactoryFn(fetch),
    userId,
    organizationId,
    accessToken: access_token,
    apiVersion: ENV.SFDC_API_VERSION,
    instanceUrl: instance_url,
    logging: false,
  });

  const salesforceOrg = await initConnectionFromOAuthResponse({
    jetstreamConn,
    userId: ENV.EXAMPLE_USER!.id,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sendJson(res as any, salesforceOrg);
});

export default routes;
