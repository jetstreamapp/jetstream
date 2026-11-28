import type { Maybe, SalesforceOrgUi, ScratchOrgInfoRecord } from '@jetstream/types';
import { differenceInCalendarDays } from 'date-fns/differenceInCalendarDays';
import { parseISO } from 'date-fns/parseISO';
import type { ScratchOrgDisplayStatus, ScratchOrgRow } from './scratch-org.types';

/** Scratch orgs expiring within this many days are called out */
export const EXPIRING_SOON_DAYS = 2;

/**
 * Explanations for the signup error codes Salesforce stores on a failed ScratchOrgInfo.
 * https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_scratch_orgs_error_codes.htm
 */
const SIGNUP_ERROR_MESSAGES: Record<string, string> = {
  'C-1007': 'The username is already in use.',
  'C-1015': 'There was a problem registering the My Domain with the DNS provider. Try again.',
  'C-1016':
    'Salesforce could not configure and approve the connected app for the scratch org. Verify the connected app configuration with your Salesforce admin.',
  'C-1017': 'The namespace prefix is not valid.',
  'C-1020': 'The template in the definition could not be found.',
  'C-1027': 'The template in the definition is not supported. Use a generic edition such as Developer or Enterprise.',
  'C-1038': 'The scratch org could not establish trust with the Dev Hub for its External Client App. Try again.',
  'C-9999': 'A fatal signup error occurred. Try again, and contact Salesforce Support if it keeps happening.',
  'S-1006': 'The admin email address is not valid.',
  'S-1017': 'The namespace is not used by a release org linked to this Dev Hub.',
  'S-1018': 'The My Domain value is not valid.',
  'S-1019': 'The My Domain value is already in use.',
  'S-1026': 'The namespace is not valid.',
  'S-2006': 'The country code is not valid.',
  'S-9999': 'A fatal signup error occurred. Try again, and contact Salesforce Support if it keeps happening.',
  'SH-0001': 'The source org admin needs to add this Dev Hub in Setup > Org Shape before a scratch org can be created from its shape.',
  'SH-0002': 'No org shape exists for the source org. Create an org shape and try again.',
  'SH-0003': 'The org shape is outdated. Recreate the org shape and try again.',
  'T-0002': 'The template or snapshot in the definition could not be found.',
  'T-0003': 'The template in the definition has not been approved.',
  'T-0004': 'The Trialforce Source Organization for the template does not exist or has expired.',
};

export function getSignupErrorMessage(errorCode: Maybe<string>): string {
  if (!errorCode) {
    return 'Salesforce did not report why the scratch org could not be created.';
  }
  const message = SIGNUP_ERROR_MESSAGES[errorCode];
  return message ? `${message} (${errorCode})` : `Salesforce reported error code ${errorCode}.`;
}

export function getDaysRemaining(expirationDate: Maybe<string>, now = new Date()): number | null {
  if (!expirationDate) {
    return null;
  }
  const expiration = parseISO(expirationDate);
  return Number.isNaN(expiration.getTime()) ? null : differenceInCalendarDays(expiration, now);
}

export function getDisplayStatus({ Status, ExpirationDate }: ScratchOrgInfoRecord, now = new Date()): ScratchOrgDisplayStatus {
  switch (Status) {
    case 'New':
    case 'Creating':
      return 'Creating';
    case 'Error':
      return 'Error';
    case 'Deleted':
      return 'Deleted';
    default: {
      const daysRemaining = getDaysRemaining(ExpirationDate, now);
      return daysRemaining !== null && daysRemaining < 0 ? 'Expired' : 'Active';
    }
  }
}

export function getExpirationLabel(daysRemaining: number | null): string {
  if (daysRemaining === null) {
    return '';
  }
  if (daysRemaining < 0) {
    return 'Expired';
  }
  if (daysRemaining === 0) {
    return 'Expires today';
  }
  return daysRemaining === 1 ? '1 day left' : `${daysRemaining} days left`;
}

/**
 * ScratchOrgInfo stores the 15 character org id and Jetstream stores the 18 character one.
 * When more than one user of the scratch org is connected, the admin user it was created with is preferred.
 */
export function findConnectedOrgs({ ScratchOrg }: ScratchOrgInfoRecord, orgs: SalesforceOrgUi[]): SalesforceOrgUi[] {
  if (!ScratchOrg) {
    return [];
  }
  const scratchOrgId = ScratchOrg.slice(0, 15);
  return orgs.filter(({ organizationId }) => organizationId?.slice(0, 15) === scratchOrgId);
}

export function findConnectedOrg(record: ScratchOrgInfoRecord, orgs: SalesforceOrgUi[]): SalesforceOrgUi | null {
  const connectedOrgs = findConnectedOrgs(record, orgs);
  return connectedOrgs.find(({ username }) => username === record.SignupUsername) ?? connectedOrgs[0] ?? null;
}

/** Jetstream requests scratch orgs with its own OAuth callback, on the web (`/oauth/sfdc/callback`) and on desktop (`jetstream://`) */
export function isCreatedWithJetstream({ ConnectedAppCallbackUrl }: ScratchOrgInfoRecord): boolean {
  return (
    !!ConnectedAppCallbackUrl &&
    (ConnectedAppCallbackUrl.startsWith('jetstream://') || ConnectedAppCallbackUrl.endsWith('/oauth/sfdc/callback'))
  );
}

export function toScratchOrgRows(records: ScratchOrgInfoRecord[], orgs: SalesforceOrgUi[], now = new Date()): ScratchOrgRow[] {
  return records.map((record) => {
    const displayStatus = getDisplayStatus(record, now);
    // A deleted scratch org's id is never reused, but its connections in Jetstream are dead either way
    const connectedOrgs = displayStatus === 'Deleted' ? [] : findConnectedOrgs(record, orgs);
    return {
      ...record,
      displayStatus,
      daysRemaining: displayStatus === 'Active' || displayStatus === 'Expired' ? getDaysRemaining(record.ExpirationDate, now) : null,
      createdByName: record.CreatedBy?.Name ?? null,
      connectedOrg: connectedOrgs.find(({ username }) => username === record.SignupUsername) ?? connectedOrgs[0] ?? null,
      connectedOrgs,
      createdWithJetstream: isCreatedWithJetstream(record),
    };
  });
}

export function isScratchOrgPending({ Status }: Pick<ScratchOrgInfoRecord, 'Status'>): boolean {
  return Status === 'New' || Status === 'Creating';
}

const PASSWORD_LOWER = 'abcdefghijkmnopqrstuvwxyz';
const PASSWORD_UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const PASSWORD_NUMBERS = '23456789';
const PASSWORD_SYMBOLS = '!@#$%^&*()_-[]';

function getRandomIndex(length: number): number {
  // Rejection sampling so every index is equally likely
  const limit = Math.floor(0x100000000 / length) * length;
  const buffer = new Uint32Array(1);
  do {
    crypto.getRandomValues(buffer);
  } while (buffer[0] >= limit);
  return buffer[0] % length;
}

/**
 * A random password with at least one character of every class, which satisfies every Salesforce password complexity
 * policy (an org that requires more than 16 characters needs a longer one). Look-alike characters (l, I, O, 0, 1) are left out because these are read off the screen.
 */
export function generatePassword(length = 16): string {
  const characterSets = [PASSWORD_LOWER, PASSWORD_UPPER, PASSWORD_NUMBERS, PASSWORD_SYMBOLS];
  const allCharacters = characterSets.join('');
  const characters = characterSets.map((characterSet) => characterSet[getRandomIndex(characterSet.length)]);
  while (characters.length < length) {
    characters.push(allCharacters[getRandomIndex(allCharacters.length)]);
  }
  // Fisher-Yates shuffle so the guaranteed characters are not always at the start
  for (let i = characters.length - 1; i > 0; i--) {
    const swapIndex = getRandomIndex(i + 1);
    [characters[i], characters[swapIndex]] = [characters[swapIndex], characters[i]];
  }
  return characters.join('');
}

/** Salesforce requires an alias of at most 8 characters, the CLI derives it the same way */
export function getUserAlias(firstName: string, lastName: string): string {
  const alias = `${firstName.trim().slice(0, 1)}${lastName.trim()}`.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8);
  return alias || 'user';
}
