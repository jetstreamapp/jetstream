import { css } from '@emotion/react';
import { CheckboxToggle, Grid, GridCol, Icon, SalesforceLogin } from '@jetstream/ui';
import classNames from 'classnames';
import { Fragment, FunctionComponent } from 'react';
import { SalesforceOrgUi } from '@jetstream/types';
import {
  AutomationControlMetadataTypeItem,
  AutomationMetadataType,
  ToolingFlowDefinitionWithVersions,
  ToolingFlowRecord,
} from '../automation-control-types';

interface AutomationControlContentFlowProps {
  selectedOrg: SalesforceOrgUi;
  serverUrl: string;
  items: AutomationControlMetadataTypeItem<ToolingFlowDefinitionWithVersions, ToolingFlowRecord>[];
  toggleExpanded: (type: AutomationMetadataType, value: boolean, item: AutomationControlMetadataTypeItem) => void;
  onChange: (
    type: AutomationMetadataType,
    value: boolean,
    item: AutomationControlMetadataTypeItem,
    grandChildItem?: AutomationControlMetadataTypeItem
  ) => void;
}

export const AutomationControlContentFlow: FunctionComponent<AutomationControlContentFlowProps> = ({
  selectedOrg,
  serverUrl,
  items,
  toggleExpanded,
  onChange,
}) => {
  return (
    <table className="slds-table slds-table_cell-buffer slds-table_bordered slds-no-row-hover slds-tree slds-table_tree" role="treegrid">
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
            <div className="slds-truncate" title="Version">
              Version
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
        {items.map((item, i) => (
          <Fragment key={item.fullName}>
            <tr
              key={item.fullName}
              aria-expanded={item.expanded || false}
              aria-level={1}
              aria-posinset={i}
              aria-selected={false}
              aria-setsize={items.length}
              className={classNames(
                { 'slds-is-edited': item.currentValue !== item.initialValue || item.initialActiveVersion !== item.currentActiveVersion },
                'slds-hint-parent'
              )}
              onClick={() => toggleExpanded('Flow', !item.expanded, item)}
            >
              <td role="gridcell">
                <CheckboxToggle
                  id={`Flow-${item.fullName}`}
                  label="Is Active"
                  onText="Active"
                  offText="Inactive"
                  hideLabel
                  checked={item.currentValue}
                  disabled
                />
              </td>
              <th className="slds-tree__item" scope="row">
                <button
                  className="slds-button slds-button_icon slds-button_icon-x-small slds-m-right_x-small"
                  aria-hidden="true"
                  tabIndex={-1}
                  title={`Toggle Expand/Collapse ${item.label}`}
                >
                  <Icon type="utility" icon="chevronright" className="slds-button__icon slds-button__icon_small" omitContainer />
                  <span className="slds-assistive-text">Toggle Versions</span>
                </button>
                <Grid vertical>
                  <div>
                    {item.children?.[0]?.metadata?.ProcessType === 'AutoLaunchedFlow' ? 'Record Triggered Flow' : 'Process Builder'}
                  </div>
                  <div className="slds-cell-wrap slds-line-clamp slds-text-link" title={item.label}>
                    {item.label}
                  </div>
                </Grid>
              </th>
              <td role="gridcell">
                <div className="slds-cell-wrap slds-line-clamp" title={item.description}>
                  {item.description}
                </div>
              </td>
              <td role="gridcell">
                <div className="slds-cell-wrap slds-line-clamp" title={`${item.metadata.Versions.length}`}>
                  <Grid vertical>
                    <GridCol>
                      <div className="slds-truncate" title={`${item.metadata.ActiveVersion?.VersionNumber || 'None'}`}>
                        Active Version: {item.metadata.ActiveVersion?.VersionNumber || 'None'}
                      </div>
                    </GridCol>
                    <GridCol>
                      <div className="slds-truncate" title={`${item.metadata.LatestVersion?.VersionNumber || 'None'}`}>
                        Latest Version: {item.metadata.LatestVersion?.VersionNumber || 'None'}
                      </div>
                    </GridCol>
                  </Grid>
                </div>
              </td>
              <td role="gridcell">
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
            {item.expanded &&
              Array.isArray(item.children) &&
              item.children.map((childItem, k) => (
                <tr
                  key={childItem.fullName}
                  aria-level={2}
                  aria-posinset={k}
                  aria-selected={false}
                  aria-setsize={item.children.length}
                  className={classNames(
                    { 'slds-is-edited': false /** childItem.currentValue !== childItem.initialValue */ },
                    'slds-hint-parent'
                  )}
                >
                  <td role="gridcell">
                    <CheckboxToggle
                      id={`Flow-${childItem.fullName}`}
                      containerClassname="slds-p-left_x-small"
                      label="Is Active"
                      onText="Active"
                      offText="Inactive"
                      hideLabel
                      checked={childItem.currentValue}
                      onChange={(value) => onChange('Flow', value, item, childItem)}
                    />
                  </td>
                  <th scope="row">
                    <Grid className="slds-grid slds-p-left_xx-large">
                      <GridCol>
                        <div title={`Open in Salesforce: ${childItem.label}`}>
                          <SalesforceLogin
                            serverUrl={serverUrl}
                            org={selectedOrg}
                            returnUrl={
                              childItem.metadata?.ProcessType === 'AutoLaunchedFlow'
                                ? `/builder_platform_interaction/flowBuilder.app?flowId=${childItem.metadata.Id}`
                                : `/lightning/setup/ProcessAutomation/home`
                            }
                            omitIcon
                          >
                            {childItem.label}
                          </SalesforceLogin>
                        </div>
                      </GridCol>
                    </Grid>
                  </th>
                  <td role="gridcell">
                    <div className="slds-cell-wrap slds-line-clamp" title={childItem.description}>
                      {childItem.description}
                    </div>
                  </td>
                  <td role="gridcell">
                    <div className="slds-cell-wrap slds-line-clamp" title={`${childItem.metadata.VersionNumber}`}>
                      {childItem.metadata.VersionNumber}
                    </div>
                  </td>
                  <td role="gridcell">
                    <Grid vertical>
                      <GridCol>
                        {childItem.LastModifiedByName && (
                          <div className="slds-truncate" title={childItem.LastModifiedByName}>
                            {childItem.LastModifiedByName}
                          </div>
                        )}
                      </GridCol>
                      <GridCol>
                        {childItem.LastModifiedDate && (
                          <div className="slds-truncate" title={childItem.LastModifiedDate}>
                            {childItem.LastModifiedDate}
                          </div>
                        )}
                      </GridCol>
                    </Grid>
                  </td>
                </tr>
              ))}
          </Fragment>
        ))}
      </tbody>
    </table>
  );
};

export default AutomationControlContentFlow;
