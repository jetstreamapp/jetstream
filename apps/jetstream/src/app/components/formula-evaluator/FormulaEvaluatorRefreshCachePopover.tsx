import { css } from '@emotion/react';
import { SalesforceOrgUi } from '@jetstream/types';
import { Icon, Popover, PopoverRef, SalesforceLogin, Spinner } from '@jetstream/ui';
import { FunctionComponent, useRef } from 'react';
import { useRecoilState } from 'recoil';
import { applicationCookieState } from '../../app-state';

export interface FormulaEvaluatorRefreshCachePopoverProps {
  org: SalesforceOrgUi;
  loading: boolean;
  onReload: () => void;
}

export const FormulaEvaluatorRefreshCachePopover: FunctionComponent<FormulaEvaluatorRefreshCachePopoverProps> = ({
  org,
  loading,
  onReload,
}) => {
  const popoverRef = useRef<PopoverRef>();
  const [{ serverUrl }] = useRecoilState(applicationCookieState);

  function handleReload() {
    popoverRef.current.close();
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
            returnUrl={`/lightning/setup/ObjectManager/home`}
            title={`View object in Salesforce setup`}
            iconPosition="right"
          >
            View object in Salesforce setup
          </SalesforceLogin>
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
      }}
    >
      {loading && <Spinner size="x-small" />}
      Not seeing recently metadata?
    </Popover>
  );
};

export default FormulaEvaluatorRefreshCachePopover;
