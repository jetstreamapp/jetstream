import {
  DataHistoryFileOpCommon,
  DataHistoryFileOpCommonResults,
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
  openSettings: 'open-settings',
  googlePickerResult: 'google-picker-result',
  crashReportingChanged: 'crash-reporting-changed',
} as const;

export interface ElectronApiCallback {
  onAction: (payload: (action: DesktopAction) => void) => () => void;
  onAuthenticate: (payload: (payload: AuthenticatePayload) => void) => () => void;
  onDownloadProgress: (callback: (progress: DownloadZipProgress) => void) => () => void;
  onOrgAdded: (payload: (org: SalesforceOrgUi) => void) => () => void;
  onToastMessage: (callback: (message: { type: InfoSuccessWarningError; message: string; duration?: number }) => void) => () => void;
  onUpdateStatus: (callback: (status: UpdateStatus) => void) => () => void;
  onOpenSettings: (callback: () => void) => () => void;
  onGooglePickerResult: (callback: (result: GooglePickerResult) => void) => () => void;
  onCrashReportingChanged: (callback: (enabled: boolean) => void) => () => void;
}

/**
 * The Electron transport of the shared Data History file-op protocol
 * ({@link DataHistoryFileOpCommon}). A discriminated union so the main process gets its per-op
 * fields from narrowing rather than hand-written runtime guards — this is the one boundary where a
 * malformed message reaches `fs` calls in the privileged process.
 *
 * The main process allocates `streamId` and returns it (unlike the OPFS worker, which can be
 * respawned and therefore takes client-allocated ids).
 */
export type DataHistoryFileOpRequest =
  | DataHistoryFileOpCommon
  | { op: 'open-stream'; path: string; gzip: boolean }
  /**
   * Transport-specific: a bounded slice of a stored file. Every IPC reply is structured-cloned
   * through the main process, so reading a large payload back in one message copies the whole file
   * twice. The worker transport needs no equivalent — it hands back a Blob, which clones by
   * reference. Only meaningful for the plain files this backend writes (gzip cannot be seeked).
   */
  | { op: 'read-file-chunk'; path: string; offset: number; length: number };

/** `read-file` returns raw bytes because Blobs are not IPC-serializable; every other op is shared. */
export interface DataHistoryFileOpResultByOp extends DataHistoryFileOpCommonResults {
  'read-file': Uint8Array;
  'read-file-chunk': { bytes: Uint8Array; totalBytes: number };
}

export type DataHistoryFileOpResult<TRequest extends DataHistoryFileOpRequest> = DataHistoryFileOpResultByOp[TRequest['op']];

export interface ElectronApiRequestResponse {
  login: () => Promise<void>;
  logout: () => void;
  addOrg: (payload: { loginUrl: string; addLoginTrue?: boolean; orgGroupId?: Maybe<string>; loginHint?: Maybe<string> }) => void;
  checkAuth: () => Promise<{ userProfile: UserProfileUi; authInfo: DesktopAuthInfo } | undefined>;
  selectFolder: () => Promise<Maybe<string>>;
  getPreferences: () => Promise<DesktopUserPreferences>;
  setPreferences: (preferences: DesktopUserPreferences) => Promise<DesktopUserPreferences>;
  /**
   * Hand the (public, build-time-baked) error-tracking DSN from the renderer to the main process so
   * it can initialize crash reporting for the Node/Electron main process.
   */
  configureCrashReporter: (dsn: Maybe<string>) => Promise<void>;
  request: (payload: { url: string; request: IcpRequest }) => Promise<IcpResponse>;
  downloadZipToFile: (payload: DownloadZipPayload) => Promise<DownloadFileResult>;
  downloadBulkApiFile: (payload: JetstreamEventStreamFilePayload) => Promise<DownloadFileResult>;
  openFile: (filePath: string) => Promise<void>;
  showFileInFolder: (filePath: string) => Promise<void>;
  dataHistoryRequest: <TRequest extends DataHistoryFileOpRequest>(payload: TRequest) => Promise<DataHistoryFileOpResult<TRequest>>;
  getDataHistoryFolder: () => Promise<string>;
  /**
   * Shows the OS folder picker in the MAIN process and applies the selection (moves the history
   * directory + persists the preference) without the path ever transiting the renderer.
   * Resolves to the new base path, or null when the user cancels the dialog.
   */
  pickDataHistoryFolder: () => Promise<string | null>;
  checkForUpdates: (userInitiated?: boolean) => Promise<void>;
  getUpdateStatus: () => Promise<UpdateStatus>;
  getUpdatePolicy: () => Promise<UpdatePolicy>;
  installUpdate: () => void;
  openGooglePicker: (payload: {
    /**
     * If the user had pre-authorized, use the existing access token to open the picker directly, otherwise open the auth flow first.
     */
    accessToken?: Maybe<string>;
    accessTokenExpiresAt?: Maybe<string | number>;
    mode: 'file' | 'folder' | 'auth';
    /** Client-generated nonce to correlate the result back to the correct hook instance */
    nonce: string;
  }) => Promise<void>;
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
  // Defaults to enabled - opting out is explicit, and the menu checkbox writes both states.
  crashReportingEnabled: z.boolean().optional().default(true),
  /**
   * Background update checks and downloads. Defaults to enabled; an administrator policy can force
   * it off regardless of this value (see `UpdatePolicy`).
   */
  autoUpdateEnabled: z.boolean().optional().default(true),
  /** Base directory for native Data History storage — defaults to `<userData>/data-history` when unset */
  dataHistoryFolder: z.string().optional(),
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
  jetstreamOrganizationId: z.string().nullish(),
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
  thumbnail: z.string().nullish(),
  apiVersion: z.string().nullish(),
  orgName: z.string().nullish(),
  orgCountry: z.string().nullish(),
  orgInstanceName: z.string().nullish(),
  orgIsSandbox: z.boolean().nullish(),
  orgLanguageLocaleKey: z.string().nullish(),
  orgNamespacePrefix: z.string().nullish(),
  orgTrialExpirationDate: z.string().nullish(),
  connectionError: z.string().nullish(),
  label: z.string().nullish(),
  orgOrganizationType: z.string().nullish(),
  color: z.string().nullish(),
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
export type UpdateStatusType = 'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'error' | 'up-to-date' | 'disabled';

export interface UpdateStatus {
  status: UpdateStatusType;
  version?: string;
  error?: string;
  /** Stable error code from electron-updater (e.g. ERR_UPDATER_INVALID_SIGNATURE), when available. */
  errorCode?: string;
  downloadProgress?: {
    percent: number;
    transferred: number;
    total: number;
  };
  /**
   * True when installing the pending update will trigger a Windows UAC prompt because Jetstream was
   * installed for all users. The app never installs those silently, so the UI has to tell the user
   * an administrator approval is coming rather than letting one appear unannounced.
   */
  requiresElevation?: boolean;
  /** Populated on the `disabled` status so the UI can explain who turned updates off. */
  disabledBy?: UpdatePolicySource;
}

/**
 * Which layer decided whether automatic updates run, highest precedence first. Everything except
 * `user-preference` and `default` is administrator-controlled and cannot be changed in the app.
 */
export type UpdatePolicySource = 'command-line' | 'environment' | 'managed-policy' | 'user-preference' | 'default';

export interface UpdatePolicy {
  /** When false, Jetstream never checks for or downloads updates in the background. */
  autoUpdateEnabled: boolean;
  /** Whether "Check for Updates" does anything — false only when an administrator disabled updates. */
  allowManualCheck: boolean;
  /** The layer that decided {@link autoUpdateEnabled}. */
  source: UpdatePolicySource;
  /** True when an administrator owns the decision, so the in-app toggle is read-only. */
  managed: boolean;
  /**
   * True when Jetstream is installed for all users (Windows per-machine install). Its files live
   * outside the user's profile, so NSIS relaunches the installer elevated and Windows shows a UAC
   * prompt — which means updates can only be installed from a deliberate user action.
   */
  perMachineInstall: boolean;
}

// Google Picker types
export interface GooglePickerResultSuccess {
  status: 'success';
  mode: 'file' | 'folder' | 'auth';
  googleAccessToken: string;
  /** Epoch ms when the Google access token expires (from OAuth expires_in) */
  googleAccessTokenExpiresAt?: number;
  fileId?: string;
  fileName?: string;
  mimeType?: string;
  folderId?: string;
  folderName?: string;
  /** Client-generated nonce for correlating IPC results to the correct hook instance */
  nonce?: string;
}

export interface GooglePickerResultCancelled {
  status: 'cancelled';
  /** Client-generated nonce for correlating IPC results to the correct hook instance */
  nonce?: string;
}

export interface GooglePickerResultError {
  status: 'error';
  error: string;
  /** Client-generated nonce for correlating IPC results to the correct hook instance */
  nonce?: string;
}

export type GooglePickerResult = GooglePickerResultSuccess | GooglePickerResultCancelled | GooglePickerResultError;
