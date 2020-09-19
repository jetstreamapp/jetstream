/** @jsx jsx */
import { jsx, css } from '@emotion/core';
import { Checkbox, Grid, GridCol, Spinner } from '@jetstream/ui';
import classNames from 'classnames';
import { Fragment, FunctionComponent } from 'react';
import { AutomationControlMetadataTypeItem, AutomationMetadataType, ToolingFlowDefinitionWithVersions } from '../automation-control-types';

interface AutomationControlContentFlowProps {
  items: AutomationControlMetadataTypeItem<ToolingFlowDefinitionWithVersions>[];
  loading?: boolean;
  onChange: (
    type: AutomationMetadataType,
    item: AutomationControlMetadataTypeItem<ToolingFlowDefinitionWithVersions>,
    value: boolean
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
      <div>
        TODO: flow versions are actually what the user wants to activate/deactivate, not the parent container. Impacts data model since the
        structure is so different from other types.
      </div>
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
                  <div className="slds-cell-wrap slds-line-clamp" title={`${item.metadata.Versions.length}`}>
                    <Grid vertical>
                      <GridCol>
                        <div className="slds-truncate" title={item.metadata.LastModifiedBy.Name}>
                          Total Versions: {item.metadata.Versions.length}
                        </div>
                      </GridCol>
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
                    <Checkbox
                      id={`Flow-${item.fullName}`}
                      label="Is Active"
                      hideLabel
                      checked={item.currentValue}
                      onChange={(value) => onChange('Flow', item, value)}
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

export default AutomationControlContentFlow;
