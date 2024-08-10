import { css } from '@emotion/react';
import { SalesforceOrgUi } from '@jetstream/types';
import { FunctionComponent, useRef } from 'react';
import Popover, { PopoverRef } from '../popover/Popover';
import Icon from './Icon';
import SalesforceLogin from './SalesforceLogin';
import Spinner from './Spinner';

export interface NotSeeingRecentMetadataPopoverProps {
  loading: boolean;
  header?: string;
  /** only required to show viewInSalesforceSetup */
  org?: SalesforceOrgUi;
  serverUrl?: string;
  viewInSalesforceSetup?: {
    label: string;
    title: string;
    link: string;
  };
  disabled?: boolean;
  onReload: () => void;
}

export const NotSeeingRecentMetadataPopover: FunctionComponent<NotSeeingRecentMetadataPopoverProps> = ({
  org,
  loading,
  serverUrl,
  header = 'Missing Fields?',
  viewInSalesforceSetup = {
    label: 'View object in Salesforce setup',
    link: `/lightning/setup/ObjectManager/home`,
    title: `View object in Salesforce setup`,
  },
  disabled,
  onReload,
}) => {
  const popoverRef = useRef<PopoverRef>(null);

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
            {header}
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
          {viewInSalesforceSetup && serverUrl && org && (
            <SalesforceLogin
              serverUrl={serverUrl}
              org={org}
              skipFrontDoorAuth
              returnUrl={viewInSalesforceSetup.link}
              title={viewInSalesforceSetup.title}
              iconPosition="right"
            >
              {viewInSalesforceSetup.label}
            </SalesforceLogin>
          )}
          <p className="slds-m-bottom_x-small">Make sure all objects and fields have proper permissions.</p>
          <p className="slds-m-bottom_x-small">If metadata is not showing up, try refreshing the metadata cache.</p>
        </div>
      }
      footer={
        <footer className="slds-popover__footer">
          <button className="slds-button slds-button_neutral slds-button_stretch" disabled={loading} onClick={handleReload}>
            <Icon type="utility" icon="refresh" className="slds-button__icon slds-button__icon_left" omitContainer />
            Refresh Metadata
          </button>
        </footer>
      }
      buttonProps={{
        className: 'slds-button',
        disabled,
      }}
    >
      {loading && <Spinner size="x-small" />}
      Not seeing recent metadata?
    </Popover>
  );
};

export default NotSeeingRecentMetadataPopover;
