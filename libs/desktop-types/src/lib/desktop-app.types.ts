import { ApplicationCookie, Maybe, SalesforceOrgUi, UserProfileUi } from '@jetstream/types';
import { z } from 'zod';

/**
 * ElectronAPI interface for the Electron app
 * This interface defines the methods and events that are available in the Electron app
 * and can be used in the preload script to communicate with the main process.
 */
export interface ElectronApiCallback {
  onAuthenticate: (payload: (payload: AuthenticatePayload) => void) => void;
  onOrgAdded: (payload: (org: SalesforceOrgUi) => void) => void;
}

export interface ElectronApiRequestResponse {
  login: () => Promise<void>;
  logout: () => void;
  addOrg: (payload: { loginUrl: string; addLoginTrue?: boolean; jetstreamOrganizationId?: Maybe<string> }) => void;
  checkAuth: () => Promise<{ userProfile: UserProfileUi; authInfo: DesktopAuthInfo } | undefined>;
  getAppCookie: () => Promise<ApplicationCookie>;
  request: (payload: { url: string; request: IcpRequest }) => Promise<IcpResponse>;
}

export type ElectronAPI = ElectronApiCallback & ElectronApiRequestResponse;

export interface IcpRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: unknown;
}

export interface IcpResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body?: unknown;
}

export interface AuthenticateSuccessPayload {
  success: true;
  userProfile: UserProfileUi;
  authInfo: DesktopAuthInfo;
  error?: never;
}
export interface AuthenticateFailurePayload {
  success: false;
  userProfile?: never;
  error: string;
}
export type AuthenticatePayload = AuthenticateSuccessPayload | AuthenticateFailurePayload;

export type OrgAddedResponse = { loginUrl: string; addLoginTrue?: boolean; jetstreamOrganizationId?: Maybe<string> };

export interface JwtPayload {
  userProfile: UserProfileUi;
  aud: string;
  iss: string;
  sub: string;
  iat: number;
  exp: number;
}

export const AppDataSchema = z.object({
  deviceId: z
    .string()
    .optional()
    .default(() => crypto.randomUUID()),
  accessToken: z.string().nullish(),
  userProfile: z
    .object({
      id: z.string(),
      name: z.string(),
      email: z.string(),
    })
    .passthrough()
    .nullish(),
  expiresAt: z.number().nullish(),
  lastChecked: z.number().nullish(),
});
export type AppData = z.infer<typeof AppDataSchema>;

export const DesktopUserPreferencesSchema = z.object({
  skipFrontdoorLogin: z.boolean().optional().default(false),
  recordSyncEnabled: z.boolean().optional().default(false),
});
export type DesktopUserPreferences = z.infer<typeof DesktopUserPreferencesSchema>;

export interface UserProfileUiDesktop extends Omit<UserProfileUi, 'preferences'> {
  preferences: DesktopUserPreferences;
}

export const SalesforceOrgSchema = z.object({
  jetstreamOrganizationId: z.string().nullable().optional(),
  uniqueId: z.string(),
  filterText: z.string(),
  accessToken: z.string(),
  instanceUrl: z.string(),
  loginUrl: z.string(),
  userId: z.string(),
  email: z.string(),
  organizationId: z.string(),
  username: z.string(),
  displayName: z.string(),
  thumbnail: z.string().nullable().optional(),
  apiVersion: z.string().nullable().optional(),
  orgName: z.string().nullable().optional(),
  orgCountry: z.string().nullable().optional(),
  orgInstanceName: z.string().nullable().optional(),
  orgIsSandbox: z.boolean().nullable().optional(),
  orgLanguageLocaleKey: z.string().nullable().optional(),
  orgNamespacePrefix: z.string().nullable().optional(),
  orgTrialExpirationDate: z.string().nullable().optional(),
  connectionError: z.string().nullable().optional(),
  label: z.string().nullable().optional(),
  orgOrganizationType: z.string().nullable().optional(),
  color: z.string().nullable().optional(),
});
export const SalesforceOrgSchemaArray = SalesforceOrgSchema.array();

export type SalesforceOrgServer = z.infer<typeof SalesforceOrgSchema>;

export const JetstreamOrganizationSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z
    .string()
    .optional()
    .nullable()
    .default(null)
    .transform((val) => (val === '' ? null : val)),
  createdAt: z.string(),
  updatedAt: z.string(),
  orgs: z
    .object({
      uniqueId: z.string(),
    })
    .array(),
});

export const JetstreamOrganizationSchemaArray = JetstreamOrganizationSchema.array();

export type JetstreamOrganizationServer = z.infer<typeof JetstreamOrganizationSchema>;

export const OrgsPersistenceSchema = z.object({
  jetstreamOrganizations: JetstreamOrganizationSchemaArray,
  salesforceOrgs: SalesforceOrgSchemaArray,
});

export type OrgsPersistence = z.infer<typeof OrgsPersistenceSchema>;

export type DesktopAuthInfo = { accessToken: string; deviceId: string };
