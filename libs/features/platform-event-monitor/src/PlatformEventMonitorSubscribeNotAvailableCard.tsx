import { Card, EmptyState, Grid, NoPreviewIllustration, ViewDocsLink } from '@jetstream/ui';

export const PlatformEventMonitorSubscribeNotAvailableCard = () => {
  return (
    <Card
      testId="platform-event-monitor-listener-card"
      className="slds-grow"
      icon={{ type: 'standard', icon: 'events' }}
      title={
        <Grid vertical>
          <div>Subscribe to Events</div>
          <ViewDocsLink textReset path="/developer/platform-events" />
        </Grid>
      }
    >
      <EmptyState
        headline="Unavailable in browser extension"
        subHeading="To subscribe to platform events, use the Jetstream Application instead of the browser extension."
        illustration={<NoPreviewIllustration />}
      />
    </Card>
  );
};

export default PlatformEventMonitorSubscribeNotAvailableCard;
