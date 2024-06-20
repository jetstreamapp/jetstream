import { logger } from '@jetstream/shared/client-logger';
import { HTTP } from '@jetstream/shared/constants';
import { SalesforceOrgUi } from '@jetstream/types';
import { CometD, Extension, Message, SubscriptionHandle } from 'cometd';
import isNumber from 'lodash/isNumber';
import { EventMessageUnsuccessful } from './platform-event-monitor.types';

const subscriptions = new Map<string, SubscriptionHandle>();

/**
 * Init cometD for org, must be called per org
 */
export function init({
  serverUrl,
  defaultApiVersion,
  selectedOrg,
  onSubscribeError,
}: {
  serverUrl: string;
  defaultApiVersion: string;
  selectedOrg: SalesforceOrgUi;
  onSubscribeError?: (message: EventMessageUnsuccessful) => void;
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
    });

    cometd.registerExtension(CometdReplayExtension.EXT_NAME, new CometdReplayExtension() as any);

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
    // Library appears to have incorrect type for subscription property
    cometd.addListener('/meta/unsuccessful', (message: unknown) => {
      logger.log('[COMETD] unsuccessful', message);
      // message.subscription -> not valid
      onSubscribeError && onSubscribeError(message as EventMessageUnsuccessful);
    });
    (cometd as any).onListenerException = (exception: Error, subscriptionHandle: string, isListener: boolean, message: string) => {
      logger.warn('[COMETD][LISTENER][ERROR]', exception?.message, message, subscriptionHandle);
    };
  });
}

export function subscribe<T = any>(
  { cometd, channel, replayId }: { cometd: CometD; channel: string; replayId?: number },
  callback: (message: T) => void
) {
  if (!cometd.isDisconnected()) {
    const replayExt = cometd.getExtension(CometdReplayExtension.EXT_NAME) as any;
    if (replayExt) {
      replayExt.addChannel(channel, replayId);
    }

    if (subscriptions.has(channel)) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      cometd.unsubscribe(subscriptions.get(channel)!);
    }
    subscriptions.set(
      channel,
      cometd.subscribe(channel, (message) => {
        callback(message as any);
      })
    );
  }
}

export function unsubscribe({ cometd, channel }: { cometd: CometD; channel: string }) {
  if (!cometd.isDisconnected()) {
    if (subscriptions.has(channel)) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      cometd.unsubscribe(subscriptions.get(channel)!, (message) => {
        logger.log('[COMETD][UNSUBSCRIBE] Unsubscribed', message);
      });
      subscriptions.delete(channel);
    }
    // if no more subscriptions, disconnect everything
    if (!subscriptions.size) {
      disconnect(cometd);
    }
  }
}

export function unsubscribeAll({ cometd }: { cometd: CometD }) {
  if (!cometd.isDisconnected()) {
    for (const subscription of subscriptions.values()) {
      cometd.unsubscribe(subscription, (message) => {
        logger.log('[COMETD][UNSUBSCRIBE] Unsubscribed', { subscription, message });
      });
    }
    subscriptions.clear();
    disconnect(cometd);
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

/** {@link https://docs.cometd.org/current7/reference/#_extensions_writing} */
class CometdReplayExtension implements Extension {
  static EXT_NAME = 'replay-extension';
  static REPLAY_FROM_KEY = 'replay';
  cometd: CometD | undefined;
  extensionEnabled = true;
  replayFromMap: Record<string, number | undefined> = {};

  setEnabled(extensionEnabled: boolean) {
    this.extensionEnabled = extensionEnabled;
  }

  addChannel(channel: string, replay?: number) {
    this.replayFromMap[channel] = replay ?? -1;
  }

  removeChannel(channel: string) {
    this.replayFromMap[channel] = undefined;
  }

  registered(name: string, cometd: CometD) {
    this.cometd = cometd;
  }

  incoming(message: Message) {
    if (isNumber(this.replayFromMap[message.channel]) && message.data?.event?.replayId) {
      this.replayFromMap[message.channel] = message.data.event.replayId;
    }
    return message;
  }

  outgoing(message: Message) {
    if (message.channel === '/meta/subscribe') {
      if (this.extensionEnabled) {
        if (!message.ext) {
          message.ext = {};
        }
        (message.ext as Record<string, unknown>)[CometdReplayExtension.REPLAY_FROM_KEY] = this.replayFromMap;
      }
    }
    return message;
  }
}
