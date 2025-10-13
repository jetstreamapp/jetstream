import { Maybe, TeamMemberRole, TeamMemberRoleSchema, TeamMemberStatusSchema } from '@jetstream/types';
import type { CookieSerializeOptions } from 'cookie';
import { z } from 'zod';

export interface Team {
  id: string;
  name: string;
}

// TODO: we might want a SessionUser (this) and a UserProfile with a few extra fields, like photo
export interface UserProfile {
  id: string;
  userId: string;
  name: string;
  email: string;
  emailVerified: boolean;
}

export type UserProfileSession = AuthenticatedUser;

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
    recordSyncEnabled: boolean;
  } | null;
  identities: UserProfileIdentity[];
  authFactors: UserProfileAuthFactor[];
  teamMembership?: Maybe<UserProfileTeamMemberships>;
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

export interface UserProfileTeamMemberships {
  role: TeamMemberRole;
  team: {
    id: string;
    name: string;
  };
}

export interface UserSession {
  userId: string;
  sessionId: string;
  expires: string;
  userAgent: string;
  ipAddress: string;
  provider: OauthProviderType | 'credentials';
  loginTime: string;
  createdAt: string;
}

export interface UserSessionWithLocation extends UserSession {
  location?: Maybe<SessionIpData>;
}

export interface UserSessionWithLocationAndUser extends UserSessionWithLocation {
  user: {
    id: string;
    name: string;
    email: string;
  };
}

export type TokenSourceBrowserExtensions = 'BROWSER_EXTENSION';
export type TokenSourceDesktop = 'DESKTOP';
export type TokenSource = TokenSourceBrowserExtensions | TokenSourceDesktop;

export interface ExternalTokenSessionWithLocation {
  id: string;
  source: TokenSource;
  createdAt: string;
  expiresAt: string;
  ipAddress: string;
  userAgent: string;
  location?: Maybe<SessionIpData>;
}

export interface LoginActivityUserFacing {
  id: number;
  action: string;
  createdAt: string;
  errorMessage: Maybe<string>;
  ipAddress: Maybe<string>;
  method: Maybe<string>;
  success: boolean;
  userAgent: Maybe<string>;
  location?: Maybe<SessionIpData>;
  user?: Maybe<{
    id: string;
    name: string;
    email: string;
  }>;
}

export interface UserSessionAndExtTokensAndActivityWithLocation {
  currentSessionId: string;
  sessions: UserSessionWithLocation[];
  webTokenSessions: ExternalTokenSessionWithLocation[];
  loginActivity: LoginActivityUserFacing[];
}

export type TwoFactorTypeEmail = 'email';
export type TwoFactorTypeOtp = '2fa-otp';
export type TwoFactorTypeOtpEmail = '2fa-email';

export type TwoFactorTypeWithoutEmail = TwoFactorTypeOtp | TwoFactorTypeOtpEmail;
export type TwoFactorType = TwoFactorTypeEmail | TwoFactorTypeOtp | TwoFactorTypeOtpEmail;

export interface SessionData {
  user: UserProfileSession;
  csrfToken: string;
  pendingMfaEnrollment?: {
    factor: TwoFactorTypeOtp;
  } | null;
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

export const AuthenticatedUserSchema = z.object({
  id: z.string(),
  userId: z.string(),
  name: z.string(),
  email: z.string(),
  emailVerified: z.boolean(),
  authFactors: z.array(
    z.object({
      type: z.enum(['email', '2fa-otp', '2fa-email']),
      enabled: z.boolean(),
    }),
  ),
  teamMembership: z
    .object({
      teamId: z.string(),
      role: TeamMemberRoleSchema,
      status: TeamMemberStatusSchema,
    })
    .nullish(),
});

export type AuthenticatedUser = z.infer<typeof AuthenticatedUserSchema>;

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

// Auth Related Cookies
type CallbackUrlCookie = 'callbackUrl';
type CsrfTokenCookie = 'csrfToken';
type LinkIdentityCookie = 'linkIdentity';
type NonceCookie = 'nonce';
type PkceCodeVerifierCookie = 'pkceCodeVerifier';
type RedirectUrlCookie = 'redirectUrl';
type RememberDeviceCookie = 'rememberDevice';
type ReturnUrlCookie = 'returnUrl';
type TeamInviteCookie = 'teamInviteState';
type StateCookie = 'state';
type WebauthnChallengeCookie = 'webauthnChallenge';
type DoubleCSRFTokenCookie = 'doubleCSRFToken';

type CookieConfigKey =
  | CallbackUrlCookie
  | CsrfTokenCookie
  | LinkIdentityCookie
  | NonceCookie
  | PkceCodeVerifierCookie
  | RedirectUrlCookie
  | RememberDeviceCookie
  | ReturnUrlCookie
  | TeamInviteCookie
  | StateCookie
  | WebauthnChallengeCookie
  | DoubleCSRFTokenCookie;

type cookieNamePrefix = '__Host-' | '__Secure-' | '';

export type CookieConfig = Record<
  CookieConfigKey,
  { name: `${cookieNamePrefix}jetstream-auth.${string}` | `${cookieNamePrefix}jetstream-csrf`; options: CookieOptions }
>;

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
export const OauthAndLocalProvidersSchema = z.union([OauthProviderTypeSchema, LocalProviderTypeSchema]);

export type OauthProviderType = z.infer<typeof OauthProviderTypeSchema>;
export type LocalProviderType = z.infer<typeof LocalProviderTypeSchema>;
export type OauthAndLocalProviders = z.infer<typeof OauthAndLocalProvidersSchema>;

export const MfaMethodSchema = z.enum(['otp', 'email']);
export type MfaMethod = z.infer<typeof MfaMethodSchema>;

export const LoginConfigurationSchema = z.object({
  id: z.uuid(),
  allowedMfaMethods: z.array(MfaMethodSchema).transform(
    (value) =>
      new Set(
        value.map((value): TwoFactorTypeWithoutEmail => {
          switch (value) {
            case 'email':
              return '2fa-email';
            case 'otp':
              return '2fa-otp';
            default:
              return '2fa-otp';
          }
        }),
      ),
  ),
  allowedProviders: z.array(OauthAndLocalProvidersSchema).transform((value) => new Set(value)),
  requireMfa: z.boolean(),
  allowIdentityLinking: z.boolean(),
  autoAddToTeam: z.boolean().optional().default(false),
  team: z.object({ id: z.string() }).nullish(),
});
export type LoginConfiguration = z.infer<typeof LoginConfigurationSchema>;

export type LoginConfigurationUI = {
  isPasswordAllowed: boolean;
  isGoogleAllowed: boolean;
  isSalesforceAllowed: boolean;
  requireMfa: boolean;
  allowIdentityLinking: boolean;
  allowedMfaMethods: {
    email: boolean;
    otp: boolean;
  };
};

// TODO: could do discriminated union?
export const ProviderBaseSchema = z.object({
  label: z.string(),
  icon: z.url(),
  signinUrl: z.url(),
  callbackUrl: z.url(),
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

export interface OtpEnrollmentData {
  secretToken: string;
  imageUri: string;
  uri: string;
}
