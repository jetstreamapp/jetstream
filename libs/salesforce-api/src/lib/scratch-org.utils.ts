import type { ScratchOrgCreateRequest } from '@jetstream/api-types';
import { SFDC_MY_DOMAIN_LOGIN_URL_REGEX } from '@jetstream/shared/constants';
import type { ScratchOrgInfoStatus } from '@jetstream/types';
import type { ApiConnection } from './connection';

/** The fields required to authorize a scratch org, the auth code is a credential and never leaves the server */
export interface ScratchOrgInfoAuthRecord {
  Id: string;
  Status: ScratchOrgInfoStatus;
  AuthCode: string | null;
  LoginUrl: string | null;
  SignupUsername: string | null;
  ConnectedAppConsumerKey: string | null;
  ConnectedAppCallbackUrl: string | null;
}

/**
 * Build the ScratchOrgInfo record for a scratch org request.
 *
 * The connected app is the one Jetstream itself uses to connect orgs. Salesforce authorizes it for the new scratch
 * org's admin user and stores an authorization code on the record, which is what allows the scratch org to be connected
 * without anyone knowing a password.
 */
export function buildScratchOrgInfoRecord(
  request: ScratchOrgCreateRequest,
  connectedApp: { consumerKey: string; callbackUrl: string },
): Record<string, string | number | boolean> {
  const record: Record<string, string | number | boolean | null | undefined> = {
    OrgName: request.orgName || 'Company',
    Edition: request.edition,
    DurationDays: request.durationDays,
    AdminEmail: request.adminEmail,
    Description: request.description,
    Features: request.features.length ? request.features.join(';') : undefined,
    HasSampleData: request.hasSampleData,
    Release: request.release,
    Country: request.country,
    Language: request.language,
    Username: request.username,
    Namespace: request.namespace,
    SourceOrg: request.sourceOrg,
    Snapshot: request.snapshot,
    ConnectedAppConsumerKey: connectedApp.consumerKey,
    ConnectedAppCallbackUrl: connectedApp.callbackUrl,
  };

  return Object.fromEntries(
    Object.entries(record).filter((entry): entry is [string, string | number | boolean] => entry[1] !== undefined && entry[1] !== null),
  );
}

export async function createScratchOrgInfo(
  devHubConn: ApiConnection,
  request: ScratchOrgCreateRequest,
  connectedApp: { consumerKey: string; callbackUrl: string },
): Promise<string> {
  const [result] = await devHubConn.sobject.recordOperation<'create'>({
    sobject: 'ScratchOrgInfo',
    operation: 'create',
    records: [buildScratchOrgInfoRecord(request, connectedApp)],
  });

  if (!result) {
    throw new Error('Salesforce did not return a result for the scratch org request');
  }
  if (!result.success) {
    throw new Error(result.errors.map(({ message }) => message).join(' ') || 'Salesforce rejected the scratch org request');
  }
  return result.id;
}

export async function getScratchOrgInfoForAuth(devHubConn: ApiConnection, scratchOrgInfoId: string): Promise<ScratchOrgInfoAuthRecord> {
  // The id is validated by the caller to be a Salesforce id, so it is safe to place in the query
  const { queryResults } = await devHubConn.query.query<ScratchOrgInfoAuthRecord>(
    `SELECT Id, Status, AuthCode, LoginUrl, SignupUsername, ConnectedAppConsumerKey, ConnectedAppCallbackUrl FROM ScratchOrgInfo WHERE Id = '${scratchOrgInfoId}'`,
  );
  const [record] = queryResults.records;
  if (!record) {
    throw new Error('The scratch org could not be found in this Dev Hub');
  }
  return record;
}

/**
 * The host a scratch org's auth code is exchanged with: its My Domain, held to the same pattern as a login url a
 * user enters when connecting an org. The client secret is sent there, so nothing else under salesforce.com qualifies.
 *
 * The Salesforce CLI prefers the instance host (e.g. cs42.salesforce.com) because a new My Domain can take a few
 * minutes to resolve. We deliberately do not: the code can only be redeemed once, and the tokens are of no use until
 * the My Domain resolves anyway. Exchanging with the My Domain means a scratch org that is not reachable yet fails
 * before the code is spent, so the connection can simply be attempted again.
 */
export function getScratchOrgAuthLoginUrl({ LoginUrl }: Pick<ScratchOrgInfoAuthRecord, 'LoginUrl'>): string | null {
  if (!LoginUrl) {
    return null;
  }
  try {
    const { origin, username, password } = new URL(LoginUrl);
    // The origin leaves out credentials, a url carrying them is not one Salesforce wrote
    return !username && !password && SFDC_MY_DOMAIN_LOGIN_URL_REGEX.test(origin) ? origin : null;
  } catch {
    return null;
  }
}

export type ScratchOrgAuthRequest = { blocker: string } | { blocker: null; authCode: string; loginUrl: string };

/**
 * What is needed to connect a scratch org with its auth code, or the reason (`blocker`) it cannot be.
 * Scratch orgs requested by another tool (e.g. the Salesforce CLI) carry a code that only that tool can redeem. The
 * connected app comparison only saves a pointless request, Salesforce is what binds the code to the app.
 */
export function getScratchOrgAuthRequest(
  record: ScratchOrgInfoAuthRecord,
  connectedApp: { consumerKey: string; callbackUrl: string },
): ScratchOrgAuthRequest {
  if (record.Status === 'Deleted') {
    return { blocker: 'This scratch org has been deleted or has expired.' };
  }
  if (record.Status === 'Error') {
    return { blocker: 'This scratch org failed to create.' };
  }
  if (record.Status !== 'Active') {
    return { blocker: 'This scratch org is still being created, try again once it is active.' };
  }
  if (record.ConnectedAppConsumerKey !== connectedApp.consumerKey || record.ConnectedAppCallbackUrl !== connectedApp.callbackUrl) {
    return {
      blocker:
        'This scratch org was created with a different application, so it can only be connected here by logging in with its username and password.',
    };
  }
  const loginUrl = getScratchOrgAuthLoginUrl(record);
  if (!record.AuthCode) {
    return { blocker: 'Salesforce did not provide an authorization code for this scratch org.' };
  }
  if (!loginUrl) {
    return { blocker: 'This scratch org does not have a valid login url.' };
  }
  return { blocker: null, authCode: record.AuthCode, loginUrl };
}
