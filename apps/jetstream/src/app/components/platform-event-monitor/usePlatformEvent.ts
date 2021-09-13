import { logger } from '@jetstream/shared/client-logger';
import { describeGlobal, sobjectOperation } from '@jetstream/shared/data';
import { orderObjectsBy } from '@jetstream/shared/utils';
import {
  MapOf,
  PlatformEventCollectionResponse,
  PlatformEventMessage,
  PlatformEventMessagePayload,
  SalesforceOrgUi,
} from '@jetstream/types';
import { CometD } from 'cometd';
import { DescribeGlobalSObjectResult } from 'jsforce';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRecoilState } from 'recoil';
import { applicationCookieState } from '../../app-state';
import * as platformEventUtils from './platform-event-monitor.utils';

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
  const cometD = useRef<CometD>();
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
      setMessagesByChannel({});
      return () => {
        if (cometD.current) {
          platformEventUtils.disconnect(cometD.current);
          cometD.current = undefined;
        }
      };
    }
  }, [selectedOrg]);

  useEffect(() => {
    if (selectedOrg) {
      (async () => {
        try {
          setPlatformLoadingEvents(true);
          const platformEvents = orderObjectsBy(
            (await describeGlobal(selectedOrg)).data.sobjects.filter((obj) => obj.name.endsWith('__e')),
            'name'
          );
          if (isMounted.current) {
            setPlatformEvents(platformEvents);
            setPlatformLoadingEvents(false);
          }
        } catch (ex) {
          // TODO: add error handling
        }
      })();
    }
  }, [selectedOrg]);

  const onEvent = useCallback(
    (replayId?: number) => (message: PlatformEventMessage) => {
      logger.log('[PLATFORM EVENT][RECEIVED]', message);
      if (isMounted.current) {
        const { data, channel } = message;
        setMessagesByChannel((item) => {
          item = { ...item };
          item[channel] = { ...(item[channel] || { messages: [], replayId }) };
          item[channel].messages = [data].concat(item[channel].messages);
          return item;
        });
      }
    },
    []
  );

  const subscribe = useCallback(
    async (platformEventName: string, replayId?: number) => {
      if (selectedOrg) {
        if (!cometD.current || cometD.current.isDisconnected()) {
          cometD.current = await platformEventUtils.init({ defaultApiVersion, selectedOrg, serverUrl });
        }

        const cometd = cometD.current;
        platformEventUtils.subscribe({ cometd, platformEventName, replayId }, onEvent(replayId));

        setMessagesByChannel((item) => {
          item = { ...item };
          item[`/event/${platformEventName}`] = { messages: [], replayId };
          return item;
        });
      }
    },
    [selectedOrg]
  );

  const unsubscribe = useCallback(
    async (platformEventName: string) => {
      if (cometD.current) {
        const cometd = cometD.current;
        platformEventUtils.unsubscribe({ cometd, platformEventName });

        setMessagesByChannel((item) => {
          return Object.keys(item)
            .filter((key) => key !== `/event/${platformEventName}`)
            .reduce((output: MessagesByChannel, key) => {
              output[key] = item[key];
              return output;
            }, {});
        });
      }
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
