import * as express from 'express';
import * as jsforce from 'jsforce';
import * as querystring from 'querystring';
import { encryptString, hexToBase64, getJsforceOauth2 } from '@jetstream/shared/node-utils';
import { SalesforceOrg, SObjectOrganization } from '@jetstream/types';

// prod/dev: 'https://login.salesforce.com',
// sandbox: 'https://test.salesforce.com',
// pre-release: 'https://prerellogin.pre.salesforce.com',

interface SfdcOauthState {
  loginUrl: string;
}
/**
 * Prepare SFDC auth and redirect to Salesforce
 * @param req
 * @param res
 */
export function salesforceOauthInitAuth(req: express.Request, res: express.Response) {
  const loginUrl = req.query.loginUrl as string;
  const clientUrl = req.query.clientUrl as string;
  const state = querystring.stringify({ loginUrl, clientUrl });

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
    const state = querystring.parse(req.query.state as string);
    const loginUrl = state.loginUrl as string;
    const clientUrl = state.clientUrl as string;
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
      console.warn(ex);
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

    const sfdcConnection: SalesforceOrg = {
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

    // TODO: figure out what other data we need
    // try {
    // TODO: what about if a user is assigned a permission set that gives PermissionsModifyAllData?
    //   const data = await getExtendedOrgInfo(conn, returnObject);
    //   returnObject = Object.assign({}, returnObject, data);
    // } catch (ex) {
    //   logger.debug('Error adding extended org data');
    // }

    // TODO: we need to return a web-page that will use something to send org details back to core app
    // https://stackoverflow.com/questions/28230845/communication-between-tabs-or-windows

    return res.redirect(`/oauth?${querystring.stringify(sfdcConnection)}&clientUrl=${clientUrl}`);
  } catch (ex) {
    console.log('[OAUTH][ERROR]', ex.message);
    const errorMsg = req.query.error_description ? req.query.error_description : 'There was an error authenticating Salesforce.';
    const errorObj = { message: errorMsg, error: ex.message };
    return res.redirect(`/oauth?${querystring.stringify(errorObj)}`);
  }
}
