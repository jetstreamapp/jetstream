import { logger } from '@jetstream/shared/client-logger';
import { SocketAck } from '@jetstream/types';
import { DefaultEventsMap } from '@socket.io/component-emitter';
import { io, Socket } from 'socket.io-client';

let socket: Socket<DefaultEventsMap, DefaultEventsMap>;

export function initSocket(serverUrl?: string) {
  if (serverUrl) {
    socket = io(serverUrl, {
      rememberUpgrade: true,
      withCredentials: true,
    });
  } else {
    socket = io({
      rememberUpgrade: true,
      withCredentials: true,
    });
  }

  socket.on('connect', () => {
    logger.log('[SOCKET][CONNECT]', socket.id);
  });

  socket.on('disconnect', (reason) => {
    logger.log('[SOCKET][DISCONNECT]', reason);
  });

  socket.io.on('reconnect_attempt', () => {
    logger.log('[SOCKET][RECONNECT ATTEMPT]');
  });

  socket.io.on('reconnect', () => {
    logger.log('[SOCKET][RECONNECT]');
  });

  socket.on('connect_error', (err) => {
    logger.log('[SOCKET][CONNECT][ERROR]', err);
  });

  socket.on('error', (err) => {
    logger.log('[SOCKET][CONNECT]', err);
  });
}

// eslint-disable-next-line @typescript-eslint/no-empty-function
export function isConnected() {}

export async function emit<T = any, Ack = unknown>(channel: string, event: T): Promise<SocketAck<Ack>> {
  return new Promise((resolve, reject) => {
    try {
      // FIXME: should be able to use "return socket.timeout(20_000).emitWithAck(channel, event);" but it's not working
      // TODO: add timeout handling - or caller could use promise.race()
      socket.emit(channel, event, (data) => {
        resolve(data);
      });
    } catch (ex) {
      reject(ex);
    }
  });
}

export function subscribe<T = any>(channel: string, callback: (data: T) => void) {
  return socket.on(channel, callback);
}

export function unsubscribe<T = any>(channel: string, callback?: (data: SocketAck<T>) => void) {
  return socket.off(channel, callback);
}
