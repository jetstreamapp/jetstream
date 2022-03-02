import { ICellRendererParams } from '@ag-grid-community/core';
import { css } from '@emotion/react';
import { SalesforceDeployHistoryItem } from '@jetstream/types';
import { Grid, Icon } from '@jetstream/ui';
import { Fragment, FunctionComponent } from 'react';
import OrgLabelBadge from '../../core/OrgLabelBadge';
import { DeployHistoryTableContext } from '../deploy-metadata.types';

export const OrgRenderer: FunctionComponent<ICellRendererParams> = ({ data, context }) => {
  const item = data as SalesforceDeployHistoryItem;
  const { orgsById } = context as DeployHistoryTableContext;

  const sourceOrg = item.sourceOrgId ? orgsById[item.sourceOrgId] : null;
  const destinationOrg = orgsById[item.destinationOrgId];
  const sourceOrgBadge = sourceOrg ? <OrgLabelBadge org={sourceOrg} /> : null;
  const destinationOrgBadge = destinationOrg ? <OrgLabelBadge org={destinationOrg} /> : item.destinationOrgLabel;

  return (
    <Fragment>
      {sourceOrgBadge && (
        <Grid
          vertical
          verticalAlign="center"
          divProps={{
            title: `${item.sourceOrgLabel} to ${item.destinationOrgLabel}`,
          }}
        >
          <div>{sourceOrgBadge}</div>
          <div>
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
      {!item.sourceOrgId && (
        <Grid vertical verticalAlign="center" className="slds-truncate" divProps={{ title: item.destinationOrgLabel }}>
          {destinationOrgBadge}
        </Grid>
      )}
    </Fragment>
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
