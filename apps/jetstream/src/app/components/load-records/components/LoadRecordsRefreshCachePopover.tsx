import { css } from '@emotion/react';
import { SalesforceOrgUi } from '@jetstream/types';
import { Icon, Popover, PopoverRef, SalesforceLogin, Spinner } from '@jetstream/ui';
import { applicationCookieState, selectSkipFrontdoorAuth } from '@jetstream/ui-core';
import { FunctionComponent, useRef } from 'react';
import { useRecoilValue } from 'recoil';

export interface LoadRecordsRefreshCachePopoverProps {
  org: SalesforceOrgUi;
  sobject: string;
  loading: boolean;
  onReload: () => void;
}

export const LoadRecordsRefreshCachePopover: FunctionComponent<LoadRecordsRefreshCachePopoverProps> = ({
  org,
  sobject,
  loading,
  onReload,
}) => {
  const popoverRef = useRef<PopoverRef>(null);
  const { serverUrl } = useRecoilValue(applicationCookieState);
  const skipFrontDoorAuth = useRecoilValue(selectSkipFrontdoorAuth);

  function handleReload() {
    popoverRef.current?.close();
    onReload();
  }

  return (
    <Popover
      ref={popoverRef}
      placement="bottom-end"
      header={
        <header className="slds-popover__header">
          <h2 className="slds-text-heading_small" title="Refresh Metadata">
            Missing Fields?
          </h2>
        </header>
      }
      content={
        <div
          css={css`
            max-height: 80vh;
          `}
        >
          {loading && <Spinner />}
          <SalesforceLogin
            serverUrl={serverUrl}
            org={org}
            skipFrontDoorAuth={skipFrontDoorAuth}
            returnUrl={`/lightning/setup/ObjectManager/${sobject}/Details/view`}
            title={`View object in Salesforce setup`}
            iconPosition="right"
          >
            View object in Salesforce setup
          </SalesforceLogin>
          <p className="slds-m-bottom_x-small">
            If there are fields that are not showing up in the list for mapping, make sure the field is not read-only and that your user has
            access to the field.
          </p>
          <p className="slds-m-bottom_x-small">
            If the missing fields were created recently or if permissions were updated recently then you can reload the fields.
          </p>
        </div>
      }
      footer={
        <footer className="slds-popover__footer">
          <button className="slds-button slds-button_neutral slds-button_stretch" disabled={loading} onClick={handleReload}>
            <Icon type="utility" icon="refresh" className="slds-button__icon slds-button__icon_left" omitContainer />
            Reload Fields
          </button>
        </footer>
      }
      buttonProps={{
        className: 'slds-button',
      }}
    >
      {loading && <Spinner size="x-small" />}
      Not seeing all fields?
    </Popover>
  );
};

export default LoadRecordsRefreshCachePopover;
