/** @jsx jsx */
import { css, jsx } from '@emotion/core';
import { CheckboxToggle, Grid, GridCol } from '@jetstream/ui';
import classNames from 'classnames';
import { FunctionComponent } from 'react';
import { AutomationControlMetadataTypeItem, AutomationMetadataType, ToolingValidationRuleRecord } from '../automation-control-types';

interface AutomationControlContentValidationRuleProps {
  items: AutomationControlMetadataTypeItem<ToolingValidationRuleRecord>[];
  onChange: (
    type: AutomationMetadataType,
    value: boolean,
    item: AutomationControlMetadataTypeItem,
    grandChildItem?: AutomationControlMetadataTypeItem
  ) => void;
}

export const AutomationControlContentValidationRule: FunctionComponent<AutomationControlContentValidationRuleProps> = ({
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
          <th scope="col">
            <div className="slds-truncate" title="Rule Error Message">
              Rule Error Message
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
                id={`ValidationRule-${item.fullName}`}
                label="Is Active"
                hideLabel
                checked={item.currentValue}
                onChange={(value) => onChange('ValidationRule', value, item)}
              />
            </td>
            <th scope="row">
              <div
                className="slds-cell-wrap slds-line-clamp slds-text-link"
                title={item.label}
                onClick={() => onChange('ValidationRule', !item.currentValue, item)}
              >
                {item.label}
              </div>
            </th>
            <td>
              <div className="slds-cell-wrap slds-line-clamp" title={item.description}>
                {item.description}
              </div>
            </td>
            <td>
              <div className="slds-cell-wrap slds-line-clamp" title={item.metadata.ErrorMessage}>
                {item.metadata.ErrorMessage}
              </div>
            </td>
            <td>
              <Grid vertical>
                <GridCol>
                  {item.metadata.LastModifiedBy && (
                    <div className="slds-truncate" title={item.metadata.LastModifiedBy.Name}>
                      {item.metadata.LastModifiedBy.Name}
                    </div>
                  )}
                </GridCol>
                <GridCol>
                  <div className="slds-truncate" title={item.metadata.LastModifiedDate}>
                    {item.metadata.LastModifiedDate}
                  </div>
                </GridCol>
              </Grid>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export default AutomationControlContentValidationRule;
