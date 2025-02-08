import { ApiConnection } from '@jetstream/salesforce-api';
import type { Maybe, SalesforceOrgUi, UserProfileUi } from '@jetstream/types';
import { z } from 'zod';

export const AUTH_CHECK_INTERVAL_MIN = 5;

export const DEFAULT_BUTTON_POSITION: ButtonPosition = {
  location: 'right',
  position: 210,
  opacity: 0.25,
  inactiveSize: 25,
  activeScale: 1.5,
};

export interface ButtonPosition {
  location: 'left' | 'right';
  position: number;
  opacity: number;
  inactiveSize: number;
  activeScale: number;
}

export interface JwtPayload {
  userProfile: UserProfileUi;
  aud: string;
  iss: string;
  sub: string;
  iat: number;
  exp: number;
}

export interface ChromeStorageState {
  sync: {
    extIdentifier: z.infer<typeof ExtensionIdentifier> | null;
    authTokens: z.infer<typeof AuthTokens> | null;
    buttonPosition: ButtonPosition;
  };
  local: {
    options: {
      enabled: boolean;
      recordSyncEnabled: boolean;
    };
  };
}

export type Message = Logout | VerifyAuth | ToggleExtension | GetSfHost | GetSession | GetPageUrl | InitOrg | ApiAction | GetCurrentOrg;
export type MessageRequest = Message['request'];

export interface ResponseError {
  error: true;
  message: string;
}

export interface MessageResponse<T extends Message['response'] = Message['response']> {
  data: T;
  error?: ResponseError;
}

export interface SessionInfo {
  hostname: string;
  key: string;
}

export interface Logout {
  request: {
    message: 'LOGOUT';
  };
  response: {
    loggedIn: boolean;
    hasTokens: boolean;
    error?: Maybe<string>;
  };
}

export interface VerifyAuth {
  request: {
    message: 'VERIFY_AUTH';
  };
  response: {
    loggedIn: boolean;
    hasTokens: boolean;
    error?: Maybe<string>;
  };
}

export interface ToggleExtension {
  request: {
    message: 'TOGGLE_EXTENSION';
    data: boolean;
  };
  response: void;
}

export interface GetSfHost {
  request: {
    message: 'GET_SF_HOST';
    data: { url: string };
  };
  response: Maybe<string>;
}

export interface GetSession {
  request: {
    message: 'GET_SESSION';
    data: { salesforceHost: string };
  };
  response: Maybe<SessionInfo>;
}

export interface GetPageUrl {
  request: {
    message: 'GET_PAGE_URL';
    data: { page: string };
  };
  response: Maybe<string>;
}

export interface InitOrg {
  request: {
    message: 'INIT_ORG';
    data: { sessionInfo: SessionInfo };
  };
  response: { org: SalesforceOrgUi };
}

// Allows calling API routes from Salesforce pages
export interface ApiAction {
  request: {
    message: 'API_ACTION';
    data: { sfHost: string; method: string; pathname: string; queryParams?: URLSearchParams; body?: any };
  };
  response: { data: unknown };
}

export interface GetCurrentOrg {
  request: {
    message: 'GET_CURRENT_ORG';
    data: { sfHost: string };
  };
  response: OrgAndSessionInfo;
}

export interface OrgAndSessionInfo {
  org: SalesforceOrgUi;
  sessionInfo: SessionInfo;
}

export interface OrgAndApiConnection {
  org: SalesforceOrgUi;
  apiConnection: ApiConnection;
}

export const ExtensionIdentifier = z.object({
  id: z.string(),
});

export const AuthTokens = z.object({
  accessToken: z.string(),
  // TODO: UserProfileUi - but we don't have zod types for that, so just casting
  userProfile: z.any().nullish(),
  expiresAt: z.number(),
  lastChecked: z.number().nullable(),
  loggedIn: z.boolean(),
});

export interface ExtIdentifierStorage {
  extIdentifier: z.infer<typeof ExtensionIdentifier>;
}
export interface AuthTokensStorage {
  authTokens: z.infer<typeof AuthTokens>;
}

export type StorageTypes = ExtIdentifierStorage & AuthTokensStorage;

export const storageTypes = {
  extIdentifier: {
    key: 'extIdentifier',
    value: ExtensionIdentifier,
  },
  authTokens: {
    key: 'authTokens',
    value: AuthTokens,
  },
};

/**
 * External event payloads
 * Jetstream server and the web extension for authentication
 */
export const GetOrInitDeviceIdExternalEvent = z.object({
  type: z.literal('EXT_IDENTIFIER'),
});

export const AuthTokenExternalEvent = z.object({
  type: z.literal('TOKENS'),
  data: z.object({
    accessToken: z.string(),
  }),
});

export const eventPayload = z.discriminatedUnion('type', [GetOrInitDeviceIdExternalEvent, AuthTokenExternalEvent]);
