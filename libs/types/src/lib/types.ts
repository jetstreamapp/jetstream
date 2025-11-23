import type { Query } from '@jetstreamapp/soql-parser-js';
import { z } from 'zod';
import { JetstreamPricesByLookupKey, StripeUserFacingCustomer } from './billing.types';
import { SalesforceOrgEdition } from './salesforce/misc.types';
import { QueryResult } from './salesforce/query.types';
import { InsertUpdateUpsertDeleteQuery } from './salesforce/record.types';
import { TeamBillingStatusSchema, TeamMemberRoleSchema, TeamMemberStatusSchema } from './team.types';

export interface AppInfo {
  announcements: Announcement[];
  appInfo: ApplicationState;
  version: string;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  replacementDates: { key: string; value: string }[];
  expiresAt: string;
  createdAt: string;
}

export type CopyAsDataType = 'excel' | 'csv' | 'json';

export interface RequestResult<T> {
  data: T;
}

export interface QueryResults<T = unknown> {
  queryResults: QueryResult<T>;
  columns?: QueryResultsColumns;
  parsedQuery?: Query;
}

export interface QueryResultsColumns {
  entityName: string;
  groupBy: boolean;
  idSelected: boolean;
  keyPrefix: string;
  columns?: QueryResultsColumn[];
}

export interface QueryResultsColumn {
  columnFullPath: string;
  aggregate: boolean;
  apexType: string | null;
  booleanType: boolean;
  columnName: string;
  custom: boolean;
  displayName: string;
  foreignKeyName: string | null;
  insertable: boolean;
  numberType: boolean;
  textType: boolean;
  updatable: boolean;
  childColumnPaths?: QueryResultsColumn[];
}

export type Maybe<T> = T | null | undefined;
export type Nullable<T> = T | null;

export const isNotNullish = <T>(input: T | null | undefined): input is T => input != null;
export const isNotEmpty = <T>(input: T[]) => input.length !== 0;

export interface ApiResponse<T = unknown> {
  data: T;
  cache?: CacheItem;
}

export type OrgCacheItem<T> = Record<string, CacheItemWithData<T>>;

export interface CacheItem {
  key: string;
  exp: number;
  age: number;
}

export interface CacheItemWithData<T> extends CacheItem {
  data: T;
}

export type Production = 'production';
export type Test = 'test';
export type Development = 'development';
export type Environment = Production | Test | Development;

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface ApplicationState {
  serverUrl: string;
  environment: Environment;
  defaultApiVersion: string;
  google_appId: string;
  google_apiKey: string;
  google_clientId: string;
}

export interface AuthenticationToken {
  access_token?: string;
  refresh_token?: string;
  id_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: 'Bearer';
}

export interface UserProfilePreferences {
  deniedNotifications?: boolean;
}

const PreferencesSchema = z.object({
  skipFrontdoorLogin: z.boolean().default(false),
  recordSyncEnabled: z.boolean().default(false),
});

const EntitlementsSchema = z.object({
  googleDrive: z.boolean().default(false),
  chromeExtension: z.boolean().default(false),
  desktop: z.boolean().default(false),
  recordSync: z.boolean().default(false),
});

export const UserProfileUiSchema = z.object({
  id: z.string(),
  /** @deprecated */
  userId: z.string().optional(),
  email: z.string(),
  name: z.string(),
  emailVerified: z.boolean().default(false),
  picture: z.string().nullish(),
  preferences: PreferencesSchema.nullable()
    .prefault({})
    .transform((preferences) => (!preferences ? PreferencesSchema.parse({}) : preferences)),
  billingAccount: z.object({ customerId: z.string() }).nullish(),
  entitlements: EntitlementsSchema.nullable()
    .prefault({})
    .transform((entitlement) => (!entitlement ? EntitlementsSchema.parse({}) : entitlement)),
  subscriptions: z
    .array(
      z.object({
        id: z.string(),
        productId: z.string().nullish(),
        subscriptionId: z.string(),
        priceId: z.string(),
        status: z.enum(['ACTIVE', 'CANCELED', 'INCOMPLETE', 'INCOMPLETE_EXPIRED', 'PAST_DUE', 'PAUSED', 'TRIALING', 'UNPAID']),
      }),
    )
    .default([]),
  teamMembership: z
    .object({
      role: TeamMemberRoleSchema,
      status: TeamMemberStatusSchema,
      team: z.object({
        id: z.string(),
        name: z.string(),
        billingStatus: TeamBillingStatusSchema,
      }),
    })
    .nullish(),
});

export type UserProfileUi = z.infer<typeof UserProfileUiSchema>;

export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_NUMBER_AND_SPECIAL_CHAR_REGEX = /[0-9!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/;
export const PasswordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`)
  .max(255, `Password must be at most 255 characters`)
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(PASSWORD_NUMBER_AND_SPECIAL_CHAR_REGEX, 'Password must contain at least one number or special character')
  .refine((pwd) => !/(.)\1{3,}/.test(pwd), {
    message: 'Password cannot contain more than 3 repeating characters',
  });

export interface SubscriptionsResponse {
  customer: StripeUserFacingCustomer | null;
  pricesByLookupKey: JetstreamPricesByLookupKey | null;
  hasManualBilling: boolean;
  didUpdate: boolean;
  userProfile?: Maybe<UserProfileUi>;
}

export interface SalesforceUserInfo {
  sub: string;
  user_id: string;
  organization_id: string;
  preferred_username: string;
  nickname: string;
  name: string;
  email: string;
  email_verified: boolean;
  given_name: string;
  family_name: string;
  zoneinfo: string;
  photos: {
    picture: string;
    thumbnail: string;
  };
  profile: string;
  picture: string;
  address: any;
  is_salesforce_integration_user: boolean;
  urls: {
    enterprise: string;
    metadata: string;
    partner: string;
    rest: string;
    sobjects: string;
    search: string;
    query: string;
    recent: string;
    tooling_soap: string;
    tooling_rest: string;
    profile: string;
    feeds: string;
    groups: string;
    users: string;
    feed_items: string;
    feed_elements: string;
    custom_domain: string;
  };
  active: boolean;
  user_type: string;
  language: string;
  locale: string;
  utcOffset: number;
  updated_at: string;
  is_app_installed: boolean;
}

export interface CloudinarySignature {
  signature: string;
  timestamp: number;
  cloudName: string;
  apiKey: string;
  context: string;
}

export interface CloudinaryUploadResponse {
  access_mode: string;
  api_key: string;
  asset_id: string;
  bytes: number;
  created_at: string;
  delete_token: string;
  etag: string;
  format: string;
  height: number;
  placeholder: boolean;
  public_id: string;
  resource_type: string;
  secure_url: string;
  signature: string;
  tags: string[];
  type: string;
  url: string;
  version_id: string;
  version: number;
  width: number;
}

export interface SalesforceOrgUi {
  // TODO: transition to "orgGroupId"
  jetstreamOrganizationId?: Maybe<string>;
  id?: number;
  uniqueId: string;
  label: string;
  filterText: string;
  accessToken: string;
  instanceUrl: string;
  loginUrl: string;
  userId: string;
  email: string;
  organizationId: string;
  username: string;
  displayName: string;
  thumbnail?: Maybe<string>;
  apiVersion?: Maybe<string>;
  orgName?: Maybe<string>;
  orgCountry?: Maybe<string>;
  orgOrganizationType?: Maybe<SalesforceOrgEdition>;
  orgInstanceName?: Maybe<string>;
  orgIsSandbox?: Maybe<boolean>;
  orgLanguageLocaleKey?: Maybe<string>;
  orgNamespacePrefix?: Maybe<string>;
  orgTrialExpirationDate?: Maybe<string>;
  color?: Maybe<string>;
  connectionError?: Maybe<string>;
  createdAt?: Maybe<string>;
  updatedAt?: Maybe<string>;
  lastActivityAt?: Maybe<string>;
  expirationScheduledFor?: Maybe<string>;
}

export type SalesforceOrgUiType = 'Sandbox' | 'Developer' | 'Production';

export interface GenericRequestPayload {
  url: string;
  method: HttpMethod;
  isTooling?: boolean;
  body?: any;
  headers?: any;
  options?: {
    responseType?: string;
    noContentResponse?: any;
  };
}

export type ManualRequestPayload = Omit<GenericRequestPayload, 'isTooling' | 'options'>;

export type ManualRequestResponse = {
  error: boolean;
  errorMessage?: Maybe<string>;
  status: number | null;
  statusText?: string | null;
  headers: string | null;
  body?: Maybe<string>;
};

export interface BulkApiCreateJobRequestPayload {
  type: InsertUpdateUpsertDeleteQuery;
  sObject: string;
  serialMode?: Maybe<boolean>;
  externalId?: Maybe<string>;
  assignmentRuleId?: Maybe<string>;
  hasZipAttachment?: Maybe<boolean>;
}

export interface SocketAck<T = any> {
  success: boolean;
  error?: string;
  data?: T;
}

export interface PlatformEventMessage<T = any> {
  channel: string;
  data: PlatformEventMessagePayload<T>;
}

export interface PlatformEventMessagePayload<T = any> {
  schema: string;
  payload: T;
  event: PlatformEventMessageData;
}

export interface PlatformEventMessageData {
  EventUuid: string;
  replayId: number;
}

export interface AnalyticStat {
  id: string;
  name: string;
  value: string;
  valueRaw: number;
  lastUpdated: string;
}

export type NullNumberBehavior = 'ZERO' | 'BLANK';

export interface FormulaFieldsByType {
  objectFields: string[];
  customLabels: string[];
  apiFields: string[];
  customMetadata: string[];
  organization: string[];
  customPermissions: string[];
  profile: string[];
  customSettings: string[];
  system: string[];
  user: string[];
  userRole: string[];
}

export type AddOrgHandlerFn = (
  options: { serverUrl: string; loginUrl: string; addLoginTrue?: boolean; orgGroupId?: Maybe<string>; loginHint?: string },
  callback: (org: SalesforceOrgUi) => void,
) => void;
