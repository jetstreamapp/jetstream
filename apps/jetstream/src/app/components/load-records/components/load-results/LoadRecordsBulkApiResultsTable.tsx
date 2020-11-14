/** @jsx jsx */
import { css, jsx } from '@emotion/core';
import { getFilename, getOrgUrlParams } from '@jetstream/shared/ui-utils';
import { BulkJobBatchInfo, BulkJobWithBatches, SalesforceOrgUi } from '@jetstream/types';
import { FunctionComponent, useEffect, useState } from 'react';
import LoadRecordsBulkApiResultsTableRow from './LoadRecordsBulkApiResultsTableRow';
export interface LoadRecordsBulkApiResultsTableProps {
  selectedOrg: SalesforceOrgUi;
  serverUrl: string;
  jobInfo: BulkJobWithBatches;
  onDownload: (type: 'results' | 'failure', batch: BulkJobBatchInfo, batchIndex: number) => Promise<void>;
}

export const LoadRecordsBulkApiResultsTable: FunctionComponent<LoadRecordsBulkApiResultsTableProps> = ({
  selectedOrg,
  serverUrl,
  jobInfo,
  onDownload,
}) => {
  const [orgUrlParams, setOrgUrlParams] = useState<string>(null);
  const [filenamePrefix, setFilenamePrefix] = useState<string>(null);
  const [hasErrors, setHasErrors] = useState<boolean>(false);

  useEffect(() => {
    if (selectedOrg) {
      setOrgUrlParams(getOrgUrlParams(selectedOrg));
      setFilenamePrefix(getFilename(selectedOrg, ['load']));
    } else {
      setOrgUrlParams('');
    }
  }, [selectedOrg]);

  useEffect(() => {
    if (!hasErrors) {
      if (jobInfo.batches.some((batch) => batch.numberRecordsFailed)) {
        setHasErrors(true);
      }
    }
  }, [jobInfo, hasErrors]);

  return (
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
        {jobInfo.batches.map((batch, i) => (
          <LoadRecordsBulkApiResultsTableRow
            key={batch.id}
            batch={batch}
            hasErrors={hasErrors}
            onDownload={(type, batch) => onDownload(type, batch, i)}
          />
        ))}
      </tbody>
    </table>
  );
};

export default LoadRecordsBulkApiResultsTable;
