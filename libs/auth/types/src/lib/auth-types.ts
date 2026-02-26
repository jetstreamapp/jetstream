import { Maybe, SoqlQueryFormatOptions, TeamMemberRole, TeamMemberRoleSchema, TeamMemberStatusSchema } from '@jetstream/types';
import type { SerializeOptions as CookieSerializeOptions } from 'cookie';
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
    soqlQueryFormatOptions: SoqlQueryFormatOptions;
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
  provider: OauthProviderType | SsoProviderType | 'credentials';
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
  provider: OauthProviderType | SsoProviderType | 'credentials';
  // TODO: lastActivity: number;
  ipAddress: string;
  userAgent: string;
  /**
   * Indicates whether this session is associated with a placeholder user (used during registration when email is already in use).
   * This is not a valid session and is not to be treated as authenticated.
   */
  sessionDetails?: { isTemporary: boolean };
  sendNewUserEmailAfterVerify?: boolean;
  orgAuth?: { code_verifier: string; nonce: string; state: string; loginUrl: string; orgGroupId?: Maybe<string> };
  // SSO state
  ssoReturnUrl?: string;
  oidcState?: {
    codeVerifier: string;
    state: string;
    nonce: string;
    teamId: string;
    returnUrl: string;
    expiresAt: number;
  };
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
export const ProviderTypeSsoSchema = z.literal('sso');
export const ProviderTypeCredentialsSchema = z.literal('credentials');
export const ProviderTypeSchema = z.union([ProviderTypeOauthSchema, ProviderTypeSsoSchema, ProviderTypeCredentialsSchema]);

export type ProviderTypeOauth = z.infer<typeof ProviderTypeOauthSchema>;
export type ProviderTypeSso = z.infer<typeof ProviderTypeSsoSchema>;
export type ProviderTypeCredentials = z.infer<typeof ProviderTypeCredentialsSchema>;
export type ProviderType = z.infer<typeof ProviderTypeSchema>;

export const OauthProviderTypeSchema = z.enum(['salesforce', 'google']);
export const SsoProviderTypeSchema = z.enum(['saml', 'oidc']);
export const LocalProviderTypeSchema = z.enum(['credentials']);
export const OauthAndLocalProvidersSchema = z.union([OauthProviderTypeSchema, LocalProviderTypeSchema]);
export const AllProvidersSchema = z.union([OauthProviderTypeSchema, SsoProviderTypeSchema, LocalProviderTypeSchema]);

export type OauthProviderType = z.infer<typeof OauthProviderTypeSchema>;
export type SsoProviderType = z.infer<typeof SsoProviderTypeSchema>;
export type LocalProviderType = z.infer<typeof LocalProviderTypeSchema>;
export type OauthAndLocalProviders = z.infer<typeof OauthAndLocalProvidersSchema>;
export type AllProviders = z.infer<typeof AllProvidersSchema>;

export const MfaMethodSchema = z.enum(['otp', 'email']);
export type MfaMethod = z.infer<typeof MfaMethodSchema>;

export const SamlConfigurationSchema = z.object({
  id: z.uuid(),
  name: z.string().min(1, 'Name is required').max(255, 'Name is too long'),
  loginConfigId: z.uuid(),
  entityId: z.string(),
  acsUrl: z.url(),
  idpEntityId: z.string().min(1, 'IdP Entity ID is required'),
  idpSsoUrl: z.url(),
  idpCertificate: z.string().min(1, 'IdP Certificate is required'),
  idpMetadataXml: z.string().nullable(),
  idpMetadataUrl: z.string().nullable().optional(),
  nameIdFormat: z.literal('urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress'),
  signRequests: z.boolean().default(false),
  wantAssertionsSigned: z.boolean().default(true),
  spCertificate: z.string().nullable(),
  spPrivateKey: z.string().nullable(),
  attributeMapping: z.record(z.string(), z.string().nullable()),
  idpCertificateExpiresAt: z.union([z.string(), z.date()]).nullable().optional(),
  createdAt: z.union([z.string(), z.date()]),
  updatedAt: z.union([z.string(), z.date()]),
});

export type SamlConfiguration = z.infer<typeof SamlConfigurationSchema>;

export const SamlConfigurationRequestSchema = SamlConfigurationSchema.pick({
  name: true,
  nameIdFormat: true,
  idpEntityId: true,
  idpSsoUrl: true,
  idpCertificate: true,
  idpMetadataXml: true,
  idpMetadataUrl: true,
  attributeMapping: true,
}).extend({
  // Reserved for future use
  signRequests: z.never().optional(),
  wantAssertionsSigned: z.never().optional(),
  spCertificate: z.never().optional(),
  spPrivateKey: z.never().optional(),
});

export type SamlConfigurationRequest = z.infer<typeof SamlConfigurationRequestSchema>;

export const OidcConfigurationSchema = z.object({
  id: z.uuid(),
  name: z.string().min(1, 'Name is required').max(255, 'Name is too long'),
  loginConfigId: z.uuid(),
  issuer: z.url(),
  clientId: z.string(),
  clientSecret: z.string().nullable(), // Optional because it might be encrypted/masked
  authorizationEndpoint: z.url(),
  tokenEndpoint: z.url(),
  userinfoEndpoint: z.url().nullable().optional(),
  jwksUri: z.url(),
  endSessionEndpoint: z.url().nullable(),
  scopes: z.array(z.string()).default(['openid', 'email', 'profile']),
  responseType: z.string().nullable(),
  attributeMapping: z.record(z.string(), z.string().nullable()),
  createdAt: z.union([z.string(), z.date()]),
  updatedAt: z.union([z.string(), z.date()]),
});

export type OidcConfiguration = z.infer<typeof OidcConfigurationSchema>;

export const OidcConfigurationRequestSchema = OidcConfigurationSchema.pick({
  name: true,
  issuer: true,
  clientId: true,
  clientSecret: true,
  authorizationEndpoint: true,
  tokenEndpoint: true,
  userinfoEndpoint: true,
  jwksUri: true,
  endSessionEndpoint: true,
  scopes: true,
  attributeMapping: true,
});
export type OidcConfigurationRequest = z.infer<typeof OidcConfigurationRequestSchema>;

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
  ssoProvider: z.enum(['SAML', 'OIDC', 'NONE']).default('NONE'),
  ssoEnabled: z.boolean().default(false),
  ssoJitProvisioningEnabled: z.boolean().default(false),
  ssoBypassEnabled: z.boolean().default(true),
  ssoBypassEnabledRoles: z.array(TeamMemberRoleSchema).default(['ADMIN']),
  ssoRequireMfa: z.boolean().default(false),
  // This is auto-populated from verified domains in DomainVerification table
  domains: z.array(z.string()).optional().default([]),
  samlConfiguration: SamlConfigurationSchema.pick({ id: true }).nullish(),
  oidcConfiguration: OidcConfigurationSchema.pick({ id: true }).nullish(),
});
export type LoginConfiguration = z.infer<typeof LoginConfigurationSchema>;

export const LoginConfigurationWithCallbacksSchema = LoginConfigurationSchema.pick({
  id: true,
  ssoProvider: true,
  ssoEnabled: true,
  ssoJitProvisioningEnabled: true,
  ssoBypassEnabled: true,
  ssoBypassEnabledRoles: true,
}).extend({
  samlConfiguration: SamlConfigurationSchema.nullish(),
  oidcConfiguration: OidcConfigurationSchema.nullish(),
  callbackUrls: z
    .object({
      oidc: z.string(),
      saml: z.string(),
      samlMetadata: z.string(),
      spEntityId: z.string(),
    })
    .optional(),
});

export type LoginConfigurationWithCallbacks = z.infer<typeof LoginConfigurationWithCallbacksSchema>;

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
