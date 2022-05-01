import { ICellRendererParams } from '@ag-grid-community/core';
import { css } from '@emotion/react';
import { IconName } from '@jetstream/icon-factory';
import { SalesforceDeployHistoryItem } from '@jetstream/types';
import { Grid, Icon } from '@jetstream/ui';
import { Fragment, FunctionComponent } from 'react';
import OrgLabelBadge from '../../core/OrgLabelBadge';
import { DeployHistoryTableContext } from '../deploy-metadata.types';

const fallbackLabel = 'Unknown Org';

export const OrgRenderer: FunctionComponent<ICellRendererParams> = ({ data, context }) => {
  const item = data as SalesforceDeployHistoryItem;
  const { orgsById } = context as DeployHistoryTableContext;

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
            title: `${item.sourceOrg.label} to ${item.destinationOrg?.label || fallbackLabel}`,
          }}
        >
          <div>{sourceOrgBadge}</div>
          <div className="slds-m-left_xx-large">
            <Icon
              type="utility"
              icon="arrowdown"
              className="slds-icon slds-icon_x-small slds-icon-text-default"
              description="Deployed to"
            />
            Deployed To
            <Icon
              type="utility"
              icon="arrowdown"
              className="slds-icon slds-icon_x-small slds-icon-text-default"
              description="Deployed to"
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
};

export const StatusRenderer: FunctionComponent<ICellRendererParams> = ({ data, context }) => {
  const item = data as SalesforceDeployHistoryItem;
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
};

export const ActionRenderer: FunctionComponent<ICellRendererParams> = ({ data, context }) => {
  const item = data as SalesforceDeployHistoryItem;
  const { onDownload, onView } = context as DeployHistoryTableContext;

  return (
    <Grid
      vertical
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
};
