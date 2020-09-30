/** @jsx jsx */
import { jsx } from '@emotion/core';
import { CheckboxToggle, Grid, GridCol } from '@jetstream/ui';
import isNumber from 'lodash/isNumber';
import { FunctionComponent } from 'react';
import { AutomationControlMetadataTypeItem, AutomationMetadataType, DeploymentItem } from '../automation-control-types';
import AutomationControlPreDeploymentTableRowStatus from './PreDeploymentTableRowStatus';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface AutomationControlPreDeploymentTableRowProps {
  type: AutomationMetadataType;
  typeLabel: string;
  item: AutomationControlMetadataTypeItem;
  deploymentItem: DeploymentItem;
}

export const AutomationControlPreDeploymentTableRow: FunctionComponent<AutomationControlPreDeploymentTableRowProps> = ({
  type,
  typeLabel,
  item,
  deploymentItem,
}) => {
  return (
    <tr>
      <td>
        <Grid vertical>
          <GridCol>
            <CheckboxToggle
              id={`ValidationRule-${item.fullName}`}
              label="Is Active"
              onText="Active"
              offText="Inactive"
              hideLabel
              checked={item.initialValue}
            />
          </GridCol>
          {type === 'Flow' && <GridCol>Version: {isNumber(item.initialActiveVersion) ? item.initialActiveVersion : 'none'}</GridCol>}
        </Grid>
      </td>
      <td>
        <Grid vertical>
          <GridCol>
            <CheckboxToggle
              id={`ValidationRule-${item.fullName}`}
              label="Is Active"
              onText="Active"
              offText="Inactive"
              hideLabel
              checked={item.currentValue}
            />
          </GridCol>
          {type === 'Flow' && <GridCol>Version: {isNumber(item.currentActiveVersion) ? item.currentActiveVersion : 'none'}</GridCol>}
        </Grid>
      </td>
      <th scope="row">{typeLabel}</th>
      <td>
        <Grid vertical>
          <GridCol>
            {item.LastModifiedByName && (
              <div className="slds-truncate" title={item.LastModifiedByName}>
                {item.LastModifiedByName}
              </div>
            )}
          </GridCol>
          <GridCol>
            {item.LastModifiedDate && (
              <div className="slds-truncate" title={item.LastModifiedDate}>
                {item.LastModifiedDate}
              </div>
            )}
          </GridCol>
        </Grid>
      </td>
      <td>
        <div className="slds-cell-wrap slds-line-clamp" title={item.label}>
          {item.label}
        </div>
      </td>
      <td>
        <AutomationControlPreDeploymentTableRowStatus
          status={deploymentItem.status}
          retrieveError={deploymentItem.deploy.retrieveError}
          deployError={deploymentItem.deploy.deployError}
        />
      </td>
    </tr>
  );
};

export default AutomationControlPreDeploymentTableRow;
