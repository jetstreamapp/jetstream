/** @jsx jsx */
import { css, jsx } from '@emotion/core';
import { CheckboxToggle, Grid, GridCol } from '@jetstream/ui';
import isNumber from 'lodash/isNumber';
import { Fragment, FunctionComponent } from 'react';
import {
  AutomationControlMetadataTypeItem,
  AutomationMetadataType,
  DeploymentItemMap,
  DeploymentItemStatus,
} from '../automation-control-types';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface AutomationControlPreDeploymentTableRowProps {
  type: AutomationMetadataType;
  typeLabel: string;
  items: AutomationControlMetadataTypeItem[];
  deploymentItemMap: DeploymentItemMap;
}

export const AutomationControlPreDeploymentTableRow: FunctionComponent<AutomationControlPreDeploymentTableRowProps> = ({
  type,
  typeLabel,
  items,
  deploymentItemMap,
}) => {
  return (
    <Fragment>
      {items.map((item) => (
        <tr key={item.fullName}>
          <td>
            <Grid vertical>
              <GridCol>
                <CheckboxToggle id={`ValidationRule-${item.fullName}`} label="Is Active" hideLabel checked={item.initialValue} />
              </GridCol>
              {type === 'Flow' && <GridCol>Version: {isNumber(item.initialActiveVersion) ? item.initialActiveVersion : 'none'}</GridCol>}
            </Grid>
          </td>
          <td>
            <Grid vertical>
              <GridCol>
                <CheckboxToggle id={`ValidationRule-${item.fullName}`} label="Is Active" hideLabel checked={item.currentValue} />
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
            <div className="slds-cell-wrap slds-line-clamp" title={deploymentItemMap[item.key].status}>
              {deploymentItemMap[item.key].status}
            </div>
          </td>
        </tr>
      ))}
    </Fragment>
  );
};

export default AutomationControlPreDeploymentTableRow;
