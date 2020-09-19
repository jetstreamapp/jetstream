/** @jsx jsx */
import { jsx, css } from '@emotion/core';
import { Checkbox, Grid, GridCol, Spinner } from '@jetstream/ui';
import classNames from 'classnames';
import { Fragment, FunctionComponent } from 'react';
import {
  AutomationControlMetadataTypeItem,
  AutomationMetadataType,
  ToolingWorkflowRuleRecordWithMetadata,
} from '../automation-control-types';

interface AutomationControlContentWorkflowRuleProps {
  items: AutomationControlMetadataTypeItem<ToolingWorkflowRuleRecordWithMetadata>[];
  loading?: boolean;
  onChange: (
    type: AutomationMetadataType,
    item: AutomationControlMetadataTypeItem<ToolingWorkflowRuleRecordWithMetadata>,
    value: boolean
  ) => void;
}

export const AutomationControlContentWorkflowRule: FunctionComponent<AutomationControlContentWorkflowRuleProps> = ({
  items,
  loading,
  onChange,
}) => {
  return (
    <Fragment>
      {!loading && (!items || (!items.length && 'No items to display'))}
      {loading && (
        <span
          className="slds-is-relative"
          css={css`
            margin-left: 50px;
            margin-top: 25px;
            display: inline-block;
            min-height: 25px;
          `}
        >
          <Spinner inline />
        </span>
      )}
      {!loading && items && !!items.length && (
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
              <tr
                key={item.fullName}
                className={classNames({ 'slds-is-edited': item.currentValue !== item.initialValue }, 'slds-hint-parent')}
              >
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
                      <div className="slds-truncate" title={item.metadata.tooling.LastModifiedBy.Name}>
                        {item.metadata.tooling.LastModifiedBy.Name}
                      </div>
                    </GridCol>
                    <GridCol>
                      <div className="slds-truncate" title={item.metadata.tooling.LastModifiedDate}>
                        {item.metadata.tooling.LastModifiedDate}
                      </div>
                    </GridCol>
                  </Grid>
                </td>
                <td>
                  <div className="slds-cell-wrap slds-line-clamp" title={`${item.currentValue}`}>
                    <Checkbox
                      id={`WorkflowRule-${item.fullName}`}
                      label="Is Active"
                      hideLabel
                      checked={item.currentValue}
                      onChange={(value) => onChange('WorkflowRule', item, value)}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Fragment>
  );
};

export default AutomationControlContentWorkflowRule;
