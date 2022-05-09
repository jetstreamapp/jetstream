// import {electron, shell} from 'electron';

import { logger } from '@jetstream/shared/client-logger';

// shell

// State
const replyHandlers = new Map();
const listeners = new Map();
let messageQueue = [];
let socketClient = null;

// Init
export async function init() {
  try {
    const socketName = await window.getServerSocket();
    connectSocket(socketName, () => {
      logger.log('Connected to server socket', socketName);
    });
  } catch (ex) {
    // TODO: send rollbar error
    logger.error('Could not connect to server socket', ex);
  }
}

// Functions
function connectSocket(name: string, onOpen: () => void) {
  window.ipcConnect(name, function (client) {
    client.on('message', (data) => {
      const msg: { type: string; id: string; result: any; name: string; args: any } = JSON.parse(data);

      if (msg.type === 'error') {
        // Up to you whether or not to care about the error
        const { id, result } = msg;

        const handler = replyHandlers.get(id);
        if (handler) {
          handler.reject(result);
        }

        replyHandlers.delete(id);
      } else if (msg.type === 'reply') {
        const { id, result } = msg;

        const handler = replyHandlers.get(id);
        if (handler) {
          replyHandlers.delete(id);
          handler.resolve(result);
        }
      } else if (msg.type === 'push') {
        const { name, args } = msg;

        const listens = listeners.get(name);
        if (listens) {
          listens.forEach((listener) => {
            listener(args);
          });
        }
      } else {
        throw new Error('Unknown message type: ' + JSON.stringify(msg));
      }
    });

    client.on('connect', () => {
      socketClient = client;

      // Send any messages that were queued while closed
      if (messageQueue.length > 0) {
        messageQueue.forEach((msg) => client.emit('message', msg));
        messageQueue = [];
      }

      onOpen();
    });

    client.on('disconnect', () => {
      socketClient = null;
    });
  });
}

export function send(name, args) {
  return new Promise((resolve, reject) => {
    const id = window.uuid();
    replyHandlers.set(id, { resolve, reject });
    if (socketClient) {
      socketClient.emit('message', JSON.stringify({ id, name, args }));
    } else {
      messageQueue.push(JSON.stringify({ id, name, args }));
    }
  });
}

export function listen(name: string, cb: () => void) {
  if (!listeners.get(name)) {
    listeners.set(name, []);
  }
  listeners.get(name).push(cb);

  return () => {
    listeners.set(
      name,
      listeners.get(name).filter((cb_) => cb_ !== cb)
    );
  };
}

export function unListen(name) {
  listeners.set(name, []);
}
