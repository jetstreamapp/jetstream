import {
  AuthenticateFailurePayload,
  AuthenticateSuccessPayload,
  DesktopAuthInfo,
  DownloadZipPayload,
  DownloadZipResult,
  ElectronApiRequestResponse,
  IcpResponse,
} from '@jetstream/desktop/types';
import { ApiConnection, BinaryFileDownload, getApiRequestFactoryFn, getBinaryFileRecordQueryMap } from '@jetstream/salesforce-api';
import { HTTP } from '@jetstream/shared/constants';
import { UserProfileUi } from '@jetstream/types';
import { addDays } from 'date-fns';
import { app, dialog, ipcMain, shell } from 'electron';
import logger from 'electron-log';
import { Method } from 'tiny-request-router';
import { z } from 'zod';
import { checkForUpdates, getCurrentUpdateStatus, installUpdate } from '../config/auto-updater';
import { ENV } from '../config/environment';
import { desktopRoutes } from '../controllers/desktop.routes';
import { getOrgFromHeaderOrQuery, initApiConnection } from '../utils/route.utils';
import { logout, verifyAuthToken } from './api.service';
import { deepLink } from './deep-link.service';
import * as dataService from './persistence.service';
import { initConnectionFromOAuthResponse, salesforceOauthCallback, salesforceOauthInit } from './sfdc-oauth.service';
import { downloadAndZipFilesToDisk } from './zip-download.service';

type MainIpcHandler<Key extends keyof ElectronApiRequestResponse> = (
  event: Electron.IpcMainEvent,
  payload: Parameters<ElectronApiRequestResponse[Key]>[0],
) => ReturnType<ElectronApiRequestResponse[Key]>;

function registerHandler<Key extends keyof ElectronApiRequestResponse>(key: Key, handler: MainIpcHandler<Key>) {
  ipcMain.handle(key, handler);
}

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
  // Handle API requests to Salesforce
  registerHandler('request', handleRequestEvent);
  // Handle zip download to file
  registerHandler('downloadZipToFile', handleDownloadZipToFile);
  // Handle file operations
  registerHandler('openFile', handleOpenFile);
  registerHandler('showFileInFolder', handleShowFileInFolder);
  // Handle auto-update requests
  registerHandler('checkForUpdates', handleCheckForUpdatesEvent);
  registerHandler('getUpdateStatus', handleGetUpdateStatusEvent);
  registerHandler('installUpdate', handleInstallUpdateEvent);
}

const handleSelectFolderEvent: MainIpcHandler<'selectFolder'> = async (event) => {
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

const handleGetPreferences: MainIpcHandler<'getPreferences'> = async (event) => {
  return dataService.getUserPreferences();
};

const handleSetPreferences: MainIpcHandler<'setPreferences'> = async (event, payload) => {
  return dataService.updateUserPreferences(payload);
};

const handleLoginEvent: MainIpcHandler<'login'> = async (event) => {
  const { deviceId } = dataService.getAppData();
  // This is used to ensure the callback is coming from the same device
  const token = crypto.randomUUID();
  const loginUrl = `${ENV.SERVER_URL}/desktop-app/auth?deviceId=${deviceId}&token=${token}`;
  await shell.openExternal(loginUrl);

  const handleCallback = async (requestUrlParams: Record<string, string>) => {
    try {
      const queryParams = z
        .object({ deviceId: z.literal(deviceId), token: z.literal(token), accessToken: z.string() })
        .parse(requestUrlParams);

      const accessToken = queryParams.accessToken;

      const response = await verifyAuthToken({ accessToken, deviceId });

      if (response.success) {
        const { userProfile } = dataService.saveAuthResponseToAppData({ deviceId, accessToken });
        const payload: AuthenticateSuccessPayload = {
          userProfile: userProfile as any,
          authInfo: { deviceId, accessToken },
          success: true,
        };
        event.sender.send('authenticate', payload);
      } else {
        // show error message to user
        // ensure auth state is cleared out if it existed
        const payload: AuthenticateFailurePayload = { success: false, error: response.error };
        event.sender.send('authenticate', payload);
      }
    } catch (ex) {
      logger.error('Error handling callback', ex);
      const payload: AuthenticateFailurePayload = { success: false, error: 'There was an unknown error authenticating your account' };
      event.sender.send('authenticate', payload);
    } finally {
      clearTimeout(timeout);
    }
  };

  deepLink.once('auth', handleCallback);

  // Remove the listener if it was not already removed - e.g. auth flow did not completed within 15 minutes
  const timeout = setTimeout(() => {
    deepLink.remove('auth', handleCallback);
  }, 900000); // 15 minutes in milliseconds
};

const handleLogoutEvent: MainIpcHandler<'logout'> = async (event) => {
  const appData = dataService.getAppData();
  const { deviceId, accessToken } = appData;

  if (deviceId && accessToken) {
    logout({ deviceId, accessToken });
  }

  dataService.setAppData({
    ...appData,
    accessToken: undefined,
    userProfile: undefined,
    expiresAt: undefined,
    lastChecked: undefined,
  });
};

const handleAddOrgEvent: MainIpcHandler<'addOrg'> = async (event, payload) => {
  // : { loginUrl: string; addLoginParam?: boolean; loginHint?: string }
  const { authorizationUrl, code_verifier, nonce, state } = await salesforceOauthInit(payload.loginUrl, {
    addLoginParam: payload.addLoginTrue,
    loginHint: payload.loginHint,
  });

  await shell.openExternal(authorizationUrl);

  const handleCallback = async (queryParams: Record<string, string>) => {
    try {
      const { access_token, refresh_token, userInfo } = await salesforceOauthCallback(payload.loginUrl, queryParams, {
        code_verifier,
        nonce,
        state,
      });

      const jetstreamConn = new ApiConnection({
        apiRequestAdapter: getApiRequestFactoryFn(fetch),
        userId: userInfo.user_id,
        organizationId: userInfo.organization_id,
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        accessToken: access_token!,
        apiVersion: ENV.SFDC_API_VERSION,
        instanceUrl: userInfo.urls.custom_domain || payload.loginUrl,
        refreshToken: refresh_token,
        logging: ENV.LOG_LEVEL === 'debug',
      });

      const salesforceOrg = await initConnectionFromOAuthResponse({
        jetstreamConn,
        // FIXME:
        // jetstreamOrganizationId,
      });

      event.sender.send('orgAdded', salesforceOrg);
    } catch (ex) {
      logger.error('Error handling callback', ex);
    } finally {
      clearTimeout(timeout);
    }
  };

  deepLink.once('addOrg', handleCallback);

  // Remove the listener if it was not already removed - e.g. auth flow did not completed within 15 minutes
  const timeout = setTimeout(() => {
    deepLink.remove('addOrg', handleCallback);
  }, 900000); // 15 minutes in milliseconds
};

const handleCheckAuthEvent: MainIpcHandler<'checkAuth'> = async (
  event,
): Promise<{ userProfile: UserProfileUi; authInfo: DesktopAuthInfo } | undefined> => {
  const AUTH_CHECK_INTERVAL_DAYS = 1;
  const appData = dataService.getAppData();
  const userProfile = dataService.getFullUserProfile();
  const { deviceId, accessToken, lastChecked } = appData;
  if (accessToken && userProfile) {
    // TODO: implement a refresh token flow
    if (!lastChecked || lastChecked < addDays(new Date(), -AUTH_CHECK_INTERVAL_DAYS).getTime()) {
      const response = await verifyAuthToken({ accessToken, deviceId });
      if (!response.success) {
        logger.error('Authentication error', response.error);
        dataService.setAppData({
          ...appData,
          accessToken: undefined,
          userProfile: undefined,
          expiresAt: undefined,
          lastChecked: undefined,
        });
        return;
      }
      dataService.setAppData({
        ...appData,
        lastChecked: Date.now(),
      });
    }
    return { userProfile, authInfo: { deviceId, accessToken } };
  }
};

const handleRequestEvent: MainIpcHandler<'request'> = async (event, { url: urlString, request: rawRequest }): Promise<IcpResponse> => {
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
  checkForUpdates(false, userInitiated);
  // Send current status immediately
  event.sender.send('update-status', getCurrentUpdateStatus());
};

const handleGetUpdateStatusEvent: MainIpcHandler<'getUpdateStatus'> = async (_event) => {
  return getCurrentUpdateStatus();
};

const handleInstallUpdateEvent: MainIpcHandler<'installUpdate'> = async (_event) => {
  installUpdate();
};

const handleDownloadZipToFile: MainIpcHandler<'downloadZipToFile'> = async (
  event,
  payload: DownloadZipPayload,
): Promise<DownloadZipResult> => {
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

    const soql = fileQueryInfo.getQuery(recordIds);
    const records = await jetstreamConn.query.query(soql);
    const files: BinaryFileDownload[] = fileQueryInfo.transformToBinaryFileDownload(records.queryResults.records);

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
