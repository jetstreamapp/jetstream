import { ipcRenderer } from 'electron';
import { handleRequest } from './app/handlers';
import { saveOrg } from './app/storage';
import { ElectronRequestData } from './app/types';

let port: MessagePort;

ipcRenderer.on('org-added', (event, data) => {
  // TODO: if context isolation is enabled, we will need to pass via contextBridge
  console.log('[org-added]', data);
  saveOrg(data);
});

ipcRenderer.on('new-client', (event) => {
  console.log('client connected', event.senderId);
  const [_port] = event.ports;
  port = _port;
  port.onmessage = async (event) => {
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
    } catch (error) {
      // TODO: check instance of error and reply accordingly - UserFacingError
      console.log('[RES][ERROR]', path, error.message);
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
});
