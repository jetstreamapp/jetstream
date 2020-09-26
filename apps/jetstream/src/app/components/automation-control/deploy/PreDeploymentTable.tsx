/** @jsx jsx */
import { css, jsx } from '@emotion/core';
import { MapOf } from '@jetstream/types';
import { CheckboxToggle, Grid, GridCol } from '@jetstream/ui';
import { FunctionComponent } from 'react';
import { AutomationItemsChildren, DeploymentItemMap } from '../automation-control-types';
import AutomationControlPreDeploymentTableRow from './PreDeploymentTableRow';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface AutomationControlPreDeploymentTableProps {
  // TODO: pass in a nicer data structure that we can use to display and track progress
  // like a map of each child item by key, put into an array
  itemsById: MapOf<AutomationItemsChildren>;
  deploymentItemMap: DeploymentItemMap;
}

export const AutomationControlPreDeploymentTable: FunctionComponent<AutomationControlPreDeploymentTableProps> = ({
  itemsById,
  deploymentItemMap,
}) => {
  return (
    <div>
      {Object.values(itemsById).map((item) => (
        <div key={item.key}>
          <span className="slds-text-heading_small">{item.sobjectLabel}</span>{' '}
          <span className="slds-text-body_small slds-text-color_weak">{item.sobjectName}</span>
          <table className="slds-table slds-table_cell-buffer slds-table_bordered">
            <thead>
              <tr>
                <th
                  scope="col"
                  css={css`
                    width: 125px;
                  `}
                >
                  <div className="slds-truncate" title="Prior Value">
                    Prior Value
                  </div>
                </th>
                <th
                  scope="col"
                  css={css`
                    width: 125px;
                  `}
                >
                  <div className="slds-truncate" title="New Value">
                    New Value
                  </div>
                </th>
                <th
                  scope="col"
                  css={css`
                    width: 110px;
                  `}
                >
                  <div className="slds-truncate" title="Type">
                    Type
                  </div>
                </th>
                <th
                  scope="col"
                  css={css`
                    width: 160px;
                  `}
                >
                  <div className="slds-truncate" title="Last Modified">
                    Last Modified
                  </div>
                </th>
                <th scope="col">
                  <div className="slds-truncate" title="Name">
                    Name
                  </div>
                </th>
                <th
                  scope="col"
                  css={css`
                    width: 160px;
                  `}
                >
                  <div className="slds-truncate" title="Progress">
                    Progress
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              <AutomationControlPreDeploymentTableRow
                type="ValidationRule"
                typeLabel="Validation Rule"
                items={item.automationItems.ValidationRule}
                deploymentItemMap={deploymentItemMap}
              />
              <AutomationControlPreDeploymentTableRow
                type="WorkflowRule"
                typeLabel="Workflow Rule"
                items={item.automationItems.WorkflowRule}
                deploymentItemMap={deploymentItemMap}
              />
              <AutomationControlPreDeploymentTableRow
                type="Flow"
                typeLabel="Process Builder"
                items={item.automationItems.Flow}
                deploymentItemMap={deploymentItemMap}
              />
              <AutomationControlPreDeploymentTableRow
                type="ApexTrigger"
                typeLabel="Apex Trigger"
                items={item.automationItems.ApexTrigger}
                deploymentItemMap={deploymentItemMap}
              />
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
};

export default AutomationControlPreDeploymentTable;
