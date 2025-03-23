import { css } from '@emotion/react';
import { SalesforceOrgUi } from '@jetstream/types';
import { applicationCookieState, selectSkipFrontdoorAuth } from '@jetstream/ui/app-state';
import classNames from 'classnames';
import { FunctionComponent, useRef } from 'react';
import { useRecoilValue } from 'recoil';
import Popover, { PopoverProps, PopoverRef } from '../popover/Popover';
import Icon from './Icon';
import SalesforceLogin from './SalesforceLogin';
import Spinner from './Spinner';

const DEFAULT_MESSAGES = [
  'Make sure all objects and fields have proper permissions.',
  'If you recently created an object or field, use the button below to clear the cache and reload from Salesforce.',
];

export interface NotSeeingRecentMetadataPopoverProps {
  className?: string;
  loading?: boolean;
  header?: string;
  /** only required to show viewInSalesforceSetup */
  org?: SalesforceOrgUi;
  /**
   * Label of button shown when popover is closed
   */
  label?: string;
  headerLabel?: string;
  /**
   * Label of button shown when popover is closed
   */
  refreshButtonLabel?: string;
  viewInSalesforceSetup?: {
    label: string;
    title: string;
    link: string;
  };
  messages?: string[];
  disabled?: boolean;
  popoverProps?: Partial<Omit<PopoverProps, 'children'>>;
  onReload: () => void;
}

export const NotSeeingRecentMetadataPopover: FunctionComponent<NotSeeingRecentMetadataPopoverProps> = ({
  className,
  org,
  loading = false,
  header = 'Missing Metadata?',
  label = 'Not seeing recent metadata?',
  refreshButtonLabel: buttonLabel = 'Refresh Metadata',
  viewInSalesforceSetup = {
    label: 'View objects in Salesforce setup',
    link: `/lightning/setup/ObjectManager/home`,
    title: `View objects in Salesforce setup`,
  },
  messages = DEFAULT_MESSAGES,
  disabled,
  popoverProps,
  onReload,
}) => {
  const { serverUrl } = useRecoilValue(applicationCookieState);
  const skipFrontDoorAuth = useRecoilValue(selectSkipFrontdoorAuth);

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
          {viewInSalesforceSetup && org && (
            <SalesforceLogin
              className="slds-m-bottom_x-small"
              serverUrl={serverUrl}
              org={org}
              skipFrontDoorAuth={skipFrontDoorAuth}
              returnUrl={viewInSalesforceSetup.link}
              title={viewInSalesforceSetup.title}
              iconPosition="right"
            >
              {viewInSalesforceSetup.label}
            </SalesforceLogin>
          )}
          {messages.map((message) => (
            <p key={message} className="slds-m-bottom_x-small">
              {message}
            </p>
          ))}
        </div>
      }
      footer={
        <footer className="slds-popover__footer">
          <button className="slds-button slds-button_neutral slds-button_stretch" disabled={loading} onClick={handleReload}>
            <Icon type="utility" icon="refresh" className="slds-button__icon slds-button__icon_left" omitContainer />
            {buttonLabel}
          </button>
        </footer>
      }
      buttonProps={{
        className: classNames(className, 'slds-button'),
        disabled,
      }}
      {...popoverProps}
    >
      {loading && <Spinner size="x-small" />}
      {label}
    </Popover>
  );
};

export default NotSeeingRecentMetadataPopover;
