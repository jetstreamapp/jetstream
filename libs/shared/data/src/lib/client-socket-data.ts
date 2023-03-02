import { logger } from '@jetstream/shared/client-logger';
import { SocketAck } from '@jetstream/types';
import { io, Socket } from 'socket.io-client';
import { DefaultEventsMap } from '@socket.io/component-emitter';

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

export function emit<T = any>(channel: string, event: T, callback?: (data: SocketAck<T>) => void) {
  socket.emit(channel, event, callback);
}

export function subscribe<T = any>(channel: string, callback: (data: T) => void) {
  return socket.on(channel, callback);
}

export function unsubscribe<T = any>(channel: string, callback?: (data: SocketAck<T>) => void) {
  return socket.off(channel, callback);
}
