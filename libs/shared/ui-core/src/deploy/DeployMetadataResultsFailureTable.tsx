import { css } from '@emotion/react';
import { DeployMessage } from '@jetstream/types';
import { Grid } from '@jetstream/ui';
import { FunctionComponent } from 'react';

export interface DeployMetadataResultsFailureTableProps {
  title: string;
  componentDetails: DeployMessage[];
}

export const DeployMetadataResultsFailureTable: FunctionComponent<DeployMetadataResultsFailureTableProps> = ({
  title,
  componentDetails,
}) => {
  return (
    <Grid vertical>
      <h2 className="slds-text-heading_small">{title}</h2>
      <table className="slds-table slds-table_cell-buffer slds-table_bordered slds-table_striped slds-table_fixed-layout">
        <thead>
          <tr className="slds-line-height_reset">
            <th scope="col">Name</th>
            <th
              css={css`
                width: 120px;
              `}
              scope="col"
            >
              Type
            </th>
            <th
              css={css`
                width: 75px;
              `}
              scope="col"
            >
              Line
            </th>
            <th
              css={css`
                width: 75px;
              `}
              scope="col"
            >
              Column
            </th>
            <th scope="col">Error Message</th>
          </tr>
        </thead>
        <tbody>
          {componentDetails.map((row, i) => (
            <tr className="slds-hint-parent" key={`${row.id}-row-${i}`}>
              <th className="slds-cell-wrap" scope="row">
                <p className="slds-line-clamp_large" title={row.fullName}>
                  {decodeURIComponent(row.fullName)}
                </p>
              </th>
              <td className="slds-cell-wrap">
                <div className="slds-line-clamp_large" title={row.componentType}>
                  {row.componentType}
                </div>
              </td>
              <td className="slds-cell-wrap">
                <div title={`${row.lineNumber}`}>{row.lineNumber}</div>
              </td>
              <td className="slds-cell-wrap">
                <div title={`${row.columnNumber}`}>{row.columnNumber}</div>
              </td>
              <td className="slds-cell-wrap">
                <p className="slds-line-clamp_large" title={row.problem}>
                  {decodeURIComponent(row.problem)}
                </p>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Grid>
  );
};

export default DeployMetadataResultsFailureTable;
