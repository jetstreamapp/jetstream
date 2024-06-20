import { css } from '@emotion/react';
import { CodeCoverageWarning } from '@jetstream/types';
import { Grid } from '@jetstream/ui';
import { FunctionComponent } from 'react';

export interface DeployMetadataUnitTestCodeCoverageResultsTableProps {
  codeCoverageWarnings: CodeCoverageWarning[];
}

export const DeployMetadataUnitTestCodeCoverageResultsTable: FunctionComponent<DeployMetadataUnitTestCodeCoverageResultsTableProps> = ({
  codeCoverageWarnings,
}) => {
  return (
    <Grid vertical>
      <h2 className="slds-text-heading_small">Test Failures</h2>
      <table className="slds-table slds-table_cell-buffer slds-table_bordered slds-table_striped">
        <thead>
          <tr className="slds-line-height_reset">
            <th scope="col">Class</th>
            <th scope="col">Message</th>
          </tr>
        </thead>
        <tbody>
          {codeCoverageWarnings.map((row, i) => (
            <tr className="slds-hint-parent" key={`${row.id}-row-${i}`}>
              <th scope="row">
                <div className="slds-truncate" title={row.name}>
                  {row.name}
                </div>
              </th>
              <th scope="row" className="slds-cell-wrap">
                <div className="slds-line-clamp" title={row.message}>
                  {row.message}
                </div>
              </th>
            </tr>
          ))}
        </tbody>
      </table>
    </Grid>
  );
};

export default DeployMetadataUnitTestCodeCoverageResultsTable;
