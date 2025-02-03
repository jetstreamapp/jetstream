import { logger } from '@jetstream/shared/client-logger';
import { SocketAck, SocketEvent } from '@jetstream/types';
import { DefaultEventsMap } from '@socket.io/component-emitter';
import { io, Socket } from 'socket.io-client';

let socket: Socket<DefaultEventsMap, DefaultEventsMap> | null = null;

export function initSocket(serverUrl?: string, additionalHeaders?: Record<string, string>) {
  if (socket) {
    return;
  }
  if (serverUrl) {
    socket = io(serverUrl, {
      rememberUpgrade: true,
      withCredentials: true,
      extraHeaders: additionalHeaders,
    });
  } else {
    socket = io({
      rememberUpgrade: true,
      withCredentials: true,
    });
  }

  socket.on('connect', () => {
    logger.log('[SOCKET][CONNECT]', socket?.id);
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

export function disconnectSocket() {
  if (socket?.connected) {
    socket.disconnect();
    socket = null;
  }
}

function emit<T = any>(channel: SocketEvent, event: T, callback?: (data: SocketAck<T>) => void) {
  if (!socket) {
    callback?.({ success: false, error: 'Socket not initialized' });
    return;
  }
  socket.emit(channel, event, callback);
}

function subscribe<T = any>(channel: SocketEvent, callback: (data: T) => void) {
  if (!socket) {
    return;
  }
  return socket.on(channel, callback);
}

function unsubscribe<T = any>(channel: SocketEvent, callback?: (data: SocketAck<T>) => void) {
  if (!socket) {
    callback?.({ success: false, error: 'Socket not initialized' });
    return;
  }
  return socket.off(channel, callback);
}

export const socketClient = {
  emit,
  subscribe,
  unsubscribe,
};
