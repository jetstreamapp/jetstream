import { ENV } from '@jetstream/api-config';
import * as express from 'express';
import Router from 'express-promise-router';
import * as jsforce from 'jsforce';
import { initConnectionFromOAuthResponse } from '../controllers/oauth.controller';
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

    const conn = new jsforce.Connection({
      oauth2: {
        clientId: ENV.SFDC_CONSUMER_KEY,
        clientSecret: ENV.SFDC_CONSUMER_SECRET,
        loginUrl: E2E_LOGIN_URL,
      },
    });
    const userInfo = await conn.loginByOAuth2(E2E_LOGIN_USERNAME!, E2E_LOGIN_PASSWORD!);
    const salesforceOrg = await initConnectionFromOAuthResponse({
      conn,
      userInfo,
      loginUrl: E2E_LOGIN_URL!,
      userId: 'EXAMPLE_USER',
    });
    sendJson(res, salesforceOrg);
  }
);

export default routes;
