/** @jsx jsx */
import { css, jsx } from '@emotion/core';
import { CheckboxToggle, CopyToClipboard, Grid, GridCol, Icon, SalesforceLogin, Tooltip } from '@jetstream/ui';
import classNames from 'classnames';
import { FunctionComponent } from 'react';
import { SalesforceOrgUi } from '@jetstream/types';
import { AutomationControlMetadataTypeItem, AutomationMetadataType, ToolingValidationRuleRecord } from '../automation-control-types';

interface AutomationControlContentValidationRuleProps {
  selectedOrg: SalesforceOrgUi;
  serverUrl: string;
  items: AutomationControlMetadataTypeItem<ToolingValidationRuleRecord>[];
  onChange: (
    type: AutomationMetadataType,
    value: boolean,
    item: AutomationControlMetadataTypeItem,
    grandChildItem?: AutomationControlMetadataTypeItem
  ) => void;
}

export const AutomationControlContentValidationRule: FunctionComponent<AutomationControlContentValidationRuleProps> = ({
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
            className="slds-text-align_center"
            css={css`
              width: 80px;
            `}
          >
            <div className="slds-truncate" title="Error Message">
              Message
            </div>
          </th>
          <th
            scope="col"
            className="slds-text-align_center"
            css={css`
              width: 80px;
            `}
          >
            <div className="slds-truncate" title="Error Condition">
              Condition
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
                onText="Active"
                offText="Inactive"
                hideLabel
                checked={item.currentValue}
                onChange={(value) => onChange('ValidationRule', value, item)}
              />
            </td>
            <th scope="row">
              <div title={`Open in Salesforce: ${item.label}`}>
                <SalesforceLogin
                  serverUrl={serverUrl}
                  org={selectedOrg}
                  returnUrl={`/lightning/setup/ObjectManager/${item.metadata.EntityDefinitionId}/ValidationRules/${item.metadata.Id}/view`}
                  omitIcon
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
            <td className="slds-text-align_center">
              <Tooltip
                id={`errorConditionFormula-${item.key}`}
                content={<span className="slds-text-font_monospace">{item.metadata.ErrorMessage}</span>}
              >
                <CopyToClipboard
                  icon={{ type: 'utility', icon: 'search', description: 'rule error message' }}
                  size="large"
                  content={item.metadata.ErrorMessage}
                />
              </Tooltip>
            </td>
            <td className="slds-text-align_center">
              <Tooltip
                id={`errorConditionFormula-${item.key}`}
                content={<span className="slds-text-font_monospace">{item.metadata.Metadata.errorConditionFormula}</span>}
              >
                <CopyToClipboard
                  icon={{ type: 'utility', icon: 'search', description: 'view error condition formula' }}
                  size="large"
                  content={item.metadata.Metadata.errorConditionFormula}
                />
              </Tooltip>
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

export default AutomationControlContentValidationRule;
