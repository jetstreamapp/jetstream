import { PlatformEventMessagePayload } from '@jetstream/types';
import { CopyToClipboard } from '@jetstream/ui';
import { Fragment, FunctionComponent } from 'react';

export interface PlatformEventMonitorEventProps {
  event: PlatformEventMessagePayload;
}

export const PlatformEventMonitorEvent: FunctionComponent<PlatformEventMonitorEventProps> = (props) => {
  const { event, payload } = props.event;
  const payloadJson = JSON.stringify(payload);
  return (
    <Fragment>
      <div className="slds-text-title slds-truncate" title={`UUID: ${event.EventUuid} - Replay Id: ${event.replayId}`}>
        <CopyToClipboard size="small" content={JSON.stringify(props)} />
        UUID: {event.EventUuid} - Replay Id: {event.replayId}
      </div>
      <pre title={payloadJson}>
        <code>{payloadJson}</code>
      </pre>
    </Fragment>
  );
};

export default PlatformEventMonitorEvent;
