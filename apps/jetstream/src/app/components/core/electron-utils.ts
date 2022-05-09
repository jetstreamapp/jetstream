// import {electron, shell} from 'electron';

import { logger } from '@jetstream/shared/client-logger';
import { AxiosAdapter, AxiosRequestConfig, AxiosError } from 'axios';

// shell

// State
const replyHandlers = new Map();
// const listeners = new Map();
let messageQueue = [];
// let socketClient = null;

const electron = window.electron;
let port: MessagePort;

let resolveSocketPromise;
const messagesReadyPromise = new Promise((resolve) => {
  resolveSocketPromise = resolve;
});

window.onmessage = (event: MessageEvent) => {
  // event.source === window means the message is coming from the preload
  // script, as opposed to from an <iframe> or other source.
  if (event.source === window && event.data === 'main-world-port') {
    port = event.ports[0];
    resolveSocketPromise();
  }
};

// Init
export async function init() {
  if (!electron) {
    throw new Error('Electron not initialized');
  }
  try {
    await messagesReadyPromise;
    initMessageHandler();
  } catch (ex) {
    logger.error('Could not connect to server socket', ex);
  }
}

// TODO: I could (should) move all this to prerenderer instead of main app
function initMessageHandler() {
  if (port) {
    port.onmessage = (event: MessageEvent) => {
      const { type, id, result }: { type: string; id: string; result: any } = event.data || {};

      const handler = id ? replyHandlers.get(id) : null;

      if (type === 'error') {
        if (handler) {
          handler.resolve({
            id,
            error: true,
            data: result,
          });
        }
        replyHandlers.delete(id);
      } else if (type === 'reply') {
        if (handler) {
          replyHandlers.delete(id);
          handler.resolve({
            id,
            error: false,
            data: result,
          });
        }
      } else if (type === 'push') {
        // I don't think I need this AFAIK
      } else {
        throw new Error('Unknown message type: ' + type);
      }
    };

    if (messageQueue.length > 0) {
      messageQueue.forEach((msg) => port.postMessage(msg));
      messageQueue = [];
    }
  } else {
    throw new Error('Port not initialized');
  }
}

export function send(path: string, data: any): Promise<{ id: string; error: boolean; data: any }> {
  return new Promise((resolve, reject) => {
    if (!electron) {
      return resolve({
        id: 'unknown',
        error: true,
        data: {
          error: true,
          message: 'Electron not init',
        },
      });
    }

    const id = electron.uuid();
    replyHandlers.set(id, { resolve, reject });

    if (port) {
      port.postMessage({ id, path, data });
    } else {
      messageQueue.push({ id, path, data });
    }
  });
}

export const axiosElectronAdapter: AxiosAdapter = async (config: AxiosRequestConfig) => {
  /**
   * what do I need?
   * I need to map method+endpoint to something so that I know how to handle
   */
  try {
    const { error, data } = await send(config.url.toLowerCase(), {
      method: config.method,
      data: config.data,
      headers: config.headers,
      query: config.params,
    });

    if (!error) {
      return {
        data,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: config,
        request: {},
      };
    } else {
      throw new ElectronResponseError({
        response: {
          data,
          headers: {},
        },
        code: 400,
        config,
        message: 'There was an error with the request',
        request: {},
      });
    }
  } catch (error) {
    if (error instanceof ElectronResponseError) {
      throw error;
    }
    throw new ElectronResponseError({
      response: { error: true, message: error.message },
      code: 400,
      config,
      message: error.message || 'There was an unknown error',
      request: {},
    });
  }
};

export class ElectronResponseError extends Error {
  config: AxiosRequestConfig;
  code: number;
  request: any;
  response: any;
  isAxiosError = true;
  toJSON = () => {
    return {
      message: this.message,
      name: this.name,
      stack: this.stack,
      config: this.config,
      code: this.code,
      status: this.response && this.response.status ? this.response.status : null,
    };
  };
  constructor(data: { message: string; code: number; request: any; response: any; config: AxiosRequestConfig }) {
    super(data.message);
    this.config = data.config;
    this.code = data.code;
    this.request = data.request;
    this.response = data.response;
  }
}
