/** @jsx jsx */
import { css, jsx } from '@emotion/core';
import { Checkbox, Grid, GridCol } from '@jetstream/ui';
import classNames from 'classnames';
import { FunctionComponent } from 'react';
import { AutomationControlMetadataTypeItem, AutomationMetadataType, ToolingAssignmentRuleRecord } from '../automation-control-types';

interface AutomationControlContentAssignmentRuleProps {
  items: AutomationControlMetadataTypeItem<ToolingAssignmentRuleRecord>[];
  onChange: (
    type: AutomationMetadataType,
    value: boolean,
    item: AutomationControlMetadataTypeItem,
    grandChildItem?: AutomationControlMetadataTypeItem
  ) => void;
}

export const AutomationControlContentAssignmentRule: FunctionComponent<AutomationControlContentAssignmentRuleProps> = ({
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
        </tr>
      </thead>
      <tbody>
        {items.map((item) => (
          <tr key={item.fullName} className={classNames({ 'slds-is-edited': item.currentValue !== item.initialValue }, 'slds-hint-parent')}>
            <th scope="row">
              <div className="slds-cell-wrap slds-line-clamp" title={item.label}>
                {item.label}
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
                  <div className="slds-truncate" title={item.metadata.LastModifiedBy.Name}>
                    {item.metadata.LastModifiedBy.Name}
                  </div>
                </GridCol>
                <GridCol>
                  <div className="slds-truncate" title={item.metadata.LastModifiedDate}>
                    {item.metadata.LastModifiedDate}
                  </div>
                </GridCol>
              </Grid>
            </td>
            <td>
              <div className="slds-cell-wrap slds-line-clamp" title={`${item.currentValue}`}>
                <Checkbox
                  id={`AssignmentRule-${item.fullName}`}
                  label="Is Active"
                  hideLabel
                  checked={item.currentValue}
                  onChange={(value) => onChange('AssignmentRule', value, item)}
                />
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export default AutomationControlContentAssignmentRule;
