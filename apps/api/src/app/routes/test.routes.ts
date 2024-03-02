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
    const E2E_LOGIN_URL = process.env.E2E_LOGIN_URL!;

    const { id, access_token, instance_url } = await salesforceLoginUsernamePassword_UNSAFE(
      E2E_LOGIN_URL,
      E2E_LOGIN_USERNAME!,
      E2E_LOGIN_PASSWORD!
    );
    const [userId, organizationId] = new URL(id).pathname.split('/').reverse();

    console.log({ organizationId, userId });

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
      userId: 'EXAMPLE_USER',
    });

    sendJson(res, salesforceOrg);
  }
);

export default routes;
