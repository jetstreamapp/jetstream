/** @jsx jsx */
import { css, jsx } from '@emotion/react';
import { DeployMessage } from '@jetstream/types';
import { Grid } from '@jetstream/ui';
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
            </tr>
          ))}
        </tbody>
      </table>
    </Grid>
  );
};

export default DeployMetadataResultsSuccessTable;
