import { ENV, logger } from '@jetstream/api-config';
import { SalesforceOrgUi, SObjectOrganization, UserProfileServer } from '@jetstream/types';
import * as express from 'express';
import Router from 'express-promise-router';
import * as jsforce from 'jsforce';
import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import * as salesforceOrgsDb from '../db/salesforce-org.db';
import { createOrUpdateUser } from '../db/user.db';
import { getJsforceOauth2 } from '../utils/auth-utils';
import { UserFacingError } from '../utils/error-handler';
import { sendJson } from '../utils/response.handlers';
import { checkAuth } from './route.middleware';

export const routes: express.Router = Router();

const ALLOWED_TEST_EMAIL_ADDRESSES = new Set(['c6a5eb4f9003bbb091cb800b9e3298a3@test.com']);
const TEST_PASSWORD = '__test__';

function getTestUser(email: string): UserProfileServer {
  return {
    _json: {
      email,
      email_verified: 'true',
      [ENV.AUTH_AUDIENCE]: { featureFlags: { flagVersion: '', flags: ['ALL'], isDefault: false } },
      name: 'Test User',
      nickname: 'Test User',
      picture: null,
      sub: 'auth0|test',
      updated_at: new Date().toISOString(),
    } as any,
    _raw: '',
    id: 'auth0|test',
    displayName: 'Test User',
    emails: [{ value: email }],
    name: 'Test User',
    nickname: 'string',
    picture: 'string',
    provider: 'string',
    user_id: 'string',
  };
}

export function registerPassportTestLoginStrategy() {
  return new LocalStrategy({ usernameField: 'email' }, (username, password, done) => {
    if (!ALLOWED_TEST_EMAIL_ADDRESSES.has(username) || password !== TEST_PASSWORD) {
      return done(new UserFacingError('Invalid request'));
    }
    return done(null, getTestUser(username));
  });
}

/**
 * Create user in DB without actually logging in
 * This is used for cypress testing purposes to avoid having to actually login
 */
routes.post('/login', async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  try {
    // const email = req.body.email;
    // const user = getTestUser(email);
    // req.user = user;
    // TODO: do I do anything with the session?
    passport.authenticate('local', {}, async (err, user: UserProfileServer | false, info) => {
      try {
        if (err) {
          return next(new UserFacingError(err));
        } else if (!user) {
          return next(new UserFacingError('User was not found'));
        }
        req.logIn(user, async (err) => {
          if (err) {
            return next(new UserFacingError(err));
          }
          const userResponse = await createOrUpdateUser(user);
          logger.info('[AUTH][SUCCESS] Logged in %s', user._json.email, { userId: user.id });
          sendJson(res, userResponse);
        });
      } catch (ex) {
        logger.info('[TEST][ERROR][LOGIN][EX] %s %o', ex.status, ex.response?.body);
        next(new UserFacingError(ex));
      }
    })(req, res, next);
  } catch (ex) {
    logger.info('[TEST][ERROR][LOGIN][EX] %s %o', ex.status, ex.response?.body);
    const error = ex.response?.body?.detail || 'There was an error subscribing the request';
    next(new UserFacingError(error));
  }
});

routes.post('/orgs/init', checkAuth, async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  try {
    // if orgs exist, great - attempt to refresh token I guess?
    // otherwise create an org somehow (can we use username+password oauth2?)
    // does not support refresh token flow if username+password is used.... maybe just refresh it every time in DB?

    // {
    //   "access_token": "00D8b0000028Pp7!ARIAQAP15GuLWmlFD77Ml85fJXq1hTwrlmlVPz2RdZevgiTtKjIeP4ZQSuj7UtuCNmjJKZtSr1ONiNK4nfVg_G4_u4YnQmKT",
    //   "instance_url": "https://jetstream-e2e-dev-ed.my.salesforce.com",
    //   "id": "https://login.salesforce.com/id/00D8b0000028Pp7EAE/0058b00000FIaOTAA1",
    //   "token_type": "Bearer",
    //   "issued_at": "1650838091592",
    //   "signature": "Ta6LtafmPOSJP04SNKSDuRP24C8EWhSC/2XZCsoHtqA="
    // }

    const user = req.user as UserProfileServer;
    const { access_token: accessToken, instance_url: loginUrl } = req.body as {
      access_token: string;
      instance_url: string;
      id: string;
      token_type: string;
      issued_at: string;
      signature: string;
    };
    const conn = new jsforce.Connection({
      oauth2: getJsforceOauth2(loginUrl as string),
      instanceUrl: loginUrl,
      accessToken,
      maxRequest: 5,
      version: ENV.SFDC_FALLBACK_API_VERSION,
    });
    const identity = await conn.identity();

    let companyInfoRecord: SObjectOrganization;

    try {
      const results = await conn.query<SObjectOrganization>(
        `SELECT Id, Name, Country, OrganizationType, InstanceName, IsSandbox, LanguageLocaleKey, NamespacePrefix, TrialExpirationDate FROM Organization`
      );
      if (results.totalSize > 0) {
        companyInfoRecord = results.records[0];
      }
    } catch (ex) {
      logger.warn(ex);
    }

    const salesforceOrgUi: Partial<SalesforceOrgUi> = {
      uniqueId: `${identity.organization_id}-${identity.user_id}`,
      accessToken: salesforceOrgsDb.encryptAccessToken(conn.accessToken, 'refreshToken'),
      instanceUrl: conn.instanceUrl,
      loginUrl,
      userId: identity.user_id,
      email: identity.email,
      organizationId: identity.organization_id,
      username: identity.username,
      displayName: identity.display_name,
      thumbnail: identity.photos?.thumbnail,
      orgName: companyInfoRecord?.Name || 'Unknown Organization',
      orgCountry: companyInfoRecord?.Country,
      orgOrganizationType: companyInfoRecord?.OrganizationType,
      orgInstanceName: companyInfoRecord?.InstanceName,
      orgIsSandbox: companyInfoRecord?.IsSandbox,
      orgLanguageLocaleKey: companyInfoRecord?.LanguageLocaleKey,
      orgNamespacePrefix: companyInfoRecord?.NamespacePrefix,
      orgTrialExpirationDate: companyInfoRecord?.TrialExpirationDate,
    };

    const salesforceOrg = await salesforceOrgsDb.createOrUpdateSalesforceOrg(user.id, salesforceOrgUi);

    sendJson(res, salesforceOrg);
  } catch (ex) {
    next(new UserFacingError(ex));
  }
});

export default routes;
