/**
 * ENDED UP NOT USING THIS STUFF
 */
import { ENV, logger } from '@jetstream/api-config';
import { ApiConnection } from '@jetstream/salesforce-api';
import { UserProfileServer } from '@jetstream/types';
import { CometD } from 'cometd';
import { CometdReplayExtension } from './cometd-replay-extension';

export function initCometD(user: UserProfileServer, cometd: CometD, jetstreamConn: ApiConnection) {
  return new Promise<void>((resolve, reject) => {
    if (cometd.isDisconnected()) {
      // This appears to be unsupported
      cometd.unregisterTransport('websocket');
      cometd.configure({
        url: `${jetstreamConn.sessionInfo.instanceUrl}/cometd/${jetstreamConn.sessionInfo.apiVersion || ENV.SFDC_API_VERSION}`,
        requestHeaders: {
          Authorization: `Bearer ${jetstreamConn.sessionInfo.accessToken}`,
        },
        appendMessageTypeToURL: false,
      });

      if (ENV.COMETD_DEBUG) {
        cometd.setLogLevel(ENV.COMETD_DEBUG as any);
      }

      cometd.registerExtension(CometdReplayExtension.EXT_NAME, new CometdReplayExtension() as any);

      cometd.handshake((shake) => {
        if (shake.successful) {
          logger.debug({ userId: user.id }, '[COMETD][HANDSHAKE][SUCCESS] %s', user.id);
          resolve();
        } else {
          logger.warn({ userId: user.id }, '[COMETD][HANDSHAKE][ERROR] %s - %s', shake.error, user.id);
          reject(shake);
        }
      });

      cometd.addListener('/meta/connect', (message) => {
        logger.debug({ userId: user.id }, '[COMETD] connect - %s', message);
      });
      cometd.addListener('/meta/disconnect', (message) => {
        logger.debug({ userId: user.id }, '[COMETD] disconnect - %s', message);
      });
      cometd.addListener('/meta/unsuccessful', (message) => {
        logger.debug({ userId: user.id }, '[COMETD] unsuccessful - %s', message);
      });
      (cometd as any).onListenerException = (exception, subscriptionHandle, isListener, message) => {
        logger.warn(
          {
            isListener,
            userId: user.id,
          },
          '[COMETD][LISTENER][ERROR] %s - %s - %o',
          exception?.message,
          message,
          subscriptionHandle
        );
      };
    } else {
      resolve();
    }
  });
}
