/* eslint-disable @typescript-eslint/camelcase */
import { encryptString, getJsforceOauth2, hexToBase64 } from '@jetstream/shared/node-utils';
import { SalesforceOrgUi, SObjectOrganization, UserAuthSession } from '@jetstream/types';
import * as express from 'express';
import * as jsforce from 'jsforce';
import * as querystring from 'querystring';
import { logger } from '../config/logger.config';
import { SalesforceOrg } from '../db/entites/SalesforceOrg';
import { createOrUpdateSession, destroySession, getLoginUrl, getLogoutUrl, exchangeCodeForAccessToken } from '../services/auth';

interface CognitoResponse {
  access_token?: string;
  expires_in?: number;
  id_token?: string;
  refresh_token?: string;
  scope?: string;
  token_type?: any; // TODO:
  userId?: string;
}

interface SfdcOauthState {
  loginUrl: string;
}

export async function jetstreamOauthInitAuth(req: express.Request, res: express.Response) {
  res.redirect(getLoginUrl());
}

export async function jetstreamOauthLogin(req: express.Request, res: express.Response) {
  // TODO: figure out error handling
  const { code, state } = req.query;

  // const accessToken = await exchangeOAuthCodeForAccessToken(code as string);

  // Exchange oauth code for access token
  const accessToken = await exchangeCodeForAccessToken(code as string);

  createOrUpdateSession(req, accessToken);

  res.redirect(process.env.JETSTREAM_CLIENT_URL);
}

export async function jetstreamLogout(req: express.Request, res: express.Response) {
  destroySession(req);
  res.redirect(getLogoutUrl());
}

/**
 * Prepare SFDC auth and redirect to Salesforce
 * @param req
 * @param res
 */
export function salesforceOauthInitAuth(req: express.Request, res: express.Response) {
  const loginUrl = req.query.loginUrl as string;
  const clientUrl = req.query.clientUrl as string;
  const replaceOrgUniqueId = req.query.clientUrl as string | undefined;
  const state = querystring.stringify({ loginUrl, clientUrl, replaceOrgUniqueId });

  let options = {
    scope: 'full refresh_token',
    state,
    prompt: 'login',
  };

  if (req.query.username) {
    // eslint-disable-next-line @typescript-eslint/camelcase
    options = Object.assign(options, { login_hint: req.query.username });
  }

  res.redirect(getJsforceOauth2(loginUrl).getAuthorizationUrl(options));
}

/**
 * Prepare SFDC auth and redirect to Salesforce
 * @param req
 * @param res
 */
export async function salesforceOauthCallback(req: express.Request, res: express.Response) {
  try {
    const { userId } = req.session.auth as UserAuthSession;
    const state = querystring.parse(req.query.state as string);
    const loginUrl = state.loginUrl as string;
    const clientUrl = state.clientUrl as string;
    const replaceOrgUniqueId = state.replaceOrgUniqueId as string | undefined;

    // ERROR PATH
    if (req.query.error) {
      const errorMsg = req.query.error_description ? req.query.error_description : 'There was an error authenticating Salesforce.';
      const errorObj = { message: errorMsg, error: req.query.error };
      return res.redirect(`/oauth?${querystring.stringify(errorObj)}`);
    }

    const conn = new jsforce.Connection({ oauth2: getJsforceOauth2(loginUrl as string) });
    const userInfo = await conn.authorize(req.query.code as string);
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
      // TODO: do some basic things here to default as much of this as possible
      //   companyInfo = {
      //     name: companyInfoRecord.Name,
      //     country: companyInfoRecord.Country,
      //     organizationType: companyInfoRecord.OrganizationType,
      //     instanceName: companyInfoRecord.InstanceName,
      //     isSandbox: companyInfoRecord.IsSandbox,
      //     languageLocaleKey: companyInfoRecord.LanguageLocaleKey,
      //     namespacePrefix: companyInfoRecord.NamespacePrefix,
      //     trialExpirationDate: companyInfoRecord.TrialExpirationDate,
      // }
    }

    const orgName = companyInfoRecord?.Name || 'Unknown Organization';

    const salesforceOrgUi: SalesforceOrgUi = {
      uniqueId: `${userInfo.organizationId}-${userInfo.id}`,
      filterText: `${identity.username}${orgName}`.toLowerCase(),
      accessToken: encryptString(`${conn.accessToken} ${conn.refreshToken}`, hexToBase64(process.env.SFDC_CONSUMER_SECRET)),
      instanceUrl: conn.instanceUrl,
      loginUrl: state.loginUrl as string, // might also have conn.loginUrl
      userId: identity.user_id,
      email: identity.email,
      organizationId: identity.organization_id,
      username: identity.username,
      displayName: identity.display_name,
      thumbnail: identity.photos?.thumbnail,
      // TODO: default as much data as possible if undefined
      orgName,
      orgCountry: companyInfoRecord?.Country,
      orgOrganizationType: companyInfoRecord?.OrganizationType,
      orgInstanceName: companyInfoRecord?.InstanceName,
      orgIsSandbox: companyInfoRecord?.IsSandbox,
      orgLanguageLocaleKey: companyInfoRecord?.LanguageLocaleKey,
      orgNamespacePrefix: companyInfoRecord?.NamespacePrefix,
      orgTrialExpirationDate: companyInfoRecord?.TrialExpirationDate,
    };

    let salesforceOrg = await SalesforceOrg.findByUniqueId(userId, salesforceOrgUi.uniqueId);

    if (salesforceOrg) {
      salesforceOrg.initFromUiOrg(salesforceOrgUi);
    } else {
      salesforceOrg = new SalesforceOrg(userId, salesforceOrgUi);
    }

    // If org was being fixed but the id is different, delete the old org
    // This is useful for sandbox refreshes
    try {
      if (replaceOrgUniqueId && replaceOrgUniqueId !== salesforceOrg.uniqueId) {
        const oldSalesforceOrg = await SalesforceOrg.findByUniqueId(userId, replaceOrgUniqueId);
        if (oldSalesforceOrg) {
          await oldSalesforceOrg.remove();
        }
      }
    } catch (ex) {
      logger.warn(ex);
    }

    await salesforceOrg.save();

    // TODO: figure out what other data we need
    // try {
    // TODO: what about if a user is assigned a permission set that gives PermissionsModifyAllData?
    //   const data = await getExtendedOrgInfo(conn, returnObject);
    //   returnObject = Object.assign({}, returnObject, data);
    // } catch (ex) {
    //   logger.log('Error adding extended org data');
    // }

    // TODO: we need to return a web-page that will use something to send org details back to core app
    // https://stackoverflow.com/questions/28230845/communication-between-tabs-or-windows

    return res.redirect(`/oauth?${querystring.stringify(salesforceOrg)}&clientUrl=${clientUrl}`);
  } catch (ex) {
    logger.info('[OAUTH][ERROR] %o', ex.message);
    const errorMsg = req.query.error_description ? req.query.error_description : 'There was an error authenticating Salesforce.';
    const errorObj = { message: errorMsg, error: ex.message };
    return res.redirect(`/oauth?${querystring.stringify(errorObj)}`);
  }
}
