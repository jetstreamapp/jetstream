import { css } from '@emotion/react';
import { FunctionComponent } from 'react';
import { LoadMultiObjectRequestWithResult } from './load-records-multi-object-types';
import LoadRecordsMultiObjectResultsTableRow from './LoadRecordsMultiObjectResultsTableRow';

export interface LoadRecordsMultiObjectResultsTableProps {
  data: LoadMultiObjectRequestWithResult[];
  onDownloadResults: (data: LoadMultiObjectRequestWithResult[], which: 'results' | 'failures') => void;
}

export const LoadRecordsMultiObjectResultsTable: FunctionComponent<LoadRecordsMultiObjectResultsTableProps> = ({
  data,
  onDownloadResults,
}) => {
  return (
    <div>
      <table className="slds-table slds-table_cell-buffer slds-table_bordered">
        <thead>
          <tr className="slds-line-height_reset">
            <th
              scope="col"
              css={css`
                width: 30px;
              `}
            ></th>
            <th
              scope="col"
              css={css`
                width: 220px;
              `}
            >
              <div className="slds-truncate" title="State">
                Results
              </div>
            </th>
            <th scope="col">
              <div className="slds-truncate" title="Start Time">
                Start Time
              </div>
            </th>
            <th scope="col">
              <div className="slds-truncate" title="End Time">
                End Time
              </div>
            </th>
            <th scope="col">
              <div className="slds-truncate" title="Records Processed">
                Total Records
              </div>
            </th>
            <th scope="col">
              <div className="slds-truncate" title="Records Failed">
                Processing Results
              </div>
            </th>
            <th scope="col">
              <div className="slds-truncate" title="Status">
                Status
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <LoadRecordsMultiObjectResultsTableRow key={row.key} row={row} onDownloadResults={onDownloadResults} />
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default LoadRecordsMultiObjectResultsTable;
