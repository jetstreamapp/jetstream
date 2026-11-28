import type { Maybe, SalesforceOrgUi, ScratchOrgInfoRecord } from '@jetstream/types';
import { differenceInCalendarDays } from 'date-fns/differenceInCalendarDays';
import { formatDate } from 'date-fns/format';
import { parseISO } from 'date-fns/parseISO';
import type { ScratchOrgConnectedApp, ScratchOrgDisplayStatus, ScratchOrgRow } from './scratch-org.types';

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

/** A scratch org can be connected as several of its users, the user it was created with is the one to open it as */
function pickPreferredOrg(connectedOrgs: SalesforceOrgUi[], { SignupUsername }: ScratchOrgInfoRecord): SalesforceOrgUi | null {
  return connectedOrgs.find(({ username }) => username === SignupUsername) ?? connectedOrgs[0] ?? null;
}

export function findConnectedOrg(record: ScratchOrgInfoRecord, orgs: SalesforceOrgUi[]): SalesforceOrgUi | null {
  return pickPreferredOrg(findConnectedOrgs(record, orgs), record);
}

/** @returns null for a missing or unreadable date, so that the field can be left out */
export function formatDateValue(value: string | null | undefined, dateFormat: string): string | null {
  if (!value) {
    return null;
  }
  const date = parseISO(value);
  return Number.isNaN(date.getTime()) ? null : formatDate(date, dateFormat);
}

const OAUTH_CALLBACK_PATH = '/oauth/sfdc/callback';
const DESKTOP_OAUTH_CALLBACK_URL = `jetstream://addOrg${OAUTH_CALLBACK_PATH}`;

/**
 * Jetstream requests scratch orgs with its own OAuth callback, which is the Jetstream server's on the web and a
 * `jetstream://` deep link on desktop.
 * @param serverUrl the Jetstream server the user is on, e.g. `https://getjetstream.app`
 */
export function getCreatedWith({ ConnectedAppCallbackUrl }: ScratchOrgInfoRecord, serverUrl: string): ScratchOrgConnectedApp | null {
  if (ConnectedAppCallbackUrl === DESKTOP_OAUTH_CALLBACK_URL) {
    return 'desktop';
  }
  return ConnectedAppCallbackUrl === `${serverUrl.replace(/\/+$/, '')}${OAUTH_CALLBACK_PATH}` ? 'web' : null;
}

const CONNECTED_APP_LABELS: Record<ScratchOrgConnectedApp, string> = {
  web: 'Jetstream web app',
  desktop: 'Jetstream desktop app',
};

/**
 * Why the passwordless connection is not offered for a scratch org, and what to do instead.
 * @param connectedApp the app the user is in
 */
export function getLoginGuidance(createdWith: ScratchOrgConnectedApp | null, connectedApp: ScratchOrgConnectedApp): string {
  const logInHere = 'To connect it here, log in with its username and password.';
  if (!createdWith) {
    return `This scratch org was created outside of Jetstream, and Salesforce only lets the tool that created a scratch org log in to it without a password. ${logInHere}`;
  }
  if (createdWith === connectedApp) {
    return `Salesforce only lets a scratch org be connected without a password once, and that is no longer possible for this one. ${logInHere}`;
  }
  return `This scratch org was requested for the ${CONNECTED_APP_LABELS[createdWith]}, which is the only place it can be connected without a password. ${logInHere}`;
}

export interface ScratchOrgRowOptions {
  /** The Jetstream app the user is in */
  connectedApp: ScratchOrgConnectedApp;
  /** The Jetstream server the user is on, its OAuth callback identifies the scratch orgs requested on the web */
  serverUrl: string;
  /** Ids of the ScratchOrgInfo records whose passwordless connection Salesforce refused, they fall back to a password */
  passwordlessRefusedIds?: ReadonlySet<string>;
  now?: Date;
}

export function toScratchOrgRows(
  records: ScratchOrgInfoRecord[],
  orgs: SalesforceOrgUi[],
  { connectedApp, serverUrl, passwordlessRefusedIds, now = new Date() }: ScratchOrgRowOptions,
): ScratchOrgRow[] {
  return records.map((record) => {
    const displayStatus = getDisplayStatus(record, now);
    const createdWith = getCreatedWith(record, serverUrl);
    // A deleted scratch org's id is never reused, but its connections in Jetstream are dead either way
    const connectedOrgs = displayStatus === 'Deleted' ? [] : findConnectedOrgs(record, orgs);
    return {
      ...record,
      displayStatus,
      daysRemaining: displayStatus === 'Active' || displayStatus === 'Expired' ? getDaysRemaining(record.ExpirationDate, now) : null,
      createdByName: record.CreatedBy?.Name ?? null,
      connectedOrg: pickPreferredOrg(connectedOrgs, record),
      connectedOrgs,
      createdWith,
      canConnectWithoutPassword: createdWith === connectedApp && !passwordlessRefusedIds?.has(record.Id),
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
