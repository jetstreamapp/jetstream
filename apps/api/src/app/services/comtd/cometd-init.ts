/**
 * ENDED UP NOT USING THIS STUFF
 */
import { UserProfileServer } from '@jetstream/types';
import { CometdReplayExtension } from './cometd-replay-extension';
import { CometD } from 'cometd';
import * as jsforce from 'jsforce';
import { ENV } from '../../config/env-config';
import { logger } from '../../config/logger.config';

export function initCometD(user: UserProfileServer, cometd: CometD, connection: jsforce.Connection) {
  return new Promise<void>((resolve, reject) => {
    if (cometd.isDisconnected()) {
      // This appears to be unsupported
      cometd.unregisterTransport('websocket');
      cometd.configure({
        url: `${connection.instanceUrl}/cometd/${connection.version || ENV.SFDC_FALLBACK_API_VERSION}`,
        requestHeaders: {
          Authorization: `Bearer ${connection.accessToken}`,
        },
        appendMessageTypeToURL: false,
      });

      if (ENV.COMETD_DEBUG) {
        cometd.setLogLevel(ENV.COMETD_DEBUG);
      }

      cometd.registerExtension(CometdReplayExtension.EXT_NAME, new CometdReplayExtension());

      cometd.handshake((shake) => {
        if (shake.successful) {
          logger.debug('[COMETD][HANDSHAKE][SUCCESS] %s', user.id, { userId: user.id });
          resolve();
        } else {
          logger.warn('[COMETD][HANDSHAKE][ERROR] %s - %s', shake.error, user.id, { userId: user.id });
          reject(shake);
        }
      });

      cometd.addListener('/meta/connect', (message) => {
        logger.debug('[COMETD] connect - %s', message, { userId: user.id });
      });
      cometd.addListener('/meta/disconnect', (message) => {
        logger.debug('[COMETD] disconnect - %s', message, { userId: user.id });
      });
      cometd.addListener('/meta/unsuccessful', (message) => {
        logger.debug('[COMETD] unsuccessful - %s', message, { userId: user.id });
      });
      cometd.onListenerException = (exception, subscriptionHandle, isListener, message) => {
        logger.warn('[COMETD][LISTENER][ERROR] %s - %s - %o', exception?.message, message, subscriptionHandle, {
          isListener,
          userId: user.id,
        });
      };
    } else {
      resolve();
    }
  });
}
