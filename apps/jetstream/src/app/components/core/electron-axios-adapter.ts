// import {electron, shell} from 'electron';
import { AxiosAdapter, AxiosRequestConfig } from 'axios';
import { nanoid } from 'nanoid';

let port: MessagePort;

const replyHandlers = new Map();

let messageQueue = [];

export function initMessageHandler(_port: MessagePort) {
  port = _port;
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

function send(path: string, data: any): Promise<{ id: string; error: boolean; data: any }> {
  return new Promise((resolve, reject) => {
    const id = nanoid();
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
    const { error, data } = await send(config.url, {
      method: config.method,
      data: config.data,
      headers: config.headers || {},
      query: config.params || {},
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
          ...data,
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
