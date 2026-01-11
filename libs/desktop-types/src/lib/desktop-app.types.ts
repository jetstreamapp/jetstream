import {
  FileNameFormat,
  InfoSuccessWarningError,
  InputReadFileContent,
  JetstreamEventStreamFilePayload,
  Maybe,
  SalesforceOrgUi,
  SoqlQueryFormatOptionsSchema,
  UserProfileUi,
  UserProfileUiSchema,
} from '@jetstream/types';
import { z } from 'zod';

/**
 * ElectronAPI interface for the Electron app
 * This interface defines the methods and events that are available in the Electron app
 * and can be used in the preload script to communicate with the main process.
 */

export const IpcEventChannel = {
  action: 'action',
  authenticate: 'authenticate',
  downloadProgress: 'download-progress',
  /**
   * This is a native Electron event name; do not change it.
   */
  fileDropped: 'file-dropped',
  orgAdded: 'org-added',
  toastMessage: 'toast-message',
  updateStatus: 'update-status',
} as const;

export interface ElectronApiCallback {
  onAction: (payload: (action: DesktopAction) => void) => () => void;
  onAuthenticate: (payload: (payload: AuthenticatePayload) => void) => () => void;
  onDownloadProgress: (callback: (progress: DownloadZipProgress) => void) => () => void;
  onOrgAdded: (payload: (org: SalesforceOrgUi) => void) => () => void;
  onToastMessage: (callback: (message: { type: InfoSuccessWarningError; message: string; duration?: number }) => void) => () => void;
  onUpdateStatus: (callback: (status: UpdateStatus) => void) => () => void;
}

export interface ElectronApiRequestResponse {
  login: () => Promise<void>;
  logout: () => void;
  addOrg: (payload: { loginUrl: string; addLoginTrue?: boolean; orgGroupId?: Maybe<string>; loginHint?: Maybe<string> }) => void;
  checkAuth: () => Promise<{ userProfile: UserProfileUi; authInfo: DesktopAuthInfo } | undefined>;
  selectFolder: () => Promise<Maybe<string>>;
  getPreferences: () => Promise<DesktopUserPreferences>;
  setPreferences: (preferences: DesktopUserPreferences) => Promise<DesktopUserPreferences>;
  request: (payload: { url: string; request: IcpRequest }) => Promise<IcpResponse>;
  downloadZipToFile: (payload: DownloadZipPayload) => Promise<DownloadFileResult>;
  downloadBulkApiFile: (payload: JetstreamEventStreamFilePayload) => Promise<DownloadFileResult>;
  openFile: (filePath: string) => Promise<void>;
  showFileInFolder: (filePath: string) => Promise<void>;
  checkForUpdates: (userInitiated?: boolean) => Promise<void>;
  getUpdateStatus: () => Promise<UpdateStatus>;
  installUpdate: () => void;
}

export type ElectronAPI = ElectronApiCallback & ElectronApiRequestResponse;

export interface DesktopActionLoadRecord {
  action: 'LOAD_RECORD';
  payload: {
    fileContent: InputReadFileContent;
  };
}

export type DesktopAction = DesktopActionLoadRecord;

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

export interface DownloadZipPayload {
  orgId: string;
  nameFormat: FileNameFormat;
  sobject: string;
  recordIds: string[];
  fileName: string;
  jobId: string;
}

export interface DownloadFileResult {
  success: boolean;
  filePath?: string;
  error?: string;
}

export interface DownloadZipProgress {
  currentFile: number;
  totalFiles: number;
  fileName: string;
  bytesDownloaded?: number;
  totalBytes?: number;
  percentComplete: number;
  jobId: string;
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

export type OrgAddedResponse = {
  loginUrl: string;
  addLoginTrue?: boolean;
  orgGroupId?: Maybe<string>;
  loginHint?: Maybe<string>;
};

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
  userProfile: UserProfileUiSchema.nullish(),
  expiresAt: z.number().nullish(),
  lastChecked: z.number().nullish(),
});
export type AppData = z.infer<typeof AppDataSchema>;

export const DesktopUserPreferencesSchema = z.object({
  skipFrontdoorLogin: z.boolean().optional().default(false),
  recordSyncEnabled: z.boolean().optional().default(false),
  soqlQueryFormatOptions: SoqlQueryFormatOptionsSchema.prefault({}),
  fileDownload: z
    .object({
      omitPrompt: z.boolean().optional().default(true),
      downloadPath: z.string().optional().default(''),
    })
    .optional(),
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

export const NotificationMessageV1ResponseSchema = z.object({
  success: z.boolean(),
  severity: z.enum(['normal', 'critical']),
  action: z.enum(['notification', 'action-modal']).nullish(),
  actionUrl: z.string().nullable(),
  title: z.string().nullable(),
  message: z.string().nullable(),
});

export type NotificationMessageV1Response = z.infer<typeof NotificationMessageV1ResponseSchema>;

// Auto-update types
export type UpdateStatusType = 'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'error' | 'up-to-date';

export interface UpdateStatus {
  status: UpdateStatusType;
  version?: string;
  error?: string;
  downloadProgress?: {
    percent: number;
    transferred: number;
    total: number;
  };
}
