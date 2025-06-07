import { app } from 'electron';
import logger from 'electron-log';
import path from 'node:path';

const JETSTREAM_PROTOCOL = 'jetstream';

type Listener = (query: Record<string, string>) => any;

export const initDeepLink = () => {
  if (process.defaultApp) {
    if (process.argv.length >= 2) {
      app.setAsDefaultProtocolClient(JETSTREAM_PROTOCOL, process.execPath, [path.resolve(process.argv[1])]);
    }
  } else {
    app.setAsDefaultProtocolClient(JETSTREAM_PROTOCOL);
  }

  app.on('open-url', (event, url) => {
    handleCustomUrl(url);
  });

  const gotTheLock = app.requestSingleInstanceLock();

  if (!gotTheLock) {
    logger.error('Deep link: another instance is running, exiting');
    app.quit();
  } else {
    app.on('second-instance', (event, commands, workingDir) => {
      const targetUrl = commands.pop();
      if (!targetUrl) {
        return;
      }
      handleCustomUrl(targetUrl);
    });
  }

  app.whenReady().then(() => {
    const customUrl = process.argv.find((item) => item.startsWith(`${JETSTREAM_PROTOCOL}://`));
    if (customUrl) {
      handleCustomUrl(customUrl);
    }
  });
};

/**
 * Parse custom URL and emit event to any listeners
 */
const handleCustomUrl = (targetUrl: string) => {
  try {
    logger.error(`Deep link: attempting to handle: ${targetUrl}`);
    const url = new URL(targetUrl);

    if (url.protocol !== 'jetstream:') {
      logger.error(`Deep link: invalid protocol: ${url.protocol}`);
      return;
    }

    const action = url.hostname;
    logger.info(`Deep link: action found: ${action}`);

    const query = Object.fromEntries(url.searchParams.entries());

    const emitCount = listeners.emit(action, query);
    logger.info(`Deep link: emitted for ${emitCount} listeners`);
  } catch (error) {
    logger.error(`Deep link: error parsing URL: ${error}`);
  }
};

class ListenersMap {
  private map: Map<string, Set<Listener>> = new Map();

  add(action: string, listener: Listener) {
    if (!this.map.has(action)) {
      this.map.set(action, new Set());
    }
    this.map.get(action)?.add(listener);

    return this.map.get(action)?.size;
  }

  remove(action: string, listener: Listener) {
    const listeners = this.map.get(action);
    if (!listeners) {
      return;
    }

    listeners.delete(listener);

    if (listeners.size === 0) {
      this.map.delete(action);
      return;
    }

    return listeners.size;
  }

  emit(action: string, query: Record<string, string>) {
    const actionListeners = this.map.get(action);
    if (!actionListeners) {
      return;
    }

    actionListeners.forEach((listener) => listener(query));

    return actionListeners.size;
  }
}

const listeners = new ListenersMap();

export const deepLink = {
  on: (event: string, listener: Listener) => {
    const count = listeners.add(event, listener);
    logger.info(`Deep link: listener added for event ${event}. Total event listeners: ${count}`);
  },
  remove: (event: string, listener: Listener) => {
    const count = listeners.remove(event, listener);
    logger.info(`Deep link: listener removed for event ${event}. Total event listeners: ${count}`);
  },
  once: (event: string, listener: Listener) => {
    const onceListener: Listener = (query) => {
      deepLink.remove(event, onceListener);
      listener(query);
    };
    deepLink.on(event, onceListener);
  },
};
