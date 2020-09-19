/** @jsx jsx */
import { jsx, css } from '@emotion/core';
import { Checkbox, Grid, GridCol, Icon, Spinner } from '@jetstream/ui';
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
  loading?: boolean;
  onChange: (
    type: AutomationMetadataType,
    value: boolean,
    item: AutomationControlMetadataTypeItem,
    grandChildItem?: AutomationControlMetadataTypeItem
  ) => void;
}

export const AutomationControlContentFlow: FunctionComponent<AutomationControlContentFlowProps> = ({ items, loading, onChange }) => {
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
        <table className="slds-table slds-table_cell-buffer slds-table_bordered slds-no-row-hover slds-tree" role="treegrid">
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
                <div className="slds-truncate" title="Versions">
                  Versions
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
                  aria-expanded={true}
                  aria-level={1}
                  aria-posinset={i}
                  aria-selected={false}
                  aria-setsize={items.length}
                  className={classNames({ 'slds-is-edited': item.currentValue !== item.initialValue }, 'slds-hint-parent')}
                >
                  <th scope="row">
                    {/* This icon made things look cluttered */}
                    {/* <Icon
                      type="utility"
                      icon="chevrondown"
                      className="slds-icon slds-icon_x-small slds-icon-text-default slds-m-top_xx-small slds-m-right_xx-small"
                      omitContainer
                    /> */}
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
                      <Checkbox id={`Flow-${item.fullName}`} label="Is Active" hideLabel checked={item.currentValue} readOnly disabled />
                    </div>
                  </td>
                </tr>
                {Array.isArray(item.children) &&
                  item.children.map((childItem, k) => (
                    <tr
                      key={childItem.fullName}
                      aria-level={2}
                      aria-posinset={k}
                      aria-selected={false}
                      aria-setsize={item.children.length}
                      className={classNames({ 'slds-is-edited': childItem.currentValue !== childItem.initialValue }, 'slds-hint-parent')}
                    >
                      <th className="slds-m-left_x-small" scope="row">
                        <Grid>
                          <GridCol growNone>
                            <Icon
                              type="utility"
                              icon="level_down"
                              className="slds-icon slds-icon_x-small slds-icon-text-default slds-m-right_xx-small slds-m-bottom_xx-small"
                              omitContainer
                            />
                          </GridCol>
                          <GridCol>
                            <div className="slds-cell-wrap slds-line-clamp" title={childItem.label}>
                              {childItem.label}
                            </div>
                          </GridCol>
                        </Grid>
                      </th>
                      <td>
                        <div className="slds-cell-wrap slds-line-clamp" title={childItem.description}>
                          {childItem.description}
                        </div>
                      </td>
                      <td>
                        <div className="slds-cell-wrap slds-line-clamp" title={`${childItem.metadata.VersionNumber}`}>
                          {childItem.metadata.VersionNumber}
                        </div>
                      </td>
                      <td>
                        <Grid vertical>
                          <GridCol>
                            <div className="slds-truncate" title={childItem.metadata.LastModifiedBy.Name}>
                              {childItem.metadata.LastModifiedBy.Name}
                            </div>
                          </GridCol>
                          <GridCol>
                            <div className="slds-truncate" title={childItem.metadata.LastModifiedDate}>
                              {childItem.metadata.LastModifiedDate}
                            </div>
                          </GridCol>
                        </Grid>
                      </td>
                      <td>
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
      )}
    </Fragment>
  );
};

export default AutomationControlContentFlow;
