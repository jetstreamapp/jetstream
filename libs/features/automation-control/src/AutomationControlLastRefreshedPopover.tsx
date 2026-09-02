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
            <li className="slds-item">
              {/* Real button: the clickable li was mouse-only (no focus, no Enter/Space) */}
              <button
                type="button"
                className="slds-button slds-button_reset slds-text-link w-100 slds-text-align_left"
                aria-label="Refresh Process Builders"
                onClick={() => handleRefresh()}
              >
                {/* slds-button is inline-flex, which lays the two lines out side by side — stack them */}
                <span className="slds-grid slds-grid_vertical w-100">
                  <span className="slds-truncate">Process Builders</span>
                  <span className="slds-truncate slds-text-color_weak">{getProcessBuilderCachedSince()}</span>
                </span>
              </button>
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
