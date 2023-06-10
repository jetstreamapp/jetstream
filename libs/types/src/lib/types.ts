import type { SalesforceId } from 'jsforce';
import { InsertUpdateUpsertDeleteQuery, SalesforceOrgEdition, SalesforceOrgLocaleKey } from './salesforce/types';

export type Maybe<T> = T | null | undefined;
export type Nullable<T> = T | null;
export type Undefinable<T> = T | undefined;

export const isNotNullish = <T>(input: T | null | undefined): input is T => input != null;
export const isNotEmpty = <T>(input: T[]) => input.length !== 0;

export interface ApiResponse<T = unknown> {
  data: T;
  cache?: CacheItem;
}

export type OrgCacheItem<T> = MapOf<CacheItemWithData<T>>;

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
export type SobjectOperation = 'retrieve' | 'create' | 'update' | 'upsert' | 'delete';

export interface MapOf<T> {
  [key: string]: T;
}

export interface RecordAttributes {
  type: string;
  url: string;
}

export interface ApplicationCookie {
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

export type UserProfileUsernameStatus = 'ACTIVE' | 'PENDING' | 'REJECTED';

export type Auth0ConnectionName = 'google-oauth2' | 'salesforce' | 'github';

export interface FeatureFlag {
  flagVersion: string; // V1.0
  flags: string[]; // all | query
  isDefault: boolean;
}

export type Auth0PaginatedResponse<PropertyName extends string, T> = {
  start: number;
  limit: number;
  length: number;
  total: number;
} & { [P in PropertyName]: T[] };

export interface UserProfileAuth0Identity {
  profileData?: UserProfileAuth0IdentityProfileData;
  provider: string;
  access_token: string;
  expires_in: 3599;
  user_id: string;
  connection: string;
  isSocial: boolean;
}

export interface UserProfileAuth0IdentityProfileData {
  email: string;
  email_verified: boolean;
  name: string;
  given_name: string;
  family_name: string;
  picture: string;
  locale: string;
  username?: string;
  nickname?: string;
}
export interface UserProfileAuth0 {
  user_id: string;
  created_at: string;
  updated_at: string;
  email: string;
  email_verified: boolean;
  identities: UserProfileAuth0Identity[];
  name: string;
  nickname: string;
  picture: string;
  user_metadata: any;
  app_metadata: {
    featureFlags: FeatureFlag;
    accountDeletionDate?: string;
  };
  last_ip: string;
  last_login: string;
  logins_count: number;
  username?: string;
}

export type UserProfileAuth0Ui = Pick<
  UserProfileAuth0,
  'user_id' | 'email' | 'email_verified' | 'identities' | 'name' | 'nickname' | 'picture' | 'app_metadata' | 'username'
>;

export interface UserProfileUi {
  email: string;
  email_verified: boolean;
  // Set from environment variable, could be different
  'http://getjetstream.app/app_metadata': { featureFlags: FeatureFlag };
  name: string;
  nickname: string;
  picture?: string | null;
  sub: string; // userid
  updated_at: string;
}

// SERVER ONLY TYPE - BROWSER WILL GET UserProfileUi
export interface UserProfileServer {
  _json: UserProfileUi;
  _raw: string | null;
  id: string;
  displayName: string;
  emails: { value: string }[];
  name: any;
  nickname: string;
  picture?: string | null;
  provider: string;
  user_id: string;
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Record<T = any> = { attributes?: RecordAttributes; Id?: SalesforceId } & T;

export interface SalesforceOrgUi {
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
  orgLanguageLocaleKey?: Maybe<SalesforceOrgLocaleKey>;
  orgNamespacePrefix?: Maybe<string>;
  orgTrialExpirationDate?: Maybe<string>;
  color?: Maybe<string>;
  connectionError?: Maybe<string>;
  createdAt?: Maybe<string>;
  updatedAt?: Maybe<string>;
}

export type SalesforceOrgUiType = 'Sandbox' | 'Developer' | 'Production';

export interface GenericRequestPayload {
  url: string;
  method: HttpMethod;
  isTooling: boolean;
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
  statusText: string | null;
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
