import { css } from '@emotion/react';
import { ListMetadataResultItem } from '@jetstream/connected-ui';
import { Popover } from '@jetstream/ui';
import { FunctionComponent } from 'react';

export interface DeployMetadataLastRefreshedPopoverProps {
  listMetadataItems: Record<string, ListMetadataResultItem>;
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
          <p>Metadata is cached in your browser to keep your experience fast, but you can manually refresh the items below.</p>
          <p className="slds-m-bottom_x-small">
            <em>Refreshing will clear any selections you have made for that type.</em>
          </p>
          <ul className="slds-has-dividers_top-space slds-dropdown_length-10">
            {Object.keys(listMetadataItems).map((key) => (
              <li key={key} className="slds-item slds-text-link" onClick={() => onRefreshItem(key)}>
                <div className="slds-truncate" title={listMetadataItems[key].type}>
                  {listMetadataItems[key].type}
                </div>
                <div className="slds-truncate slds-text-color_weak" title={listMetadataItems[key].lastRefreshed || undefined}>
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
      buttonProps={{ className: 'slds-button' }}
    >
      Not seeing recent metadata?
    </Popover>
  );
};

export default DeployMetadataLastRefreshedPopover;
