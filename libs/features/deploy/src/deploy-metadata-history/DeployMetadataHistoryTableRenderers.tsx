import { css } from '@emotion/react';
import { IconName } from '@jetstream/icon-factory';
import { DeployHistoryTableContext, SalesforceDeployHistoryItem } from '@jetstream/types';
import { DataTableGenericContext, Grid, Icon } from '@jetstream/ui';
import { OrgLabelBadge } from '@jetstream/ui-core';
import { Fragment, useContext } from 'react';
import { RenderCellProps } from 'react-data-grid';

const fallbackLabel = 'Unknown Org';

export function OrgRenderer({ row: item }: RenderCellProps<SalesforceDeployHistoryItem>) {
  const { orgsById } = useContext(DataTableGenericContext) as DeployHistoryTableContext;

  const sourceOrg = item.sourceOrg ? orgsById[item.sourceOrg.uniqueId] : null;
  const destinationOrg = orgsById[item.destinationOrg?.uniqueId];
  const sourceOrgBadge = sourceOrg ? <OrgLabelBadge org={sourceOrg} /> : null;
  const destinationOrgBadge = destinationOrg ? <OrgLabelBadge org={destinationOrg} /> : item.destinationOrg?.label || fallbackLabel;

  return (
    <Fragment>
      {sourceOrgBadge && (
        <Grid
          vertical
          divProps={{
            title: `${item.sourceOrg?.label} to ${item.destinationOrg?.label || fallbackLabel}`,
          }}
        >
          <div>{sourceOrgBadge}</div>
          <div className="slds-m-left_xx-large">
            <Icon
              type="utility"
              icon="arrowdown"
              className="slds-icon slds-icon_x-small slds-icon-text-default"
              description="Right arrow"
            />
            Deploy To
            <Icon
              type="utility"
              icon="arrowdown"
              className="slds-icon slds-icon_x-small slds-icon-text-default"
              description="Right arrow"
            />
          </div>
          <div>{destinationOrgBadge}</div>
        </Grid>
      )}
      {!item.sourceOrg && (
        <Grid vertical className="slds-truncate" divProps={{ title: item.destinationOrg?.label || fallbackLabel }}>
          {destinationOrgBadge}
        </Grid>
      )}
    </Fragment>
  );
}

export function StatusRenderer({ row: item }: RenderCellProps<SalesforceDeployHistoryItem>) {
  let status: string = item.status;
  let icon: IconName = 'success';
  let iconClassName = 'slds-icon slds-icon_x-small slds-icon-text-success';
  let className = 'slds-text-color_success';
  if (item.status === 'Failed') {
    icon = 'error';
    iconClassName = 'slds-icon slds-icon_x-small slds-icon-text-error';
    className = 'slds-text-color_error';
  } else if (item.status === 'Canceled') {
    icon = 'warning';
    iconClassName = 'slds-icon slds-icon_x-small slds-icon-text-default';
    className = 'slds-text-color_default';
  } else if (item.status === 'SucceededPartial') {
    status = 'Partial Success';
    icon = 'warning';
    iconClassName = 'slds-icon slds-icon_x-small slds-icon-text-warning';
    className = 'text-color_warning';
  }

  return (
    <div className={className}>
      <Icon type="utility" icon={icon} className={iconClassName} />
      {status}
    </div>
  );
}

export function ActionRenderer({ row: item }: RenderCellProps<SalesforceDeployHistoryItem>) {
  const { onDownload, onView } = useContext(DataTableGenericContext) as DeployHistoryTableContext;

  return (
    <Grid
      vertical
      className="slds-line-height_reset"
      css={css`
        width: 180px;
      `}
    >
      <div className="slds-p-around_xx-small">
        <button className="slds-button slds-button_neutral slds-button_stretch" onClick={() => onView(item)}>
          View Details
        </button>
      </div>
      {item.fileKey && (
        <div className="slds-p-around_xx-small">
          <button className="slds-button slds-button_neutral slds-button_stretch" onClick={() => onDownload(item)}>
            Download Package
          </button>
        </div>
      )}
    </Grid>
  );
}
