import { css } from '@emotion/react';
import { SalesforceOrgUi } from '@jetstream/types';
import { Icon, Popover, SalesforceLogin, Spinner } from '@jetstream/ui';
import { FunctionComponent, useState } from 'react';
import { useRecoilState } from 'recoil';
import { applicationCookieState } from '../../../app-state';

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
  const [isOpen, setIsOpen] = useState(false);
  const [{ serverUrl }] = useRecoilState(applicationCookieState);

  function toggleOpen() {
    setIsOpen(true);
  }

  function handleReload() {
    setIsOpen(false);
    onReload();
  }

  return (
    <Popover
      placement="bottom-end"
      isOpen={isOpen}
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
    >
      <div className="slds-is-relative">
        {loading && <Spinner size="x-small" />}
        <button className="slds-button" onClick={toggleOpen}>
          Not seeing all fields?
        </button>
      </div>
    </Popover>
  );
};

export default LoadRecordsRefreshCachePopover;
