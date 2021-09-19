import { css } from '@emotion/react';
import { CheckboxToggle, Grid, GridCol, Icon, SalesforceLogin, Tooltip } from '@jetstream/ui';
import classNames from 'classnames';
import { Fragment, FunctionComponent } from 'react';
import { SalesforceOrgUi } from '@jetstream/types';
import { AutomationControlMetadataTypeItem, AutomationMetadataType, ToolingWorkflowRuleRecord } from '../automation-control-types';

interface AutomationControlContentWorkflowRuleProps {
  selectedOrg: SalesforceOrgUi;
  serverUrl: string;
  items: AutomationControlMetadataTypeItem<ToolingWorkflowRuleRecord>[];
  onChange: (
    type: AutomationMetadataType,
    value: boolean,
    item: AutomationControlMetadataTypeItem,
    grandChildItem?: AutomationControlMetadataTypeItem
  ) => void;
}

export const AutomationControlContentWorkflowRule: FunctionComponent<AutomationControlContentWorkflowRuleProps> = ({
  selectedOrg,
  serverUrl,
  items,
  onChange,
}) => {
  return (
    <Fragment>
      <table className="slds-table slds-table_cell-buffer slds-table_bordered">
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
              <div className="slds-truncate" title="Criteria">
                Criteria
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
                Actions
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
            <tr
              key={item.fullName}
              className={classNames({ 'slds-is-edited': item.currentValue !== item.initialValue }, 'slds-hint-parent')}
            >
              <td>
                <CheckboxToggle
                  id={`WorkflowRule-${item.fullName}`}
                  label="Is Active"
                  onText="Active"
                  offText="Inactive"
                  hideLabel
                  checked={item.currentValue}
                  onChange={(value) => onChange('WorkflowRule', value, item)}
                />
              </td>
              <th scope="row">
                <div title={`Open in Salesforce: ${item.label}`}>
                  <SalesforceLogin
                    serverUrl={serverUrl}
                    org={selectedOrg}
                    returnUrl={`/lightning/setup/WorkflowRules/page?address=%2F${item.metadata.Id}&nodeId=WorkflowRules`}
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
              <td className="slds-text-align_center">{getEntryCriteria(item)}</td>
              <td className="slds-text-align_center">{getActions(item)}</td>
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
    </Fragment>
  );
};

function getEntryCriteria({ key, metadata }: AutomationControlMetadataTypeItem<ToolingWorkflowRuleRecord>) {
  if (metadata.Metadata.formula) {
    return (
      <Tooltip
        id={`entryCriteria-${key}`}
        content={
          <div>
            <strong>Formula</strong>
            <div className="slds-text-font_monospace">{metadata.Metadata.formula}</div>
          </div>
        }
      >
        {/* <CopyToClipboard
          icon={{ type: 'utility', icon: 'search', description: 'entry criteria' }}
          size="large"
          content={metadata.Metadata.formula}
        /> */}
        <Icon type="utility" icon="search" className="slds-icon slds-icon-text-default slds-icon_small" />
      </Tooltip>
    );
  } else if (Array.isArray(metadata.Metadata.criteriaItems) && metadata.Metadata.criteriaItems.length > 0) {
    const value: JSX.Element[] = [];
    if (metadata.Metadata.booleanFilter) {
      value.push(
        <div className="slds-text-font_monospace" key="formula">
          {metadata.Metadata.booleanFilter}
        </div>
      );
    }

    value.push(
      <ol className="slds-list_ordered" key="criteria-items">
        {metadata.Metadata.criteriaItems.map(({ field, operation, value }, i) => (
          <li key={i} className="slds-text-font_monospace">
            {field} {operation} {value || 'null'}
          </li>
        ))}
      </ol>
    );

    return (
      <Tooltip id={`entryCriteria-${key}`} content={<Fragment>{value}</Fragment>}>
        {/* <CopyToClipboard icon={{ type: 'utility', icon: 'search', description: 'entry criteria' }} size="large" content={value} /> */}
        <Icon type="utility" icon="search" className="slds-icon slds-icon-text-default slds-icon_small" />
      </Tooltip>
    );
  }
}

function getActions({ key, metadata }: AutomationControlMetadataTypeItem<ToolingWorkflowRuleRecord>) {
  let value: JSX.Element[] = [];
  if (Array.isArray(metadata.Metadata.actions) && metadata.Metadata.actions.length > 0) {
    value.push(
      <div key="immediate-action-items-div">
        <strong>Immediate Actions</strong>
      </div>
    );
    value = value.concat(
      <ol className="slds-list_ordered" key="immediate-action-items">
        {metadata.Metadata.actions.map((action, i) => (
          <li key={`regular-action-${i}`}>
            {action.type}: {action.name}
          </li>
        ))}
      </ol>
    );
  }

  if (Array.isArray(metadata.Metadata.workflowTimeTriggers) && metadata.Metadata.workflowTimeTriggers.length > 0) {
    value.push(
      <div key="time-based-action-items-div">
        <strong>Time-based Actions</strong>
      </div>
    );
    value = value.concat(
      metadata.Metadata.workflowTimeTriggers.map((timeTrigger, i) => (
        <div key={`time-based-action-${i}`}>
          {timeTrigger.timeLength} {timeTrigger.workflowTimeTriggerUnit} {timeTrigger.offsetFromField || ''}
          <ol className="slds-list_ordered">
            {timeTrigger.actions.map((action, k) => (
              <li key={k}>
                {action.type}: {action.name}
              </li>
            ))}
          </ol>
        </div>
      ))
    );
  }

  if (value.length > 0) {
    return (
      <Tooltip id={`entryCriteria-${key}`} content={<Fragment>{value}</Fragment>}>
        <Icon type="utility" icon="search" className="slds-icon slds-icon-text-default slds-icon_small" />
      </Tooltip>
    );
  }
}

export default AutomationControlContentWorkflowRule;
