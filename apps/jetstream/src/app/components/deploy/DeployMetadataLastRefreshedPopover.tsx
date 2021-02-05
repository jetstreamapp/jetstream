/** @jsx jsx */
import { jsx, css } from '@emotion/react';
import { ListMetadataResultItem } from '@jetstream/connected-ui';
import { MapOf } from '@jetstream/types';
import { Popover } from '@jetstream/ui';
import { FunctionComponent } from 'react';

export interface DeployMetadataLastRefreshedPopoverProps {
  listMetadataItems: MapOf<ListMetadataResultItem>;
  onRefreshItem: (item: string) => void;
  onRefreshAll: () => void;
}

export const DeployMetadataLastRefreshedPopover: FunctionComponent<DeployMetadataLastRefreshedPopoverProps> = ({
  listMetadataItems,
  onRefreshItem,
  onRefreshAll,
}) => {
  return (
    <Popover
      placement="bottom-end"
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
          <p className="slds-m-bottom_x-small">
            Metadata is cached in your browser to keep your experience fast, but you can manually refresh the items below.
          </p>
          <ul className="slds-has-dividers_top-space slds-dropdown_length-10">
            {Object.keys(listMetadataItems).map((key) => (
              <li key={key} className="slds-item slds-text-link" onClick={() => onRefreshItem(key)}>
                <div className="slds-truncate" title={listMetadataItems[key].type}>
                  {listMetadataItems[key].type}
                </div>
                <div className="slds-truncate slds-text-color_weak" title={listMetadataItems[key].lastRefreshed}>
                  {listMetadataItems[key].lastRefreshed}
                </div>
              </li>
            ))}
          </ul>
        </div>
      }
      footer={
        <footer className="slds-popover__footer">
          <button className="slds-button slds-button_neutral slds-button_stretch" onClick={onRefreshAll}>
            Refresh All
          </button>
        </footer>
      }
    >
      <button className="slds-button">Not seeing recent metadata?</button>
    </Popover>
  );
};

export default DeployMetadataLastRefreshedPopover;
