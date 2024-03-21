import { Maybe, SalesforceOrgUi } from '@jetstream/types';
import { Card, EmptyState, Icon, SalesforceLogin, ScopedNotification, SetupIllustration, Spinner } from '@jetstream/ui';
import { FunctionComponent } from 'react';
import { Link } from 'react-router-dom';

export interface PlatformEventMonitorFetchEventStatusProps {
  serverUrl: string;
  selectedOrg: SalesforceOrgUi;
  hasPlatformEvents: boolean;
  platformEventFetchError?: Maybe<string>;
  loadingPlatformEvents: boolean;
  fetchPlatformEvents: (clearCache?: boolean) => void;
}

export const PlatformEventMonitorFetchEventStatus: FunctionComponent<PlatformEventMonitorFetchEventStatusProps> = ({
  serverUrl,
  selectedOrg,
  hasPlatformEvents,
  platformEventFetchError,
  loadingPlatformEvents,
  fetchPlatformEvents,
}) => {
  return (
    <Card>
      {!hasPlatformEvents && !platformEventFetchError && (
        <EmptyState headline="This org does not have any platform events configured" illustration={<SetupIllustration />}>
          <p>
            Create a new{' '}
            <SalesforceLogin
              serverUrl={serverUrl}
              org={selectedOrg}
              skipFrontDoorAuth
              returnUrl={`/lightning/setup/EventObjects/page?address=${encodeURIComponent(
                '/p/setup/custent/EventObjectsPage?setupid=EventObjects'
              )}`}
              iconPosition="right"
            >
              Platform Event
            </SalesforceLogin>{' '}
            to get started.
          </p>
          <button
            className="slds-button slds-button_brand slds-m-top_medium"
            onClick={() => fetchPlatformEvents(true)}
            disabled={loadingPlatformEvents}
          >
            {loadingPlatformEvents && <Spinner className="slds-spinner slds-spinner_small" />}
            <Icon type="utility" icon="refresh" className="slds-button__icon slds-button__icon_left" omitContainer />
            Check again
          </button>
        </EmptyState>
      )}

      {platformEventFetchError && (
        <ScopedNotification theme="error">
          There was a problem getting the list of platform events from Salesforce. {platformEventFetchError}.
          <p>
            If the problem persists,
            <Link to="/feedback" target="_blank">
              file a bug report
            </Link>{' '}
            or email{' '}
            <a href="mailto:support@getjetstream.app" target="_blank" rel="noreferrer">
              support@getjetstream.app
            </a>
          </p>
        </ScopedNotification>
      )}
    </Card>
  );
};

export default PlatformEventMonitorFetchEventStatus;
