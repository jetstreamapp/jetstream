/** @jsx jsx */
import { css, jsx } from '@emotion/react';
import { MapOf } from '@jetstream/types';
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
              {item.automationItems.ValidationRule.map((currRowItem) => (
                <AutomationControlPreDeploymentTableRow
                  key={currRowItem.fullName}
                  type="ValidationRule"
                  typeLabel="Validation Rule"
                  item={currRowItem}
                  deploymentItem={deploymentItemMap[currRowItem.key]}
                />
              ))}
              {item.automationItems.WorkflowRule.map((currRowItem) => (
                <AutomationControlPreDeploymentTableRow
                  key={currRowItem.fullName}
                  type="WorkflowRule"
                  typeLabel="Workflow Rule"
                  item={currRowItem}
                  deploymentItem={deploymentItemMap[currRowItem.key]}
                />
              ))}
              {item.automationItems.Flow.map((currRowItem) => (
                <AutomationControlPreDeploymentTableRow
                  key={currRowItem.fullName}
                  type="Flow"
                  typeLabel="Process Builder"
                  item={currRowItem}
                  deploymentItem={deploymentItemMap[currRowItem.key]}
                />
              ))}
              {item.automationItems.ApexTrigger.map((currRowItem) => (
                <AutomationControlPreDeploymentTableRow
                  key={currRowItem.fullName}
                  type="ApexTrigger"
                  typeLabel="Apex Trigger"
                  item={currRowItem}
                  deploymentItem={deploymentItemMap[currRowItem.key]}
                />
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
};

export default AutomationControlPreDeploymentTable;
