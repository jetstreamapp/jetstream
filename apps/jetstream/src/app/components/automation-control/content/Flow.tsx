/** @jsx jsx */
import { css, jsx } from '@emotion/core';
import { Checkbox, Grid, GridCol, Icon } from '@jetstream/ui';
import classNames from 'classnames';
import { Fragment, FunctionComponent } from 'react';
import {
  AutomationControlMetadataTypeItem,
  AutomationMetadataType,
  ToolingFlowDefinitionWithVersions,
  ToolingFlowRecord,
} from '../automation-control-types';

interface AutomationControlContentFlowProps {
  items: AutomationControlMetadataTypeItem<ToolingFlowDefinitionWithVersions, ToolingFlowRecord>[];
  toggleExpanded: (type: AutomationMetadataType, value: boolean, item: AutomationControlMetadataTypeItem) => void;
  onChange: (
    type: AutomationMetadataType,
    value: boolean,
    item: AutomationControlMetadataTypeItem,
    grandChildItem?: AutomationControlMetadataTypeItem
  ) => void;
}

export const AutomationControlContentFlow: FunctionComponent<AutomationControlContentFlowProps> = ({ items, toggleExpanded, onChange }) => {
  return (
    <table className="slds-table slds-table_cell-buffer slds-table_bordered slds-no-row-hover slds-tree slds-table_tree" role="treegrid">
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
        {items.map((item, i) => (
          <Fragment key={item.fullName}>
            <tr
              key={item.fullName}
              aria-expanded={item.expanded || false}
              aria-level={1}
              aria-posinset={i}
              aria-selected={false}
              aria-setsize={items.length}
              className={classNames({ 'slds-is-edited': item.currentValue !== item.initialValue }, 'slds-hint-parent')}
              onClick={() => toggleExpanded('Flow', !item.expanded, item)}
            >
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
                <div className="slds-cell-wrap slds-line-clamp slds-text-link" title={item.label}>
                  {item.label}
                </div>
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
              <td role="gridcell">
                <div className="slds-cell-wrap slds-line-clamp" title={`${item.currentValue}`}>
                  <Checkbox id={`Flow-${item.fullName}`} label="Is Active" hideLabel checked={item.currentValue} readOnly disabled />
                </div>
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
                  className={classNames({ 'slds-is-edited': childItem.currentValue !== childItem.initialValue }, 'slds-hint-parent')}
                >
                  <th scope="row">
                    <Grid className="slds-grid slds-p-left_xx-large">
                      <GridCol>
                        <div className="slds-cell-wrap slds-line-clamp" title={childItem.label}>
                          {childItem.label}
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
                        {childItem.metadata.LastModifiedBy && (
                          <div className="slds-truncate" title={childItem.metadata.LastModifiedBy.Name}>
                            {childItem.metadata.LastModifiedBy.Name}
                          </div>
                        )}
                      </GridCol>
                      <GridCol>
                        <div className="slds-truncate" title={childItem.metadata.LastModifiedDate}>
                          {childItem.metadata.LastModifiedDate}
                        </div>
                      </GridCol>
                    </Grid>
                  </td>
                  <td role="gridcell">
                    <div className="slds-cell-wrap slds-line-clamp" title={`${childItem.currentValue}`}>
                      <Checkbox
                        id={`Flow-${childItem.fullName}`}
                        label="Is Active"
                        hideLabel
                        checked={childItem.currentValue}
                        onChange={(value) => onChange('Flow', value, item, childItem)}
                      />
                    </div>
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
