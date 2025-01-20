import { Maybe } from '@jetstream/types';
import type { CookieSerializeOptions } from 'cookie';
import { z } from 'zod';

// TODO: we might want a SessionUser (this) and a UserProfile with a few extra fields, like photo
export interface UserProfile {
  id: string;
  userId: string;
  name: string;
  email: string;
  emailVerified: boolean;
}

export interface UserProfileSession extends UserProfile {
  authFactors?: UserProfileAuthFactor[];
}

export interface UserProfileUiWithIdentities extends UserProfile {
  name: string;
  picture: string | null;
  createdAt: Date;
  updatedAt: Date;
  hasPasswordSet: boolean;
  preferences: {
    id: string;
    userId: string;
    createdAt: Date;
    updatedAt: Date;
    skipFrontdoorLogin: boolean;
  } | null;
  identities: UserProfileIdentity[];
  authFactors: UserProfileAuthFactor[];
}

export interface UserProfileIdentity {
  type: 'oauth' | 'credentials';
  email: string;
  emailVerified: boolean;
  familyName: string;
  givenName: string;
  name: string;
  picture: string | null;
  provider: OauthAndLocalProviders;
  providerAccountId: string;
  username: string;
  isPrimary: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UserProfileAuthFactor {
  type: TwoFactorType;
  enabled: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface UserSession {
  sessionId: string;
  expires: string;
  userAgent: string;
  ipAddress: string;
  provider: OauthProviderType | 'credentials';
  loginTime: string;
}

export interface UserSessionWithLocation extends UserSession {
  location?: SessionIpData;
}

export type TwoFactorTypeEmail = 'email';
export type TwoFactorTypeOtp = '2fa-otp';
export type TwoFactorTypeOtpEmail = '2fa-email';

export type TwoFactorTypeWithoutEmail = TwoFactorTypeOtp | TwoFactorTypeOtpEmail;
export type TwoFactorType = TwoFactorTypeEmail | TwoFactorTypeOtp | TwoFactorTypeOtpEmail;

export interface SessionData {
  user: UserProfileSession;
  csrfToken: string;
  pendingVerification?: Array<
    | {
        type: TwoFactorTypeEmail;
        token: string;
        exp: number;
      }
    | {
        type: TwoFactorTypeOtp;
        // secret: string;
        exp: number;
      }
    | {
        type: TwoFactorTypeOtpEmail;
        token: string;
        exp: number;
      }
  > | null;
  loginTime: number;
  provider: OauthProviderType | 'credentials';
  // TODO: lastActivity: number;
  ipAddress: string;
  userAgent: string;
  sendNewUserEmailAfterVerify?: boolean;
  orgAuth?: { code_verifier: string; nonce: string; state: string; loginUrl: string; jetstreamOrganizationId?: Maybe<string> };
}

export interface SessionIpSuccess {
  status: 'success';
  country: string | null;
  countryCode: string | null;
  region: string | null;
  regionName: string | null;
  city: string | null;
  isp: string | null;
  lat: number | null;
  lon: number | null;
  query: string | null;
}

export interface SessionIpFail {
  status: 'fail';
  query: string;
}

export type SessionIpData = SessionIpSuccess | SessionIpFail;

export interface ProviderUser {
  id: string;
  email: string;
  emailVerified: boolean;
  username: string;
  name: string;
  givenName?: Maybe<string>;
  familyName?: Maybe<string>;
  picture?: Maybe<string>;
}

export type AuthenticatedUser = {
  id: string;
  userId: string;
  name: string;
  email: string;
  emailVerified: boolean;
  authFactors: {
    type: string;
    enabled: boolean;
  }[];
};

export interface CreateCSRFTokenParams {
  secret: string;
}

export interface ValidateCSRFTokenParams {
  secret: string;
  cookieValue?: string;
  bodyValue?: string;
}

export type PartitionCookieConstraint =
  | {
      partition: true;
      secure: true;
    }
  | {
      partition?: boolean;
      secure?: boolean;
    };

export type CookieOptions = {
  signingSecret?: string; // TODO:
  sameSite?: 'Strict' | 'Lax' | 'None' | 'strict' | 'lax' | 'none';
  partitioned?: boolean;
  prefix?: CookiePrefixOptions;
} & Omit<CookieSerializeOptions, 'partitioned' | 'secure'> &
  PartitionCookieConstraint;

export type SecureCookieConstraint = {
  secure: true;
};
export type HostCookieConstraint = {
  secure: true;
  path: '/';
  domain?: undefined;
};
export type CookiePrefixOptions = 'host' | 'secure';

type CallbackUrlCookie = 'callbackUrl';
type CsrfTokenCookie = 'csrfToken';
type PkceCodeVerifierCookie = 'pkceCodeVerifier';
type LinkIdentityCookie = 'linkIdentity';
type ReturnUrlCookie = 'returnUrl';
type StateCookie = 'state';
type NonceCookie = 'nonce';
type WebauthnChallengeCookie = 'webauthnChallenge';
type RememberDeviceCookie = 'rememberDevice';
type RedirectUrl = 'redirectUrl';

type CookieConfigKey =
  | CallbackUrlCookie
  | CsrfTokenCookie
  | PkceCodeVerifierCookie
  | LinkIdentityCookie
  | ReturnUrlCookie
  | StateCookie
  | NonceCookie
  | WebauthnChallengeCookie
  | RememberDeviceCookie
  | RedirectUrl;

type cookieNamePrefix = '__Host-' | '__Secure-' | '';

export type CookieConfig = Record<CookieConfigKey, { name: `${cookieNamePrefix}jetstream-auth.${string}`; options: CookieOptions }>;

export type ResponseLocalsCookies = Record<
  string,
  | {
      name: string;
      clear: true;
      value?: never;
      options: CookieOptions;
    }
  | {
      name: string;
      clear?: false;
      value: string;
      options: CookieOptions;
    }
>;

// TODO: some of these type names/structures seem convoluted

export const ProviderTypeOauthSchema = z.literal('oauth');
export const ProviderTypeCredentialsSchema = z.literal('credentials');
export const ProviderTypeSchema = z.union([ProviderTypeOauthSchema, ProviderTypeCredentialsSchema]);

export type ProviderTypeOauth = z.infer<typeof ProviderTypeOauthSchema>;
export type ProviderTypeCredentials = z.infer<typeof ProviderTypeCredentialsSchema>;
export type ProviderType = z.infer<typeof ProviderTypeSchema>;

export const OauthProviderTypeSchema = z.enum(['salesforce', 'google']);
export const LocalProviderTypeSchema = z.enum(['credentials']);

export type OauthProviderType = z.infer<typeof OauthProviderTypeSchema>;
export type LocalProviderType = z.infer<typeof LocalProviderTypeSchema>;
export type OauthAndLocalProviders = OauthProviderType | LocalProviderType;

// TODO: could do discriminated union?
export const ProviderBaseSchema = z.object({
  label: z.string(),
  icon: z.string().url(),
  signinUrl: z.string().url(),
  callbackUrl: z.string().url(),
});

export const OauthProviderSchema = ProviderBaseSchema.extend({
  provider: OauthProviderTypeSchema,
  type: ProviderTypeOauthSchema,
});

export const CredentialProviderSchema = ProviderBaseSchema.extend({
  provider: LocalProviderTypeSchema,
  type: ProviderTypeCredentialsSchema,
});

const ProviderSchema = z.discriminatedUnion('type', [OauthProviderSchema, CredentialProviderSchema]);

export type Provider = z.infer<typeof ProviderSchema>;

export const ProvidersSchema = z.object({
  google: ProviderSchema,
  salesforce: ProviderSchema,
  credentials: ProviderSchema,
});

export type Providers = z.infer<typeof ProvidersSchema>;

export const ProviderKeysSchema = ProvidersSchema.keyof();
export type ProviderKeys = z.infer<typeof ProviderKeysSchema>;
