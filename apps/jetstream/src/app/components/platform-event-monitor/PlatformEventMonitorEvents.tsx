/** @jsx jsx */
import { jsx } from '@emotion/react';
import { formatNumber } from '@jetstream/shared/ui-utils';
import { orderStringsBy, pluralizeIfMultiple } from '@jetstream/shared/utils';
import { Accordion, CopyToClipboard, EmptyState, NoContentIllustration, OpenRoadIllustration } from '@jetstream/ui';
import { Fragment, FunctionComponent } from 'react';
import PlatformEventMonitorEvent from './PlatformEventMonitorEvent';
import { MessagesByChannel } from './usePlatformEvent';

export interface PlatformEventMonitorEventsProps {
  messagesByChannel: MessagesByChannel;
}

export const PlatformEventMonitorEvents: FunctionComponent<PlatformEventMonitorEventsProps> = ({ messagesByChannel }) => {
  const channels = orderStringsBy(Object.keys(messagesByChannel));
  return (
    <Fragment>
      {channels.length === 0 && (
        <EmptyState headline="Subscribe to an event to see messages" illustration={<OpenRoadIllustration />}></EmptyState>
      )}
      {channels.length > 0 && (
        <Accordion
          initOpenIds={[]}
          showExpandCollapseAll
          allowMultiple
          sections={channels.map((channel) => ({
            id: channel,
            title: (
              <span>
                {channel} ({formatNumber(messagesByChannel[channel].messages.length)}{' '}
                {pluralizeIfMultiple('event', messagesByChannel[channel].messages)})
              </span>
            ), // TODO: make dynamic with num events etc.. maybe a little thing that blinks on new event?
            className: '',
            titleText: channel,
            content:
              messagesByChannel[channel].messages.length === 0 ? (
                <EmptyState headline="There are no messages" illustration={<NoContentIllustration />}></EmptyState>
              ) : (
                <div>
                  <CopyToClipboard
                    className="slds-button_neutral"
                    size="small"
                    type="button"
                    buttonText="Copy All Events to Clipboard"
                    content={JSON.stringify(messagesByChannel[channel].messages, null, 2)}
                  />
                  {messagesByChannel[channel].messages.map((event) => (
                    <PlatformEventMonitorEvent key={event.event.EventUuid} event={event} />
                  ))}
                </div>
              ),
          }))}
        ></Accordion>
      )}
    </Fragment>
  );
};

export default PlatformEventMonitorEvents;
