import { BooleanQueryParamSchema } from '@jetstream/api-types';
import {
  AuthenticateFailurePayload,
  AuthenticateSuccessPayload,
  DesktopAuthInfo,
  DownloadFileResult,
  DownloadZipPayload,
  ElectronApiRequestResponse,
  GooglePickerResult,
  IcpResponse,
  IpcEventChannel,
} from '@jetstream/desktop/types';
import { ApiConnection, getApiRequestFactoryFn, getBinaryFileRecordQueryMap } from '@jetstream/salesforce-api';
import * as oauthService from '@jetstream/salesforce-oauth';
import { HTTP } from '@jetstream/shared/constants';
import { JetstreamEventStreamFilePayload, UserProfileUi } from '@jetstream/types';
import { addHours, fromUnixTime } from 'date-fns';
import { app, dialog, ipcMain, shell } from 'electron';
import logger from 'electron-log';
import { jwtDecode } from 'jwt-decode';
import { ResponseBodyError } from 'oauth4webapi';
import { Method } from 'tiny-request-router';
import { z } from 'zod';
import { checkForUpdates, getCurrentUpdateStatus, getUpdatePolicy, installUpdate, refreshUpdatePolicy } from '../config/auto-updater';
import { ENV } from '../config/environment';
import { initMainErrorTracker } from '../config/error-tracker';
import { desktopRoutes } from '../controllers/desktop.routes';
import { getOrgFromHeaderOrQuery, initApiConnection } from '../utils/route.utils';
import { openExternalSafe } from '../utils/url.utils';
import { AuthResponseSuccess, logout, verifyAuthToken } from './api.service';
import {
  abortDataHistoryStreamsForSender,
  getDataHistoryFolderPath,
  handleDataHistoryOp,
  setDataHistoryFolderPath,
} from './data-history-file.service';
import { deepLink } from './deep-link.service';
import { downloadAndZipFilesToDisk, downloadBulkApiFileAndSaveToDisk } from './file-download.service';
import * as dataService from './persistence.service';
import { initConnectionFromOAuthResponse } from './sfdc-oauth.service';

type MainIpcHandler<Key extends keyof ElectronApiRequestResponse> = (
  event: Electron.IpcMainEvent,
  payload: Parameters<ElectronApiRequestResponse[Key]>[0],
) => ReturnType<ElectronApiRequestResponse[Key]>;

function registerHandler<Key extends keyof ElectronApiRequestResponse>(key: Key, handler: MainIpcHandler<Key>) {
  ipcMain.handle(key, handler);
}

/** Abandon an OAuth flow whose callback never arrived, so its listener does not leak */
const DEEP_LINK_FLOW_TIMEOUT_MS = 900000; // 15 minutes

/** Cancel function for the in-flight flow of each deep-link action, keyed by action name */
const pendingDeepLinkFlows = new Map<string, () => void>();

/**
 * Register a one-shot deep-link listener for an OAuth-style flow, cancelling whatever flow was
 * already pending for the same action.
 *
 * A deep-link event is dispatched to EVERY listener registered for its action, so without this a
 * second "Login" / "Add Org" click (e.g. the first one opened the wrong browser profile) would leave
 * the abandoned listener registered alongside the new one. When the callback finally arrives both
 * run: the current flow succeeds while the abandoned one fails its nonce / PKCE check, surfacing a
 * spurious "error authenticating" toast next to the successful result.
 */
function startDeepLinkFlow(action: string, handleCallback: (params: Record<string, string>) => Promise<void>) {
  pendingDeepLinkFlows.get(action)?.();

  let disposeListener: () => void = () => undefined;

  const cancel = () => {
    clearTimeout(timeout);
    disposeListener();
    // Only clear the map entry if a newer flow has not already replaced this one
    if (pendingDeepLinkFlows.get(action) === cancel) {
      pendingDeepLinkFlows.delete(action);
    }
  };

  disposeListener = deepLink.once(action, (params) => {
    handleCallback(params).finally(cancel);
  });
  // Declared after `cancel` (which clears it) — safe because `cancel` only ever runs from an async
  // path: this timer, or the deep-link callback's `.finally`, which is never synchronous.
  const timeout = setTimeout(cancel, DEEP_LINK_FLOW_TIMEOUT_MS);
  pendingDeepLinkFlows.set(action, cancel);
}

/** webContents ids that already have the stream-cleanup listeners bound (see below) */
const dataHistoryStreamOwners = new Set<number>();

/**
 * A renderer that reloads or closes while a history capture is streaming never sends
 * `stream-close`/`stream-abort`, so its main-process write streams would stay open for the life of
 * the app — leaking file handles and permanently blocking "Change Folder". Bind teardown once per
 * webContents. `did-navigate` fires only for real document navigations (SPA routing emits
 * `did-navigate-in-page` instead), so in-app navigation never cancels an in-flight capture.
 */
function registerDataHistoryStreamCleanup(sender: Electron.WebContents): void {
  if (dataHistoryStreamOwners.has(sender.id)) {
    return;
  }
  dataHistoryStreamOwners.add(sender.id);
  const abortStreams = () => void abortDataHistoryStreamsForSender(sender.id);
  sender.on('did-navigate', abortStreams);
  sender.once('destroyed', () => {
    dataHistoryStreamOwners.delete(sender.id);
    abortStreams();
  });
}

const handleDataHistoryRequest: MainIpcHandler<'dataHistoryRequest'> = async (event, payload) => {
  registerDataHistoryStreamCleanup(event.sender);
  return await handleDataHistoryOp(payload, { senderId: event.sender.id });
};

const handleGetDataHistoryFolder: MainIpcHandler<'getDataHistoryFolder'> = async () => {
  return getDataHistoryFolderPath();
};

const handlePickDataHistoryFolder: MainIpcHandler<'pickDataHistoryFolder'> = async () => {
  // The chosen path deliberately never transits the renderer: the dialog is shown AND applied here
  // in the main process, so a compromised renderer cannot silently redirect all history (existing
  // and future Salesforce data) to a path it chose — only a real user gesture in the OS dialog can.
  const result = await dialog.showOpenDialog({
    buttonLabel: 'Select Folder',
    defaultPath: app.getPath('downloads'),
    properties: ['openDirectory', 'createDirectory'],
  });
  if (result.canceled) {
    return null;
  }
  return await setDataHistoryFolderPath(result.filePaths[0]);
};

const handleOpenFile: MainIpcHandler<'openFile'> = async (_event, filePath: string): Promise<void> => {
  try {
    await shell.openPath(filePath);
  } catch (ex) {
    logger.error('Error opening file', ex);
    throw ex;
  }
};

const handleShowFileInFolder: MainIpcHandler<'showFileInFolder'> = async (_event, filePath: string): Promise<void> => {
  try {
    shell.showItemInFolder(filePath);
  } catch (ex) {
    logger.error('Error showing file in folder', ex);
    throw ex;
  }
};

// Ensure that the IPC handlers are only registered once - otherwise electron will throw an error
let ipcRegistered = false;

export function registerIpc(): void {
  if (ipcRegistered) {
    return; // Prevent duplicate registration
  }
  ipcRegistered = true;
  registerHandler('login', handleLoginEvent);
  registerHandler('logout', handleLogoutEvent);
  registerHandler('addOrg', handleAddOrgEvent);
  registerHandler('checkAuth', handleCheckAuthEvent);
  registerHandler('selectFolder', handleSelectFolderEvent);
  registerHandler('getPreferences', handleGetPreferences);
  registerHandler('setPreferences', handleSetPreferences);
  registerHandler('configureCrashReporter', handleConfigureCrashReporter);
  // Handle API requests to Salesforce
  registerHandler('request', handleRequestEvent);
  // Handle zip download to file
  registerHandler('downloadZipToFile', handleDownloadZipToFile);
  registerHandler('downloadBulkApiFile', handleDownloadBulkApiFile);
  // Handle file operations
  registerHandler('openFile', handleOpenFile);
  registerHandler('showFileInFolder', handleShowFileInFolder);
  // Handle native Data History storage
  registerHandler('dataHistoryRequest', handleDataHistoryRequest);
  registerHandler('getDataHistoryFolder', handleGetDataHistoryFolder);
  registerHandler('pickDataHistoryFolder', handlePickDataHistoryFolder);
  // Handle auto-update requests
  registerHandler('checkForUpdates', handleCheckForUpdatesEvent);
  registerHandler('getUpdateStatus', handleGetUpdateStatusEvent);
  registerHandler('getUpdatePolicy', handleGetUpdatePolicyEvent);
  registerHandler('installUpdate', handleInstallUpdateEvent);
  // Handle Google Picker
  registerHandler('openGooglePicker', handleOpenGooglePickerEvent);
}

const handleSelectFolderEvent: MainIpcHandler<'selectFolder'> = async () => {
  const result = await dialog.showOpenDialog({
    buttonLabel: 'Select Folder',
    defaultPath: app.getPath('downloads'),
    properties: ['openDirectory', 'createDirectory'],
  });
  if (result.canceled) {
    return null;
  }
  return result.filePaths[0];
};

const handleGetPreferences: MainIpcHandler<'getPreferences'> = async () => {
  return dataService.getUserPreferences();
};

const handleSetPreferences: MainIpcHandler<'setPreferences'> = async (_, payload) => {
  // `dataHistoryFolder` is owned by the main process — only `pickDataHistoryFolder` (an OS folder
  // dialog the user drives) may set it, and the renderer is deliberately never told the path (see
  // that handler). The renderer round-trips its whole preferences snapshot through here on every
  // toggle, so without this a snapshot taken before a relocation would silently point history back
  // at the old folder — and any renderer code could aim all history I/O at an arbitrary path.
  const { dataHistoryFolder: _mainProcessOwned, ...rendererPreferences } = payload;
  const updatedPreferences = dataService.updateUserPreferences(rendererPreferences);
  // Start or stop the background update timers immediately, so the toggle takes effect without a
  // restart. An administrator policy still wins - refreshing re-applies the full precedence chain.
  await refreshUpdatePolicy();
  return updatedPreferences;
};

const handleConfigureCrashReporter: MainIpcHandler<'configureCrashReporter'> = async (_, dsn) => {
  initMainErrorTracker(dsn);
};

const handleLoginEvent: MainIpcHandler<'login'> = async (event) => {
  const { deviceId } = dataService.getAppData();
  // This is used to ensure the callback is coming from the same device
  const token = crypto.randomUUID();
  const loginUrl = `${ENV.SERVER_URL}/desktop-app/auth?deviceId=${deviceId}&token=${token}`;
  openExternalSafe(loginUrl);

  const handleCallback = async (requestUrlParams: Record<string, string>) => {
    try {
      // The desktop already knows its own deviceId (the closure `deviceId` above); the callback URL
      // only echoes it back. Accept it when present and assert it matches, but no longer require it,
      // so the browser relay page can stop putting the deviceId in the jetstream:// callback URL.
      // The `token` nonce (also generated here) is what proves the callback belongs to this login.
      const queryParams = z
        .object({ deviceId: z.literal(deviceId).optional(), token: z.literal(token), accessToken: z.string() })
        .parse(requestUrlParams);

      const accessToken = queryParams.accessToken;

      const response = await verifyAuthToken({ accessToken, deviceId });

      if (response.success) {
        const successResponse = response as AuthResponseSuccess;
        // Use the rotated token if the server provided one, otherwise keep the original token
        const activeAccessToken = successResponse.accessToken || accessToken;
        dataService.saveAuthResponseToAppData({
          deviceId,
          accessToken: activeAccessToken,
          userProfile: successResponse.userProfile,
        });

        // Unconditional: a success response cannot reach here without a 64-char encryptionKey, since
        // AuthResponseSuccessSchema requires it and a schema mismatch is returned as a failure. Guarding
        // on it would only hide a contract regression as a silent "signed in but org storage unbound".
        dataService.bindOrgStorageToUser({ userId: successResponse.userProfile.id, encryptionKey: successResponse.encryptionKey });

        const payload: AuthenticateSuccessPayload = {
          // Desktop-shaped profile (local preferences + server feature flags/signature)
          userProfile: dataService.getFullUserProfile(),
          authInfo: { deviceId, accessToken: activeAccessToken },
          success: true,
        };
        event.sender.send(IpcEventChannel.authenticate, payload);
      } else {
        // show error message to user
        // ensure auth state is cleared out if it existed
        const payload: AuthenticateFailurePayload = { success: false, error: response.error };
        event.sender.send(IpcEventChannel.authenticate, payload);
      }
    } catch (ex) {
      logger.error('Error handling callback', ex);
      const payload: AuthenticateFailurePayload = { success: false, error: 'There was an unknown error authenticating your account' };
      event.sender.send(IpcEventChannel.authenticate, payload);
    }
  };

  startDeepLinkFlow('auth', handleCallback);
};

// Tracked alongside the logout handler so handleCheckAuthEvent can detect when a logout
// has been initiated and avoid resurrecting the auth state. Without this flag, a verify
// whose server call resolves while a logout is in flight can write the rotated token back
// after the logout clears app data, undoing the logout.
let inFlightLogout: Promise<void> | null = null;

const handleLogoutEvent: MainIpcHandler<'logout'> = async () => {
  inFlightLogout ??= doHandleLogout().finally(() => {
    inFlightLogout = null;
  });
  return inFlightLogout;
};

async function doHandleLogout(): Promise<void> {
  const appData = dataService.getAppData();
  const { deviceId, accessToken } = appData;

  if (deviceId && accessToken) {
    await logout({ deviceId, accessToken });
  }

  dataService.setAppData({
    ...appData,
    accessToken: undefined,
    userProfile: undefined,
    expiresAt: undefined,
    lastChecked: undefined,
  });

  dataService.clearOrgState();
}

const handleAddOrgEvent: MainIpcHandler<'addOrg'> = async (event, payload) => {
  // : { loginUrl: string; addLoginParam?: boolean; loginHint?: string }
  const { authorizationUrl, code_verifier, nonce, state } = await oauthService.salesforceOauthInit({
    clientId: ENV.DESKTOP_SFDC_CLIENT_ID,
    redirectUri: ENV.DESKTOP_SFDC_CALLBACK_URL,
    loginUrl: payload.loginUrl,
    addLoginParam: payload.addLoginTrue,
    loginHint: payload.loginHint,
  });

  openExternalSafe(authorizationUrl.toString());

  const handleCallback = async (queryParams: Record<string, string>) => {
    try {
      const { access_token, refresh_token, userInfo } = await oauthService.salesforceOauthCallback(
        {
          clientId: ENV.DESKTOP_SFDC_CLIENT_ID,
          redirectUri: ENV.DESKTOP_SFDC_CALLBACK_URL,
          loginUrl: payload.loginUrl,
        },
        new URLSearchParams(queryParams),
        {
          code_verifier,
          nonce,
          state,
        },
      );

      const jetstreamConn = new ApiConnection({
        apiRequestAdapter: getApiRequestFactoryFn(fetch),
        userId: userInfo.user_id,
        organizationId: userInfo.organization_id,
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        accessToken: access_token!,
        apiVersion: ENV.SFDC_API_VERSION,
        instanceUrl: userInfo.urls.custom_domain || payload.loginUrl,
        refreshToken: refresh_token,
        logger: logger as any,
        enableLogging: false,
      });

      const salesforceOrg = await initConnectionFromOAuthResponse({
        jetstreamConn,
        // FIXME:
        // jetstreamOrganizationId,
      });

      event.sender.send(IpcEventChannel.orgAdded, salesforceOrg);
    } catch (ex) {
      let message = queryParams.error_description
        ? (queryParams.error_description as string)
        : 'There was an error authenticating with Salesforce.';

      if (ex instanceof ResponseBodyError) {
        message = `There was an error authenticating with Salesforce. ${ex.error_description || ''}`.trim();
      }

      logger.error('Error handling callback', ex);
      event.sender.send(IpcEventChannel.toastMessage, { type: 'error', message });
    }
  };

  startDeepLinkFlow('addOrg', handleCallback);
};

const handleOpenGooglePickerEvent: MainIpcHandler<'openGooglePicker'> = async (event, payload) => {
  const { mode, nonce: clientNonce } = payload;
  const { deviceId, accessToken } = dataService.getAppData();

  if (!accessToken || !deviceId) {
    event.sender.send(IpcEventChannel.toastMessage, {
      type: 'error',
      message: 'You must be logged in to use Google Drive integration',
    });
    throw new Error('You must be logged in to use Google Drive integration');
  }

  const nonce = crypto.randomUUID();
  const pickerParams = new URLSearchParams({
    mode,
    nonce,
  });

  // Sensitive token params go in the hash fragment so they are never sent to the server
  const hashParams = new URLSearchParams();
  if (payload.accessToken) {
    hashParams.set('accessToken', payload.accessToken);
  }
  if (payload.accessTokenExpiresAt) {
    hashParams.set('accessTokenExpiresAt', `${payload.accessTokenExpiresAt}`);
  }
  const hashFragment = hashParams.toString() ? `#${hashParams.toString()}` : '';
  const pickerUrl = `${ENV.SERVER_URL}/desktop-app/google-picker?${pickerParams.toString()}${hashFragment}`;

  openExternalSafe(pickerUrl);

  const handleCallback = async (queryParams: Record<string, string>) => {
    try {
      const parsed = z
        .discriminatedUnion('status', [
          z.object({
            nonce: z.literal(nonce),
            status: z.literal('success'),
            mode: z.enum(['file', 'folder', 'auth']).default(mode),
            googleAccessToken: z.string(),
            googleAccessTokenExpiresAt: z.coerce.number().optional(),
            fileId: z.string().optional(),
            fileName: z.string().optional(),
            mimeType: z.string().optional(),
            folderId: z.string().optional(),
            folderName: z.string().optional(),
          }),
          z.object({
            nonce: z.literal(nonce),
            status: z.literal('cancelled'),
          }),
          z.object({
            nonce: z.literal(nonce),
            status: z.literal('error'),
            errorMessage: z.string().optional(),
          }),
        ])
        .parse(queryParams);

      let result: GooglePickerResult;

      if (parsed.status === 'cancelled') {
        result = { status: 'cancelled', nonce: clientNonce };
      } else if (parsed.status === 'error') {
        result = { status: 'error', error: parsed.errorMessage || 'Unknown error', nonce: clientNonce };
      } else {
        result = {
          status: 'success',
          mode: parsed.mode || mode,
          googleAccessToken: parsed.googleAccessToken,
          googleAccessTokenExpiresAt: parsed.googleAccessTokenExpiresAt,
          fileId: parsed.fileId,
          fileName: parsed.fileName,
          mimeType: parsed.mimeType,
          folderId: parsed.folderId,
          folderName: parsed.folderName,
          nonce: clientNonce,
        };
      }

      event.sender.send(IpcEventChannel.googlePickerResult, result);
    } catch (ex) {
      logger.error('Error handling Google Picker callback', ex);
      const result: GooglePickerResult = { status: 'error', error: 'Invalid response from Google Picker', nonce: clientNonce };
      event.sender.send(IpcEventChannel.googlePickerResult, result);
    } finally {
      clearTimeout(timeout);
    }
  };

  const disposeListener = deepLink.once('googlePicker', handleCallback);

  // Remove the listener if it was not already removed - e.g. picker flow did not complete within 15 minutes
  const timeout = setTimeout(() => {
    disposeListener();
    const result: GooglePickerResult = { status: 'error', error: 'Picker timed out', nonce: clientNonce };
    event.sender.send(IpcEventChannel.googlePickerResult, result);
  }, 900000); // 15 minutes in milliseconds
};

const handleCheckAuthEvent: MainIpcHandler<'checkAuth'> = async (): Promise<
  { userProfile: UserProfileUi; authInfo: DesktopAuthInfo } | undefined
> => {
  // Check auth occasionally to ensure token is still valid
  const AUTH_CHECK_INTERVAL_HOURS = 3;
  const appData = dataService.getAppData();
  const userProfile = dataService.getFullUserProfile();
  const { deviceId, accessToken, lastChecked } = appData;
  if (accessToken && userProfile) {
    if (!lastChecked || lastChecked < addHours(new Date(), -AUTH_CHECK_INTERVAL_HOURS).getTime() || !dataService.isOrgStorageBound()) {
      const response = await verifyAuthToken({ accessToken, deviceId });
      if (!response.success) {
        if ('networkError' in response && response.networkError) {
          // Transport failure (offline, DNS, upstream proxy, etc.) — keep the cached session
          // and try again on the next interval instead of forcing re-login.
          logger.warn('Auth check skipped due to network error, keeping cached session', response.error);
          return { userProfile, authInfo: { deviceId, accessToken } };
        }
        logger.error('Authentication error', response.error);
        // Re-read so we don't clobber a fresh login that completed while verify was awaiting.
        const latestAppData = dataService.getAppData();
        if (latestAppData.accessToken && latestAppData.accessToken !== accessToken) {
          // A concurrent login replaced the token; the auth error was for the old token —
          // leave the newer session intact and surface it to the caller. Pair the newer
          // accessToken with latestAppData.deviceId so we never return a mixed-snapshot authInfo.
          return latestAppData.userProfile && latestAppData.deviceId
            ? {
                userProfile: dataService.getFullUserProfile(),
                authInfo: { deviceId: latestAppData.deviceId, accessToken: latestAppData.accessToken },
              }
            : undefined;
        }
        dataService.setAppData({
          ...latestAppData,
          accessToken: undefined,
          userProfile: undefined,
          expiresAt: undefined,
          lastChecked: undefined,
        });
        return;
      }
      const successResponse = response as AuthResponseSuccess;
      // Use the rotated token if the server provided one, otherwise keep the current token
      const activeAccessToken = successResponse.accessToken || accessToken;
      logger.info('Authentication check successful', successResponse.accessToken ? '(token rotated)' : '');

      // Re-read app data immediately before writing to detect a concurrent logout or login
      // that ran while we were awaiting verifyAuthToken. Without this, spreading the stale
      // `appData` snapshot can resurrect a session that handleLogoutEvent just cleared, or
      // clobber a newer login. setAppData below is synchronous, so once we pass these
      // checks there is no further await window for a concurrent handler to slip into.
      const latestAppData = dataService.getAppData();
      if (!latestAppData.accessToken) {
        // Concurrent logout cleared app data — do not write the rotated token back.
        return;
      }
      if (inFlightLogout) {
        // Logout is in flight (its setAppData may not have landed yet) — bail out.
        return;
      }
      if (latestAppData.accessToken !== accessToken) {
        // A concurrent login replaced the token while we were verifying. The rotated
        // token we received was issued for the OLD login, so do not write it. Surface
        // the newer session to the caller instead. Pair the newer accessToken with
        // latestAppData.deviceId so we never return a mixed-snapshot authInfo.
        return latestAppData.userProfile && latestAppData.deviceId
          ? {
              userProfile: dataService.getFullUserProfile(),
              authInfo: { deviceId: latestAppData.deviceId, accessToken: latestAppData.accessToken },
            }
          : undefined;
      }

      // If the token was rotated, decode the new expiry from the JWT
      let expiresAt = latestAppData.expiresAt;
      if (successResponse.accessToken) {
        try {
          const decoded = jwtDecode<{ exp?: number }>(successResponse.accessToken);
          if (typeof decoded.exp === 'number' && Number.isFinite(decoded.exp)) {
            expiresAt = fromUnixTime(decoded.exp).getTime();
          }
        } catch {
          // If decode fails, keep the old expiresAt
        }
      }
      dataService.setAppData({
        ...latestAppData,
        accessToken: activeAccessToken,
        userProfile: successResponse.userProfile,
        expiresAt,
        lastChecked: Date.now(),
      });
      // Unconditional for the same reason as the login path — see the comment there.
      dataService.bindOrgStorageToUser({ userId: successResponse.userProfile.id, encryptionKey: successResponse.encryptionKey });
      // Desktop-shaped profile (local preferences + server feature flags/signature) — matches the other return paths
      return { userProfile: dataService.getFullUserProfile(), authInfo: { deviceId, accessToken: activeAccessToken } };
    }

    return { userProfile, authInfo: { deviceId, accessToken } };
  }
};

const handleRequestEvent: MainIpcHandler<'request'> = async (_, { url: urlString, request: rawRequest }): Promise<IcpResponse> => {
  logger.debug('[REQUEST]', urlString, rawRequest);

  const url = new URL(urlString);

  const route = desktopRoutes.match(rawRequest.method as Method, url.pathname);

  if (!route) {
    return { headers: {}, status: 404, statusText: 'Not Found' };
  }

  const request = new Request(rawRequest.url, {
    method: rawRequest.method,
    headers: new Headers(rawRequest.headers),
    body: rawRequest.body as string | null,
  });

  const sourceOrg = getOrgFromHeaderOrQuery(request, HTTP.HEADERS.X_SFDC_ID, HTTP.HEADERS.X_SFDC_API_VERSION);
  let targetOrg: ReturnType<typeof getOrgFromHeaderOrQuery>;

  if (request.headers.has(HTTP.HEADERS.X_SFDC_ID_TARGET) || url.searchParams.has(HTTP.HEADERS.X_SFDC_ID_TARGET)) {
    targetOrg = getOrgFromHeaderOrQuery(request, HTTP.HEADERS.X_SFDC_ID_TARGET, HTTP.HEADERS.X_SFDC_API_TARGET_VERSION);
  }

  const response = await route.handler({
    request,
    params: route.params,
    jetstreamConn: sourceOrg?.jetstreamConn,
    org: sourceOrg?.org,
    targetJetstreamConn: targetOrg?.jetstreamConn,
    targetOrg: targetOrg?.org,
    // urlOverride
  });

  return {
    headers: Object.fromEntries(response.headers.entries()),
    status: response.status,
    statusText: response.statusText,
    // FIXME: based on content type, need to parse the body accordingly
    body: await response.json(),
  };
};

const handleCheckForUpdatesEvent: MainIpcHandler<'checkForUpdates'> = async (event, userInitiated) => {
  checkForUpdates(userInitiated);
  // Send current status immediately
  event.sender.send(IpcEventChannel.updateStatus, getCurrentUpdateStatus());
};

const handleGetUpdateStatusEvent: MainIpcHandler<'getUpdateStatus'> = async (_event) => {
  return getCurrentUpdateStatus();
};

const handleGetUpdatePolicyEvent: MainIpcHandler<'getUpdatePolicy'> = async (_event) => {
  return getUpdatePolicy();
};

const handleInstallUpdateEvent: MainIpcHandler<'installUpdate'> = async (_event) => {
  installUpdate();
};

const handleDownloadZipToFile: MainIpcHandler<'downloadZipToFile'> = async (
  event,
  payload: DownloadZipPayload,
): Promise<DownloadFileResult> => {
  try {
    const { orgId, nameFormat, sobject, recordIds, fileName, jobId } = payload;

    const connectionResult = initApiConnection(orgId);
    if (!connectionResult) {
      throw new Error('Could not initialize Salesforce connection');
    }
    const { jetstreamConn } = connectionResult;

    const queryMap = getBinaryFileRecordQueryMap(nameFormat);
    const fileQueryInfo = queryMap[sobject];

    if (!fileQueryInfo) {
      throw new Error(`Unsupported sObject for binary download: ${sobject}`);
    }

    const queries = fileQueryInfo.getQuery(recordIds);
    const records: unknown[] = [];
    for (const soql of queries) {
      records.push(...(await jetstreamConn.query.query(soql).then((res) => res.queryResults.records)));
    }
    const files = fileQueryInfo.transformToBinaryFileDownload(records);

    const result = await downloadAndZipFilesToDisk(jetstreamConn, files, fileName, jobId, event.sender);
    return result;
  } catch (ex) {
    logger.error('Error handling downloadZipToFile', ex);
    return {
      success: false,
      error: ex instanceof Error ? ex.message : 'An unknown error occurred',
    };
  }
};

const handleDownloadBulkApiFile: MainIpcHandler<'downloadBulkApiFile'> = async (
  event,
  payload: JetstreamEventStreamFilePayload,
): Promise<DownloadFileResult> => {
  try {
    const { fileName, link } = payload;

    const url = new URL(link);
    const [jobId, batchId] = url.pathname.split('/').slice(3, 5); // /static/bulk/750fo00000486tzAAA/751fo000004618rAAA/file
    const orgUniqueId = url.searchParams.get(HTTP.HEADERS.X_SFDC_ID);
    const type = z.enum(['request', 'result']).parse(url.searchParams.get('type'));
    const isQuery = BooleanQueryParamSchema.parse(url.searchParams.get('isQuery'));

    if (!orgUniqueId) {
      throw new Error('Missing org identifier for Bulk API file download');
    }

    const connectionResult = initApiConnection(orgUniqueId);
    if (!connectionResult) {
      throw new Error('Could not initialize Salesforce connection');
    }
    const { jetstreamConn } = connectionResult;

    return await downloadBulkApiFileAndSaveToDisk({
      jetstreamConn,
      fileName,
      jobId,
      batchId,
      isQuery,
      type,
    });
  } catch (ex) {
    logger.error('Error handling handleDownloadBulkApiFile', ex);
    return {
      success: false,
      error: ex instanceof Error ? ex.message : 'An unknown error occurred',
    };
  }
};
