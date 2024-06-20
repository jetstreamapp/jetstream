import { css } from '@emotion/react';
import { Popover, PopoverRef } from '@jetstream/ui';
import { FunctionComponent, useRef } from 'react';
import { getProcessBuilderCachedSince } from './automation-control-data-utils';

export interface AutomationControlLastRefreshedPopoverProps {
  onRefresh: () => void;
}

export const AutomationControlLastRefreshedPopover: FunctionComponent<AutomationControlLastRefreshedPopoverProps> = ({ onRefresh }) => {
  const popoverRef = useRef<PopoverRef>(null);

  function handleRefresh() {
    if (popoverRef.current) {
      popoverRef.current.close();
    }
    onRefresh();
  }

  return (
    <Popover
      ref={popoverRef}
      header={
        <header className="slds-popover__header">
          <h2 className="slds-text-heading_small" title="Refresh Metadata">
            Refresh Metadata
          </h2>
        </header>
      }
      content={
        <div
          css={css`
            max-height: 80vh;
          `}
        >
          <p>Process Builders require extra processing to determine which ones are associated to your selected objects.</p>
          <p>These are cached in your browser to keep your experience fast.</p>
          <p>Click below to refresh Process Builders.</p>
          <ul className="slds-has-dividers_top-space slds-dropdown_length-5">
            <li className="slds-item slds-text-link" onClick={() => handleRefresh()}>
              <div className="slds-truncate">Process Builders</div>
              <div className="slds-truncate slds-text-color_weak">{getProcessBuilderCachedSince()}</div>
            </li>
          </ul>
        </div>
      }
      buttonProps={{ className: 'slds-button' }}
    >
      Not seeing recent Process Builders?
    </Popover>
  );
};

export default AutomationControlLastRefreshedPopover;
