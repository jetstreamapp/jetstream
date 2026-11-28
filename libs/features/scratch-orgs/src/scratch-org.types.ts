import type { ScratchOrgCreateRequestInput } from '@jetstream/api-types';
import type { Maybe, SalesforceOrgUi, ScratchOrgInfoRecord } from '@jetstream/types';

/**
 * What a scratch org's row communicates. `Creating` covers the New and Creating statuses, and `Expired` is an
 * active scratch org whose expiration date has passed but Salesforce has not removed yet.
 */
export type ScratchOrgDisplayStatus = 'Active' | 'Creating' | 'Error' | 'Expired' | 'Deleted';

/**
 * Jetstream's web and desktop apps each have a connected app. A scratch org is requested for one of them, and
 * Salesforce only lets that one connect to the scratch org without a password.
 */
export type ScratchOrgConnectedApp = 'web' | 'desktop';

export interface ScratchOrgRow extends ScratchOrgInfoRecord {
  displayStatus: ScratchOrgDisplayStatus;
  /** Whole days until the scratch org expires, negative once it has */
  daysRemaining: number | null;
  createdByName: string | null;
  /** The org in Jetstream that is connected to this scratch org, if there is one */
  connectedOrg: SalesforceOrgUi | null;
  /** Every connection to this scratch org, there is one per user that was connected */
  connectedOrgs: SalesforceOrgUi[];
  /**
   * The Jetstream app this scratch org was requested for, null when another tool (e.g. the Salesforce CLI) created it.
   * This is a hint for which action to offer, the server decides whether a connection is actually allowed.
   */
  createdWith: ScratchOrgConnectedApp | null;
  /**
   * Whether to offer the passwordless connection: the scratch org was requested for the app the user is in, and
   * Salesforce has not already refused it (the authorization code only works once).
   */
  canConnectWithoutPassword: boolean;
}

export interface DevHubScratchOrgLimits {
  active: { max: number; remaining: number } | null;
  daily: { max: number; remaining: number } | null;
}

export type ScratchOrgSettings = Record<string, unknown>;
export type ScratchOrgObjectSettings = Record<string, { sharingModel?: string; defaultRecordType?: string }>;

/** A scratch org definition split into what is stored on the ScratchOrgInfo record and what is deployed afterwards */
export interface ParsedScratchOrgDefinition {
  request: Partial<ScratchOrgCreateRequestInput>;
  settings: ScratchOrgSettings | null;
  objectSettings: ScratchOrgObjectSettings | null;
  /** Options that were ignored, shown to the user so nothing is silently dropped */
  warnings: string[];
}

export interface ScratchOrgUserRecord {
  Id: string;
  Name: string;
  Username: string;
  Email: string;
  IsActive: boolean;
  LastLoginDate: Maybe<string>;
  CreatedDate: string;
  Profile: Maybe<{ Name: Maybe<string> }>;
}

export interface ScratchOrgProfileRecord {
  Id: string;
  Name: string;
  UserLicense: Maybe<{ Name: Maybe<string> }>;
}

export interface NewScratchOrgUser {
  firstName: string;
  lastName: string;
  email: string;
  username: string;
  profileId: string;
}

/** Shown once after a password is generated, passwords are never stored */
export interface GeneratedCredentials {
  username: string;
  password: string;
  loginUrl: string;
}

/** Work to finish once Salesforce has created a scratch org that was requested from this page */
export interface PendingScratchOrg {
  scratchOrgInfoId: string;
  orgName: string;
  connect: boolean;
  settings: ScratchOrgSettings | null;
  objectSettings: ScratchOrgObjectSettings | null;
}
