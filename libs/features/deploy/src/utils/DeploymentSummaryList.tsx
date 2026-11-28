import { css } from '@emotion/react';
import { formatNumber } from '@jetstream/shared/ui-utils';
import { decodeURIComponentSafe } from '@jetstream/shared/utils';
import { ListMetadataResult, Maybe } from '@jetstream/types';
import { Grid } from '@jetstream/ui';
import { FunctionComponent, ReactNode } from 'react';

export interface DeploymentSummaryItem {
  type: string;
  fullName: string;
  /** Shown at the end of the row, e.g. a badge */
  trailingContent?: ReactNode;
}

export function getDeploymentSummaryItems(selectedMetadata: Maybe<Record<string, ListMetadataResult[]>>): DeploymentSummaryItem[] {
  return Object.entries(selectedMetadata ?? {}).flatMap(([type, items]) =>
    items.map(({ fullName }) => ({ type, fullName: decodeURIComponentSafe(fullName) })),
  );
}

export interface DeploymentSummaryListProps {
  /** The number of items is added to the heading */
  heading: string;
  items: DeploymentSummaryItem[];
  /** Any CSS length, the list scrolls beyond it */
  maxHeight: string;
}

/** The components that are about to be deployed, shown beside the options of every deployment modal */
export const DeploymentSummaryList: FunctionComponent<DeploymentSummaryListProps> = ({ heading, items, maxHeight }) => {
  return (
    <div>
      <h3 className="slds-text-heading_small slds-m-bottom_x-small">
        {heading} ({formatNumber(items.length)})
      </h3>
      <div
        className="slds-box slds-box_x-small slds-scrollable_y"
        css={css`
          max-height: ${maxHeight};
        `}
      >
        <ul className="slds-has-dividers_bottom">
          {items.map(({ type, fullName, trailingContent }) => (
            <li key={`${type}:${fullName}`} className="slds-item slds-p-vertical_xx-small">
              <Grid align="spread" verticalAlign="center">
                <span>
                  <strong>{type}</strong>: {fullName}
                </span>
                {trailingContent}
              </Grid>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default DeploymentSummaryList;
