import { BooleanQueryParamSchema } from '@jetstream/api-types';
import {
  AuthenticateFailurePayload,
  AuthenticateSuccessPayload,
  DesktopAuthInfo,
  DownloadFileResult,
  DownloadZipPayload,
  ElectronApiRequestResponse,
  IcpResponse,
  IpcEventChannel,
} from '@jetstream/desktop/types';
import { ApiConnection, getApiRequestFactoryFn, getBinaryFileRecordQueryMap } from '@jetstream/salesforce-api';
import * as oauthService from '@jetstream/salesforce-oauth';
import { HTTP } from '@jetstream/shared/constants';
import { JetstreamEventStreamFilePayload, UserProfileUi } from '@jetstream/types';
import { addHours } from 'date-fns';
import { app, dialog, ipcMain, shell } from 'electron';
import logger from 'electron-log';
import { ResponseBodyError } from 'oauth4webapi';
import { Method } from 'tiny-request-router';
import { z } from 'zod';
import { checkForUpdates, getCurrentUpdateStatus, installUpdate } from '../config/auto-updater';
import { ENV } from '../config/environment';
import { desktopRoutes } from '../controllers/desktop.routes';
import { getOrgFromHeaderOrQuery, initApiConnection } from '../utils/route.utils';
import { AuthResponseSuccess, logout, verifyAuthToken } from './api.service';
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
  registerHandler('downloadBulkApiFile', handleDownloadBulkApiFile);
  // Handle file operations
  registerHandler('openFile', handleOpenFile);
  registerHandler('showFileInFolder', handleShowFileInFolder);
  // Handle auto-update requests
  registerHandler('checkForUpdates', handleCheckForUpdatesEvent);
  registerHandler('getUpdateStatus', handleGetUpdateStatusEvent);
  registerHandler('installUpdate', handleInstallUpdateEvent);
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
        const { userProfile } = dataService.saveAuthResponseToAppData({
          deviceId,
          accessToken,
          userProfile: (response as AuthResponseSuccess).userProfile,
        });
        const payload: AuthenticateSuccessPayload = {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          userProfile: userProfile as any,
          authInfo: { deviceId, accessToken },
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

const handleLogoutEvent: MainIpcHandler<'logout'> = async () => {
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
};

const handleAddOrgEvent: MainIpcHandler<'addOrg'> = async (event, payload) => {
  // : { loginUrl: string; addLoginParam?: boolean; loginHint?: string }
  const { authorizationUrl, code_verifier, nonce, state } = await oauthService.salesforceOauthInit({
    clientId: ENV.DESKTOP_SFDC_CLIENT_ID,
    redirectUri: ENV.DESKTOP_SFDC_CALLBACK_URL,
    loginUrl: payload.loginUrl,
    addLoginParam: payload.addLoginTrue,
    loginHint: payload.loginHint,
  });

  await shell.openExternal(authorizationUrl.toString());

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
        logging: false,
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

const handleCheckAuthEvent: MainIpcHandler<'checkAuth'> = async (): Promise<
  { userProfile: UserProfileUi; authInfo: DesktopAuthInfo } | undefined
> => {
  // Check auth occasionally to ensure token is still valid
  const AUTH_CHECK_INTERVAL_HOURS = 3;
  const appData = dataService.getAppData();
  const userProfile = dataService.getFullUserProfile();
  const { deviceId, accessToken, lastChecked } = appData;
  if (accessToken && userProfile) {
    // TODO: implement a refresh token flow
    if (!lastChecked || lastChecked < addHours(new Date(), -AUTH_CHECK_INTERVAL_HOURS).getTime()) {
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
      logger.info('Authentication check successful');
      dataService.setAppData({
        ...appData,
        userProfile: (response as AuthResponseSuccess).userProfile,
        lastChecked: Date.now(),
      });
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
  checkForUpdates(false, userInitiated);
  // Send current status immediately
  event.sender.send(IpcEventChannel.updateStatus, getCurrentUpdateStatus());
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
