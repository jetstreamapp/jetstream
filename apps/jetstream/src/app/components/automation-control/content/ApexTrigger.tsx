/** @jsx jsx */
import { css, jsx } from '@emotion/core';
import { CheckboxToggle, Grid, GridCol, SalesforceLogin } from '@jetstream/ui';
import classNames from 'classnames';
import { FunctionComponent } from 'react';
import { SalesforceOrgUi } from '@jetstream/types';
import { AutomationControlMetadataTypeItem, AutomationMetadataType, ToolingApexTriggerRecord } from '../automation-control-types';

interface AutomationControlContentApexTriggerProps {
  selectedOrg: SalesforceOrgUi;
  serverUrl: string;
  items: AutomationControlMetadataTypeItem<ToolingApexTriggerRecord>[];
  onChange: (
    type: AutomationMetadataType,
    value: boolean,
    item: AutomationControlMetadataTypeItem,
    grandChildItem?: AutomationControlMetadataTypeItem
  ) => void;
}

export const AutomationControlContentApexTrigger: FunctionComponent<AutomationControlContentApexTriggerProps> = ({
  selectedOrg,
  serverUrl,
  items,
  onChange,
}) => {
  return (
    <table className="slds-table slds-table_cell-buffer slds-table_bordered slds-no-row-hover">
      <thead>
        <tr className="slds-line-height_reset">
          <th
            scope="col"
            css={css`
              width: 50px;
            `}
          >
            <div className="slds-truncate" title="Is Active">
              Is Active
            </div>
          </th>
          <th
            scope="col"
            css={css`
              width: 220px;
            `}
          >
            <div className="slds-truncate" title="Name">
              Name
            </div>
          </th>
          <th scope="col">
            <div className="slds-truncate" title="Description">
              Description
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
        </tr>
      </thead>
      <tbody>
        {items.map((item) => (
          <tr key={item.fullName} className={classNames({ 'slds-is-edited': item.currentValue !== item.initialValue }, 'slds-hint-parent')}>
            <td>
              <CheckboxToggle
                id={`ApexTrigger-${item.fullName}`}
                label="Is Active"
                hideLabel
                checked={item.currentValue}
                onChange={(value) => onChange('ApexTrigger', value, item)}
              />
            </td>
            <th scope="row">
              <div title={`Open in Salesforce: ${item.label}`}>
                <SalesforceLogin
                  serverUrl={serverUrl}
                  org={selectedOrg}
                  returnUrl={`/lightning/setup/ObjectManager/${item.metadata.EntityDefinitionId}/ApexTriggers/${item.metadata.Id}/view`}
                  iconPosition="right"
                >
                  {item.label}
                </SalesforceLogin>
              </div>
            </th>
            <td>
              <div className="slds-cell-wrap slds-line-clamp" title={item.description}>
                {item.description}
              </div>
            </td>
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
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export default AutomationControlContentApexTrigger;
