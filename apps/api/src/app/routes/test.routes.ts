/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { ENV, logger } from '@jetstream/api-config';
import { ApiConnection, getApiRequestFactoryFn } from '@jetstream/salesforce-api';
import express, { Router } from 'express';
import { initConnectionFromOAuthResponse } from '../controllers/oauth.controller';
import { salesforceLoginUsernamePassword_UNSAFE } from '../services/oauth.service';
import { NotAllowedError } from '../utils/error-handler';
import { sendJson } from '../utils/response.handlers';

const routes: express.Router = Router();

routes.use((req, res, next) => {
  const E2E_LOGIN_URL = process.env.E2E_LOGIN_URL;
  const E2E_LOGIN_USERNAME = process.env.E2E_LOGIN_USERNAME;
  const E2E_LOGIN_PASSWORD = process.env.E2E_LOGIN_PASSWORD;

  if (!E2E_LOGIN_URL || !E2E_LOGIN_USERNAME || !E2E_LOGIN_PASSWORD || !ENV.EXAMPLE_USER || req.hostname !== 'localhost') {
    return next(new NotAllowedError('Route not allowed in this environment'));
  }
  next();
});

/**
 * Create an org for the integration user to use in testing
 * this avoids the need to perform oauth for integration test environment
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
routes.post('/e2e-integration-org', async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const E2E_LOGIN_URL = process.env.E2E_LOGIN_URL!;
  const E2E_LOGIN_USERNAME = process.env.E2E_LOGIN_USERNAME!;
  const E2E_LOGIN_PASSWORD = process.env.E2E_LOGIN_PASSWORD!;

  const { id, access_token, instance_url } = await salesforceLoginUsernamePassword_UNSAFE(
    E2E_LOGIN_URL,
    E2E_LOGIN_USERNAME,
    E2E_LOGIN_PASSWORD,
  );
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
