import { logger } from '@jetstream/shared/client-logger';
import { SOCKET_EVENTS } from '@jetstream/shared/constants';
import * as socket from '@jetstream/shared/data';
import { describeGlobal, sobjectOperation } from '@jetstream/shared/data';
import { orderObjectsBy } from '@jetstream/shared/utils';
import {
  MapOf,
  PlatformEventCollectionResponse,
  PlatformEventMessage,
  PlatformEventMessagePayload,
  SalesforceOrgUi,
} from '@jetstream/types';
import { DescribeGlobalSObjectResult } from 'jsforce';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRecoilState } from 'recoil';
import { applicationCookieState } from '../../app-state';

export type MessagesByChannel = MapOf<{ replayId?: number; messages: PlatformEventMessagePayload[] }>;

export function usePlatformEvent({
  selectedOrg,
}: {
  selectedOrg: SalesforceOrgUi;
}): {
  platformEvents: DescribeGlobalSObjectResult[];
  messagesByChannel: MessagesByChannel;
  loadingPlatformEvents: boolean;
  subscribe: (platformEventName: string, replayId?: number) => Promise<any>;
  unsubscribe: (platformEventName: string) => Promise<any>;
  publish: (platformEventName: string, data: any) => Promise<string>;
} {
  const isMounted = useRef(null);
  const subscribed = useRef(false);
  const [{ serverUrl, defaultApiVersion }] = useRecoilState(applicationCookieState);
  const [platformEvents, setPlatformEvents] = useState<DescribeGlobalSObjectResult[]>([]);
  const [loadingPlatformEvents, setPlatformLoadingEvents] = useState<boolean>(false);
  const [messagesByChannel, setMessagesByChannel] = useState<MessagesByChannel>({});

  useEffect(() => {
    isMounted.current = true;
    return () => (isMounted.current = false);
  }, []);

  useEffect(() => {
    if (selectedOrg) {
      (async () => {
        setPlatformLoadingEvents(true);
        // TODO: what if unmount happens before results come back?
        setPlatformEvents(
          orderObjectsBy(
            (await describeGlobal(selectedOrg)).data.sobjects.filter((obj) => obj.name.endsWith('__e')),
            'name'
          )
        );
        setPlatformLoadingEvents(false);
      })();
    }
  }, [selectedOrg]);

  /**
   * Subscribe to platform event
   * unsubscribes on unmount
   * TODO: can we have this as a background thing and store X number of events in localstorage and replay once page is accessed?
   * and don't re-subscribe when page re-accessed?
   * and on org change we cancel the event?
   * Can we have in a webworker?
   */
  const subscribe = useCallback(
    async (platformEventName: string, replayId?: number) => {
      if (selectedOrg) {
        socket.emit(SOCKET_EVENTS.PLATFORM_EVENT_SUBSCRIBE, { orgId: selectedOrg.uniqueId, platformEventName, replayId }, (data) => {
          console.log('[PLATFORM EVENT]', SOCKET_EVENTS.PLATFORM_EVENT_SUBSCRIBE, data);
        });
        if (!subscribed.current) {
          subscribed.current = true;
          socket.subscribe<PlatformEventMessage>(SOCKET_EVENTS.PLATFORM_EVENT_MESSAGE, (message) => {
            logger.log('[PLATFORM EVENT]', SOCKET_EVENTS.PLATFORM_EVENT_MESSAGE, message);
            if (isMounted.current) {
              const { data, channel } = message;
              setMessagesByChannel((item) => {
                item = { ...item };
                item[channel] = { ...(item[channel] || { messages: [], replayId }) };
                item[channel].messages = [data].concat(item[channel].messages);
                return item;
              });
            }
          });
        }
        setMessagesByChannel((item) => {
          item = { ...item };
          item[`/event/${platformEventName}`] = { messages: [], replayId };
          return item;
        });
        return () => {
          socket.emit(SOCKET_EVENTS.PLATFORM_EVENT_UNSUBSCRIBE, { orgId: selectedOrg.uniqueId }, (data) => {
            console.log('[PLATFORM EVENT]', SOCKET_EVENTS.PLATFORM_EVENT_UNSUBSCRIBE, data);
          });
          socket.unsubscribe(SOCKET_EVENTS.PLATFORM_EVENT_MESSAGE, (data) => {
            console.log('[PLATFORM EVENT][UNSUBSCRIBED]', SOCKET_EVENTS.PLATFORM_EVENT_MESSAGE, data);
          });
          subscribed.current = false;
        };
      }
    },
    [selectedOrg]
  );

  /**
   * unsubscribe to platform event
   */
  const unsubscribe = useCallback(
    async (platformEventName: string) => {
      socket.emit(SOCKET_EVENTS.PLATFORM_EVENT_UNSUBSCRIBE, { orgId: selectedOrg.uniqueId, platformEventName }, (data) => {
        console.log('[PLATFORM EVENT]', SOCKET_EVENTS.PLATFORM_EVENT_UNSUBSCRIBE, data);
        // remove unsubscribed messages
        setMessagesByChannel((item) => {
          return Object.keys(item)
            .filter((key) => key !== `/event/${platformEventName}`)
            .reduce((output: MessagesByChannel, key) => {
              output[key] = item[key];
              return output;
            }, {});
        });
      });
    },
    [selectedOrg]
  );

  const publish = useCallback(
    async (platformEventName: string, body: any): Promise<string> => {
      const results = (
        await sobjectOperation<PlatformEventCollectionResponse>(selectedOrg, platformEventName, 'create', { records: [body] })
      )[0];
      const message = results.errors[0].message;
      if (results.success === false) {
        throw new Error(message);
      }
      // very strange, but the id of the event is in the errors array
      return message;
    },
    [selectedOrg]
  );

  return { platformEvents, messagesByChannel, loadingPlatformEvents, publish, subscribe, unsubscribe };
}
