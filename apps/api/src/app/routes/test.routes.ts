import { ENV } from '@jetstream/api-config';
import { ApiConnection, getApiRequestFactoryFn } from '@jetstream/salesforce-api';
import * as express from 'express';
import Router from 'express-promise-router';
import { initConnectionFromOAuthResponse } from '../controllers/oauth.controller';
import { salesforceLoginUsernamePassword_UNSAFE } from '../services/oauth.service';
import { NotAllowedError } from '../utils/error-handler';
import { sendJson } from '../utils/response.handlers';

const routes: express.Router = Router();

/**
 * Create an org for the integration user to use in testing
 * this avoids the need to perform oauth for integration test environment
 */
routes.post(
  '/e2e-integration-org',
  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const E2E_LOGIN_USERNAME = process.env.E2E_LOGIN_USERNAME;
    const E2E_LOGIN_PASSWORD = process.env.E2E_LOGIN_PASSWORD;
    const E2E_LOGIN_URL = process.env.E2E_LOGIN_URL;

    if (
      // && ENV.ENVIRONMENT === 'test'
      E2E_LOGIN_USERNAME &&
      E2E_LOGIN_PASSWORD &&
      E2E_LOGIN_URL &&
      ENV.EXAMPLE_USER_OVERRIDE &&
      ENV.EXAMPLE_USER &&
      req.hostname === 'localhost'
    ) {
      req.user = ENV.EXAMPLE_USER;
      return next();
    }
    return next(new NotAllowedError('Route not allowed in this environment'));
  },
  async (req: express.Request, res: express.Response) => {
    const E2E_LOGIN_USERNAME = process.env.E2E_LOGIN_USERNAME;
    const E2E_LOGIN_PASSWORD = process.env.E2E_LOGIN_PASSWORD;
    const E2E_LOGIN_URL = process.env.E2E_LOGIN_URL;

    const result = await salesforceLoginUsernamePassword_UNSAFE(E2E_LOGIN_URL, E2E_LOGIN_USERNAME!, E2E_LOGIN_PASSWORD!);
    const [userId, organizationId] = result.id.split('/');

    const jetstreamConn = new ApiConnection({
      apiRequestAdapter: getApiRequestFactoryFn(fetch),
      userId: 'EXAMPLE_USER',
      organizationId,
      accessToken: result.access_token,
      apiVersion: ENV.SFDC_API_VERSION,
      instanceUrl: E2E_LOGIN_URL,
      refreshToken: result.refresh_token,
    });

    const salesforceOrg = await initConnectionFromOAuthResponse({
      jetstreamConn,
      userId: 'EXAMPLE_USER',
    });

    sendJson(res, salesforceOrg);
  }
);

export default routes;
