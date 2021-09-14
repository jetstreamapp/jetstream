import { logger } from '@jetstream/shared/client-logger';
import { HTTP } from '@jetstream/shared/constants';
import { MapOf, SalesforceOrgUi } from '@jetstream/types';
import { CometD, Extension, Message } from 'cometd';
import isNumber from 'lodash/isNumber';

/**
 * TODO: a worker might be the best solution here to ensure events are received from background
 */

const subscriptions = new Map();

/**
 * Init cometD for org, must be called per org
 */
export function init({
  serverUrl,
  defaultApiVersion,
  selectedOrg,
}: {
  serverUrl: string;
  defaultApiVersion: string;
  selectedOrg: SalesforceOrgUi;
}) {
  return new Promise<CometD>((resolve, reject) => {
    const cometd = new CometD();
    cometd.unregisterTransport('websocket');
    cometd.configure({
      url: `${serverUrl}/platform-event?${HTTP.HEADERS.X_SFDC_ID}=${encodeURIComponent(selectedOrg.uniqueId)}`,
      requestHeaders: {
        [HTTP.HEADERS.X_SFDC_API_VERSION]: defaultApiVersion,
      },
      appendMessageTypeToURL: false,
      // logLevel: 'debug',
    });

    cometd.registerExtension(CometdReplayExtension.EXT_NAME, new CometdReplayExtension());

    cometd.handshake((shake) => {
      if (shake.successful) {
        logger.log('[COMETD][HANDSHAKE][SUCCESS]');
        resolve(cometd);
      } else {
        logger.warn('[COMETD][HANDSHAKE][ERROR]', shake.error);
        reject(shake);
      }
    });

    cometd.addListener('/meta/connect', (message) => {
      logger.log('[COMETD] connect', message);
    });
    cometd.addListener('/meta/disconnect', (message) => {
      logger.log('[COMETD] disconnect', message);
    });
    cometd.addListener('/meta/unsuccessful', (message) => {
      logger.log('[COMETD] unsuccessful', message);
    });
    cometd.onListenerException = (exception, subscriptionHandle, isListener, message) => {
      logger.warn('[COMETD][LISTENER][ERROR]', exception?.message, message, subscriptionHandle);
    };
  });
}

export function subscribe<T = any>(
  { cometd, platformEventName, replayId }: { cometd: CometD; platformEventName: string; replayId?: number },
  callback: (message: T) => void
) {
  const channel = `/event/${platformEventName}`;

  if (!cometd.isDisconnected()) {
    const replayExt = cometd.getExtension(CometdReplayExtension.EXT_NAME) as CometdReplayExtension;
    if (replayExt) {
      replayExt.addChannel(platformEventName, replayId);
    }

    if (subscriptions.has(platformEventName)) {
      cometd.unsubscribe(subscriptions.get(platformEventName));
    }
    subscriptions.set(
      platformEventName,
      cometd.subscribe(channel, (message) => {
        callback(message);
      })
    );
  }
}

export function unsubscribe({ cometd, platformEventName }: { cometd: CometD; platformEventName: string }) {
  if (!cometd.isDisconnected()) {
    if (subscriptions.has(platformEventName)) {
      cometd.unsubscribe(subscriptions.get(platformEventName));
      subscriptions.delete(platformEventName);
    }
    // if no more subscriptions, disconnect everything
    if (!subscriptions.size) {
      disconnect(cometd);
    }
  }
}

/**
 * Should be called when user goes to a different page
 */
export function disconnect(cometd: CometD) {
  cometd.clearListeners();
  cometd.clearSubscriptions();
  cometd.disconnect((message) => {
    logger.log('[COMETD][DISCONNECT] Disconnected', message);
    subscriptions.clear();
  });
}
class CometdReplayExtension implements Extension {
  static EXT_NAME = 'replay-extension';
  static REPLAY_FROM_KEY = 'replay';
  cometd: CometD;
  extensionEnabled = true;
  replayFromMap: MapOf<number> = {};

  setEnabled(extensionEnabled: boolean) {
    this.extensionEnabled = extensionEnabled;
  }

  addChannel(channel: string, replay?: number) {
    channel = channel.startsWith('/event') ? channel : `/event/${channel}`;
    this.replayFromMap[channel] = replay ?? -1;
  }

  removeChannel(channel: string) {
    channel = channel.startsWith('/event') ? channel : `/event/${channel}`;
    this.replayFromMap[channel] = undefined;
  }

  registered(name: string, cometd: CometD) {
    this.cometd = cometd;
  }

  incoming(message: Message) {
    if (isNumber(this.replayFromMap[message.channel]) && message.data?.event?.replayId) {
      this.replayFromMap[message.channel] = message.data.event.replayId;
    }
  }

  outgoing(message: Message) {
    if (message.channel === '/meta/subscribe') {
      if (this.extensionEnabled) {
        if (!message.ext) {
          message.ext = {};
        }
        message.ext[CometdReplayExtension.REPLAY_FROM_KEY] = this.replayFromMap;
      }
    }
  }
}
