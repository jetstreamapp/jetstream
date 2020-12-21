import { SalesforceId } from 'jsforce';
import { InsertUpdateUpsertDelete, SalesforceOrgEdition, SalesforceOrgLocaleKey } from './salesforce/types';

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
  skipQueryWalkthrough: boolean;
}

export type UserProfileUsernameStatus = 'ACTIVE' | 'PENDING' | 'REJECTED';

export interface FeatureFlag {
  flagVersion: string; // V1.0
  flags: string[]; // all | query
  isDefault: boolean;
}

export interface UserProfileUi {
  email: string;
  email_verified: string;
  'http://getjetstream.app/app_metadata': { featureFlags: FeatureFlag };
  name: string;
  nickname: string;
  picture: string;
  sub: string; // userid
  updated_at: string;
}

// SERVER ONLY TYPE - BROWSER WILL GET UserProfileUi
export interface UserProfileServer {
  _json: UserProfileUi;
  _raw: string;
  id: string;
  displayName: string;
  emails: { value: string }[];
  name: any;
  nickname: string;
  picture: string;
  provider: string;
  user_id: string;
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
  thumbnail?: string;
  apiVersion?: string;
  orgName?: string;
  orgCountry?: string;
  orgOrganizationType?: SalesforceOrgEdition;
  orgInstanceName?: string;
  orgIsSandbox?: boolean;
  orgLanguageLocaleKey?: SalesforceOrgLocaleKey;
  orgNamespacePrefix?: string;
  orgTrialExpirationDate?: string;
  connectionError?: string;
  createdAt?: string;
  updatedAt?: string;
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

export interface BulkApiCreateJobRequestPayload {
  type: InsertUpdateUpsertDelete;
  sObject: string;
  serialMode?: boolean;
  externalId?: string;
}
