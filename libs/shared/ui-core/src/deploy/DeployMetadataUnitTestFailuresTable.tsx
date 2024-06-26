import { RunTestFailure } from '@jetstream/types';
import { Grid } from '@jetstream/ui';
import { FunctionComponent } from 'react';

export interface DeployMetadataUnitTestFailuresTableProps {
  failures: RunTestFailure[];
}

export const DeployMetadataUnitTestFailuresTable: FunctionComponent<DeployMetadataUnitTestFailuresTableProps> = ({ failures }) => {
  return (
    <Grid vertical>
      <h2 className="slds-text-heading_small">Test Failures</h2>
      <table className="slds-table slds-table_cell-buffer slds-table_bordered slds-table_striped">
        <thead>
          <tr className="slds-line-height_reset">
            <th scope="col">Class</th>
            <th scope="col">Method</th>
            <th scope="col">Message</th>
            <th scope="col">Stack Trace</th>
          </tr>
        </thead>
        <tbody>
          {failures.map((row, i) => (
            <tr className="slds-hint-parent" key={`${row.id}-row-${i}`}>
              <th scope="row">
                <div className="slds-truncate" title={row.packageName}>
                  {row.packageName}
                </div>
              </th>
              <td>
                <div className="slds-truncate" title={row.methodName}>
                  {row.methodName}
                </div>
              </td>
              <td className="slds-cell-wrap">
                <div className="slds-line-clamp" title={row.message}>
                  {row.message}
                </div>
              </td>
              <td className="slds-cell-wrap">
                <div className="slds-line-clamp" title={row.stackTrace}>
                  {row.stackTrace}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Grid>
  );
};

export default DeployMetadataUnitTestFailuresTable;
