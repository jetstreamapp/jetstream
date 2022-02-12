import { css } from '@emotion/react';
import { DeployMessage } from '@jetstream/types';
import { Checkbox, Grid } from '@jetstream/ui';
import { FunctionComponent } from 'react';

export interface DeployMetadataResultsSuccessTableProps {
  title: string;
  componentDetails: DeployMessage[];
}

export const DeployMetadataResultsSuccessTable: FunctionComponent<DeployMetadataResultsSuccessTableProps> = ({
  title,
  componentDetails,
}) => {
  return (
    <Grid vertical>
      <h2 className="slds-text-heading_small">{title}</h2>
      <table className="slds-table slds-table_cell-buffer slds-table_bordered slds-table_striped">
        <thead>
          <tr className="slds-line-height_reset">
            <th scope="col">Name</th>
            <th scope="col">Type</th>
            <th
              scope="col"
              css={css`
                width: 80px;
              `}
            >
              Changed
            </th>
            <th
              scope="col"
              css={css`
                width: 80px;
              `}
            >
              Created
            </th>
            <th
              scope="col"
              css={css`
                width: 80px;
              `}
            >
              Deleted
            </th>
          </tr>
        </thead>
        <tbody>
          {componentDetails.map((row, i) => (
            <tr className="slds-hint-parent" key={`${row.id}-row-${i}`}>
              <th scope="row">
                <div className="slds-truncate" title={row.fullName}>
                  {decodeURIComponent(row.fullName)}
                </div>
              </th>
              <td>
                <div className="slds-truncate" title={row.componentType}>
                  {row.componentType}
                </div>
              </td>
              <td>
                <div className="slds-truncate">
                  <Checkbox id={`${row.componentType}-${row.fullName}-changed`} label="changed" hideLabel checked={row.changed} disabled />
                </div>
              </td>
              <td>
                <div className="slds-truncate">
                  <Checkbox id={`${row.componentType}-${row.fullName}-created`} label="created" hideLabel checked={row.created} disabled />
                </div>
              </td>
              <td>
                <div className="slds-truncate">
                  <Checkbox id={`${row.componentType}-${row.fullName}-deleted`} label="deleted" hideLabel checked={row.deleted} disabled />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Grid>
  );
};

export default DeployMetadataResultsSuccessTable;
