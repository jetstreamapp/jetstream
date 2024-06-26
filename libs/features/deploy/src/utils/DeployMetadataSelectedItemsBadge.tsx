import { css } from '@emotion/react';
import { formatNumber } from '@jetstream/shared/ui-utils';
import { pluralizeFromNumber } from '@jetstream/shared/utils';
import { DeployMetadataTableRow } from '@jetstream/types';
import { Badge, EmptyState, Popover } from '@jetstream/ui';
import { FunctionComponent, useEffect, useState } from 'react';

export interface DeployMetadataSelectedItemsBadgeProps {
  selectedRows: Set<DeployMetadataTableRow>;
}

export const DeployMetadataSelectedItemsBadge: FunctionComponent<DeployMetadataSelectedItemsBadgeProps> = ({ selectedRows }) => {
  const [selectedRowsByType, setSelectedRowsByType] = useState<Record<string, DeployMetadataTableRow[]>>({});

  useEffect(() => {
    setSelectedRowsByType(
      Array.from(selectedRows).reduce((output: Record<string, DeployMetadataTableRow[]>, row) => {
        if (row.metadata) {
          output[row.typeLabel] = output[row.typeLabel] || [];
          output[row.typeLabel].push(row);
        }
        return output;
      }, {})
    );
  }, [selectedRows]);

  return (
    <Popover
      header={
        <header className="slds-popover__header">
          <h2 className="slds-text-heading_small" title="Selected Components">
            Selected Components
          </h2>
        </header>
      }
      content={
        <div
          css={css`
            max-height: 80vh;
          `}
        >
          {!Object.keys(selectedRowsByType).length && <EmptyState headline="You don't have any items selected"></EmptyState>}
          <ul className="slds-has-dividers_top-space slds-dropdown_length-10">
            {Object.keys(selectedRowsByType)
              .sort()
              .map((typeLabel) => (
                <li className="slds-item read-only" key={typeLabel}>
                  <div className="slds-truncate slds-text-heading_small">{typeLabel}</div>
                  <ul>
                    {selectedRowsByType[typeLabel].map((row) => (
                      <li key={row.key}>
                        <div className="slds-truncate">{row.fullName}</div>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
          </ul>
        </div>
      }
      buttonProps={{ className: 'slds-button' }}
    >
      <Badge>
        {formatNumber(selectedRows.size)} {pluralizeFromNumber('Component', selectedRows.size)} Selected
      </Badge>
    </Popover>
  );
};

export default DeployMetadataSelectedItemsBadge;
