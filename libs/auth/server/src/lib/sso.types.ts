import type { SsoProvider } from '@jetstream/prisma';
import { Maybe } from '@jetstream/types';

export interface AttributeMapping {
  email: string;
  userName?: Maybe<string>;
  firstName?: Maybe<string>;
  lastName?: Maybe<string>;
}

export interface SsoUserInfo {
  email: string;
  userName: string;
  firstName?: Maybe<string>;
  lastName?: Maybe<string>;
}

export interface SsoDiscoveryResult {
  teamId: string;
  teamName: string;
  ssoProvider: SsoProvider;
  ssoEnabled: boolean;
}

// SAML Types
export interface ParsedIdpMetadata {
  entityId: string;
  ssoUrl: string;
  sloUrl?: string;
  certificate: string;
  claimMapping: Maybe<Partial<AttributeMapping>>;
}

export interface SamlProfile {
  issuer: string;
  sessionIndex?: string;
  nameID?: string;
  nameIDFormat?: string;
  nameQualifier?: string;
  spNameQualifier?: string;
  attributes?: Record<string, any>;
  [key: string]: any;
}

// OIDC Types
export interface DiscoveredOidcConfig {
  issuer: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  userinfoEndpoint?: string;
  jwksUri: string;
  endSessionEndpoint?: string;
}

// Test results
export interface SsoTestResponse {
  success: boolean;
  authUrl?: string;
  message?: string;
  error?: string;
  mappedUserInfo?: Partial<SsoUserInfo>;
}
