import { initMessageHandler } from './electron-axios-adapter';

const electron = window.electron;

let port: MessagePort;

export const externalMessagePorts: {
  loadWorkerPort: MessagePort;
  queryWorkerPort: MessagePort;
  jobsWorkerPort: MessagePort;
} = {
  loadWorkerPort: null,
  queryWorkerPort: null,
  jobsWorkerPort: null,
};

let resolveMessageReady;
export const electronMessagesReadyPromise = new Promise((resolve) => {
  resolveMessageReady = resolve;
});

window.onmessage = (event: MessageEvent) => {
  // event.source === window means the message is coming from the preload
  // script, as opposed to from an <iframe> or other source.
  if (event.source === window && event.data === 'main-world-port') {
    port = event.ports[0];
    externalMessagePorts.loadWorkerPort = event.ports[1];
    externalMessagePorts.queryWorkerPort = event.ports[2];
    externalMessagePorts.jobsWorkerPort = event.ports[3];
    resolveMessageReady();
  }
};

// Init
export async function init() {
  if (!electron) {
    throw new Error('Electron not initialized');
  }
  await electronMessagesReadyPromise;
  initMessageHandler(port);
}
