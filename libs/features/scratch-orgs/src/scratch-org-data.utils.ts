import { describeSObject, genericRequest, query, sobjectOperation } from '@jetstream/shared/data';
import { getErrorMessage } from '@jetstream/shared/utils';
import type { RecordResult, SalesforceOrgUi, ScratchOrgInfoRecord } from '@jetstream/types';
import type { DevHubScratchOrgLimits, NewScratchOrgUser, ScratchOrgProfileRecord, ScratchOrgUserRecord } from './scratch-org.types';
import { getUserAlias } from './scratch-org.utils';

/** The most scratch orgs that are listed, the newest are kept */
export const MAX_SCRATCH_ORGS = 2000;

/**
 * Fields that are shown when the running user can see them. `AuthCode` is deliberately absent, it is a credential
 * that is only ever read on the server.
 */
const SCRATCH_ORG_INFO_FIELDS = [
  'Id',
  'Name',
  'OrgName',
  'Edition',
  'Status',
  'ErrorCode',
  'ExpirationDate',
  'DurationDays',
  'ScratchOrg',
  'SignupUsername',
  'SignupEmail',
  'SignupInstance',
  'LoginUrl',
  'Namespace',
  'Features',
  'Description',
  'HasSampleData',
  'Release',
  'Snapshot',
  'SourceOrg',
  'LastLoginDate',
  'ConnectedAppCallbackUrl',
  'CreatedDate',
  'CreatedById',
] as const;

export class NotDevHubError extends Error {
  constructor() {
    super('This org is not a Dev Hub, or your user does not have access to its scratch orgs.');
    this.name = 'NotDevHubError';
  }
}

function assertAllSucceeded(results: RecordResult[], fallbackMessage: string) {
  const failures = results.flatMap((result) => (result.success ? [] : result.errors.map(({ message }) => message)));
  if (failures.length) {
    throw new Error(failures.join(' ') || fallbackMessage);
  }
}

/**
 * The ScratchOrgInfo fields this user can query. An org that does not have the object is not a Dev Hub
 * (or the user lacks the Salesforce DX permissions), which is reported as a NotDevHubError.
 */
async function getQueryableScratchOrgInfoFields(devHubOrg: SalesforceOrgUi): Promise<string[]> {
  let availableFields: Set<string>;
  try {
    const { data } = await describeSObject(devHubOrg, 'ScratchOrgInfo');
    if (!data.queryable) {
      throw new NotDevHubError();
    }
    availableFields = new Set(data.fields.map(({ name }) => name));
  } catch (ex) {
    if (ex instanceof NotDevHubError || /does not exist|NOT_FOUND|INVALID_TYPE/i.test(getErrorMessage(ex))) {
      throw new NotDevHubError();
    }
    throw ex;
  }
  const fields: string[] = SCRATCH_ORG_INFO_FIELDS.filter((field) => availableFields.has(field));
  if (availableFields.has('CreatedById')) {
    fields.push('CreatedBy.Name');
  }
  return fields;
}

export async function fetchScratchOrgs(
  devHubOrg: SalesforceOrgUi,
  { includeDeleted }: { includeDeleted: boolean },
): Promise<{ records: ScratchOrgInfoRecord[]; hasMore: boolean }> {
  const fields = await getQueryableScratchOrgInfoFields(devHubOrg);
  const where = includeDeleted ? '' : ` WHERE Status != 'Deleted'`;
  // One more than is shown, which is how we know that there are more
  const { queryResults } = await query<ScratchOrgInfoRecord>(
    devHubOrg,
    `SELECT ${fields.join(', ')} FROM ScratchOrgInfo${where} ORDER BY CreatedDate DESC LIMIT ${MAX_SCRATCH_ORGS + 1}`,
  );
  return {
    records: queryResults.records.slice(0, MAX_SCRATCH_ORGS),
    hasMore: queryResults.records.length > MAX_SCRATCH_ORGS || !queryResults.done,
  };
}

type LimitsResponse = Record<string, { Max: number; Remaining: number } | undefined>;

/** Scratch org allocations of the Dev Hub. These are a nice-to-have, so a failure is reported as "unknown" */
export async function fetchScratchOrgLimits(devHubOrg: SalesforceOrgUi): Promise<DevHubScratchOrgLimits> {
  try {
    const { ActiveScratchOrgs, DailyScratchOrgs } = await genericRequest<LimitsResponse>(devHubOrg, { method: 'GET', url: '/limits' });
    return {
      active: ActiveScratchOrgs ? { max: ActiveScratchOrgs.Max, remaining: ActiveScratchOrgs.Remaining } : null,
      daily: DailyScratchOrgs ? { max: DailyScratchOrgs.Max, remaining: DailyScratchOrgs.Remaining } : null,
    };
  } catch {
    return { active: null, daily: null };
  }
}

/**
 * Delete a scratch org the way the Salesforce CLI does, by deleting its ActiveScratchOrg record from the Dev Hub.
 * Salesforce then deletes the org and marks the ScratchOrgInfo as Deleted.
 *
 * A scratch org that never became active (it failed, or is stuck being created) has no ActiveScratchOrg, so its
 * ScratchOrgInfo request is deleted instead. That is never done for one that did become active: without its
 * ActiveScratchOrg the org would live on with nothing in the Dev Hub pointing at it.
 */
export async function deleteScratchOrg(
  devHubOrg: SalesforceOrgUi,
  { Id: scratchOrgInfoId, Status }: Pick<ScratchOrgInfoRecord, 'Id' | 'Status'>,
): Promise<void> {
  if (Status !== 'Active') {
    assertAllSucceeded(
      await sobjectOperation<'delete'>(devHubOrg, 'ScratchOrgInfo', 'delete', { ids: [scratchOrgInfoId] }),
      'Salesforce was unable to remove the scratch org request.',
    );
    return;
  }

  const { queryResults } = await query<{ Id: string }>(
    devHubOrg,
    `SELECT Id FROM ActiveScratchOrg WHERE ScratchOrgInfoId = '${scratchOrgInfoId}'`,
  );
  const activeScratchOrgIds = queryResults.records.map(({ Id }) => Id);
  if (!activeScratchOrgIds.length) {
    throw new Error(
      'The active scratch org record could not be found. It may already be deleted, or your user may not have access to Active Scratch Orgs in this Dev Hub.',
    );
  }

  assertAllSucceeded(
    await sobjectOperation<'delete'>(devHubOrg, 'ActiveScratchOrg', 'delete', { ids: activeScratchOrgIds }),
    'Salesforce was unable to delete the scratch org.',
  );
}

export async function fetchScratchOrgUsers(scratchOrg: SalesforceOrgUi): Promise<ScratchOrgUserRecord[]> {
  const { queryResults } = await query<ScratchOrgUserRecord>(
    scratchOrg,
    `SELECT Id, Name, Username, Email, IsActive, LastLoginDate, CreatedDate, Profile.Name FROM User WHERE UserType = 'Standard' ORDER BY CreatedDate ASC LIMIT 500`,
  );
  return queryResults.records;
}

export async function fetchScratchOrgProfiles(scratchOrg: SalesforceOrgUi): Promise<ScratchOrgProfileRecord[]> {
  const { queryResults } = await query<ScratchOrgProfileRecord>(
    scratchOrg,
    `SELECT Id, Name, UserLicense.Name FROM Profile WHERE UserType = 'Standard' ORDER BY Name ASC LIMIT 500`,
  );
  return queryResults.records;
}

interface UserLocaleRecord {
  TimeZoneSidKey: string;
  LocaleSidKey: string;
  EmailEncodingKey: string;
  LanguageLocaleKey: string;
}

/**
 * Create a user in a scratch org. The locale settings Salesforce requires are copied from the connected user,
 * which is what the Salesforce CLI does with the scratch org's admin user.
 *
 * @returns the id of the new user
 */
export async function createScratchOrgUser(scratchOrg: SalesforceOrgUi, user: NewScratchOrgUser): Promise<string> {
  const { queryResults } = await query<UserLocaleRecord>(
    scratchOrg,
    `SELECT TimeZoneSidKey, LocaleSidKey, EmailEncodingKey, LanguageLocaleKey FROM User WHERE Id = '${scratchOrg.userId}'`,
  );
  const [locale] = queryResults.records;
  if (!locale) {
    throw new Error('Unable to read the locale settings of the connected user.');
  }

  const [result] = await sobjectOperation<'create'>(scratchOrg, 'User', 'create', {
    records: [
      {
        FirstName: user.firstName.trim() || undefined,
        LastName: user.lastName.trim(),
        Email: user.email.trim(),
        Username: user.username.trim().toLowerCase(),
        Alias: getUserAlias(user.firstName, user.lastName),
        ProfileId: user.profileId,
        TimeZoneSidKey: locale.TimeZoneSidKey,
        LocaleSidKey: locale.LocaleSidKey,
        EmailEncodingKey: locale.EmailEncodingKey,
        LanguageLocaleKey: locale.LanguageLocaleKey,
      },
    ],
  });
  assertAllSucceeded(result ? [result] : [], 'Salesforce was unable to create the user.');
  if (!result?.success) {
    throw new Error('Salesforce was unable to create the user.');
  }
  return result.id;
}

/** Set a user's password without the old one or an email, which Salesforce allows for an admin through the API */
export async function setScratchOrgUserPassword(scratchOrg: SalesforceOrgUi, userId: string, password: string): Promise<void> {
  await genericRequest(scratchOrg, {
    method: 'POST',
    url: `/sobjects/User/${userId}/password`,
    body: { NewPassword: password },
  });
}
