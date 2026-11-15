import { logger } from '@jetstream/shared/client-logger';
import type { SocketAck, SocketEvent } from '@jetstream/types';
import type { DefaultEventsMap } from '@socket.io/component-emitter';
import { io, Socket } from 'socket.io-client';

let socket: Socket<DefaultEventsMap, DefaultEventsMap> | null = null;

/**
 * Listeners registered through `socketClient`, kept apart from the socket itself: the socket is torn
 * down and re-created (sign out, token change, sync toggled), and a listener attached to the old one
 * would silently stop firing. Every new socket gets them all re-attached.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Listener = (...args: any[]) => void;
const listenersByEvent = new Map<string, Set<Listener>>();

function addListener(event: string, callback: Listener) {
  const listeners = listenersByEvent.get(event) ?? new Set<Listener>();
  listeners.add(callback);
  listenersByEvent.set(event, listeners);
  socket?.on(event, callback);
}

function removeListener(event: string, callback?: Listener) {
  if (callback) {
    listenersByEvent.get(event)?.delete(callback);
    socket?.off(event, callback);
  } else {
    listenersByEvent.delete(event);
    socket?.off(event);
  }
}

// websocket could introduce a 10 second delay in the connection if it fails, but that is fine for our use-case
// websocket first does not rely on sticky sessions - so this is more reliable for most users
// but some corporate users may not have the ability to perform websocket connections
const transports = ['websocket', 'polling'];

export function initSocket(serverUrl?: string, additionalHeaders?: Record<string, string>) {
  if (socket) {
    return;
  }
  if (serverUrl) {
    socket = io(serverUrl, {
      rememberUpgrade: true,
      withCredentials: true,
      extraHeaders: additionalHeaders,
      auth: additionalHeaders,
      transports,
      tryAllTransports: true,
    });
  } else {
    socket = io({
      rememberUpgrade: true,
      withCredentials: true,
      transports,
    });
  }

  for (const [event, listeners] of listenersByEvent) {
    for (const listener of listeners) {
      socket.on(event, listener);
    }
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
  if (socket) {
    // Always disconnect and null the reference, even if the socket is mid-connect/reconnect.
    // Otherwise a stale socket lingers and initSocket() early-returns, causing the next
    // authenticated user to silently reuse the previous user's connection.
    socket.disconnect();
    socket = null;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function emit<T = any>(channel: SocketEvent, event: T, callback?: (data: SocketAck<T>) => void) {
  if (!socket) {
    callback?.({ success: false, error: 'Socket not initialized' });
    return;
  }
  socket.emit(channel, event, callback);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function subscribe<T = any>(channel: SocketEvent, callback: (data: T) => void) {
  addListener(channel, callback);
}

/** Without a callback, every listener for the channel is removed */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function unsubscribe<T = any>(channel: SocketEvent, callback?: (data: T) => void) {
  removeListener(channel, callback);
}

/** Called every time the socket connects, including each reconnect after a drop */
function onConnect(callback: () => void) {
  addListener('connect', callback);
}

function offConnect(callback: () => void) {
  removeListener('connect', callback);
}

export const socketClient = {
  emit,
  subscribe,
  unsubscribe,
  onConnect,
  offConnect,
};
