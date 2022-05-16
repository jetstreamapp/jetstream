import { MapOf } from '@jetstream/types';
import { ipcRenderer, ProtocolRequest } from 'electron';
import { isString } from 'lodash';
import { getJsforceConnection, handleRequest } from './app/electron.routes';
import { getOrgs, saveOrg } from './app/storage';
import { ElectronRequestData } from './app/types';
import * as services from '@jetstream/server-services';

// TODO: if context isolation is enabled, we will need to pass via contextBridge
ipcRenderer.on('org-added', (event, data) => {
  console.log('[EVENT][org-added]', data);
  saveOrg(data);
});

ipcRenderer.on('sfdc-frontdoor-login', async (event, data: { orgId: string; returnUrl?: string }) => {
  try {
    console.log('[EVENT][sfdc-frontdoor-login]', data);
    const { orgId, returnUrl } = data;
    const org = (await getOrgs()).find(({ uniqueId }) => uniqueId === orgId);
    const url = await services.getFrontdoorLoginUrl(getJsforceConnection(org), returnUrl);
    console.log(url);
    ipcRenderer.send('sfdc-frontdoor-login', url);
  } catch (ex) {
    console.error('[ERROR][sfdc-frontdoor-login]', ex);
  }
});

ipcRenderer.on('new-client', (event) => {
  console.log('client connected', event.senderId);
  const [port, loadWorkerPort2, queryWorkerPort2, jobsWorkerPort2] = event.ports;

  port.onmessage = handleMessage(port);
  loadWorkerPort2.onmessage = handleMessage(loadWorkerPort2);
  queryWorkerPort2.onmessage = handleMessage(queryWorkerPort2);
  jobsWorkerPort2.onmessage = handleMessage(jobsWorkerPort2);
});

const handleMessage = (port: MessagePort) => async (event) => {
  const { path, data } = event.data as { id: string; path: string; data: ElectronRequestData };
  try {
    console.log('[REQ]', path, event.data);

    const response = await handleRequest(path, data);

    console.log('[RES][SUCCESS]', path, response);
    port.postMessage({
      type: 'reply',
      id: event.data.id,
      result: { data: response },
    });
  } catch (_error) {
    let error = _error;
    if (isString(error)) {
      error = new Error(error);
    }
    // TODO: check instance of error and reply accordingly - UserFacingError
    console.warn('[RES][ERROR]', path, error.message);
    port.postMessage({
      type: 'error',
      id: event.data.id,
      result: {
        data: {
          error: true,
          message: error.message,
          data: null,
        },
      },
    });
  }
};

ipcRenderer.on('worker-http-request', async (event, { id, request }: { id: string; request: ProtocolRequest }) => {
  const { headers, method, uploadData } = request;
  const url = new URL(request.url);
  const path = url.pathname.replace('//', '').replace('localhost', '');

  try {
    const query: MapOf<string> = {};

    if (url.searchParams) {
      url.searchParams.forEach((value, key) => {
        query[key] = value;
      });
    }

    console.log('[WORKER][REQ]', url.pathname, {
      method,
      headers,
      query,
    });

    const response = await handleRequest(path, {
      method,
      headers,
      query,
      data: uploadData || {},
    });

    event.sender.send('worker-http-response', {
      type: 'reply',
      id: id,
      result: { data: response },
    });
  } catch (error) {
    console.error('[WORKER][RES][ERROR]', path, error.message);
    event.sender.send('worker-http-response', {
      type: 'error',
      id: id,
      result: {
        data: {
          error: true,
          message: error.message,
          data: null,
        },
      },
    });
  }
});
