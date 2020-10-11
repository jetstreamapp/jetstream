/** @jsx jsx */
import { css, jsx } from '@emotion/core';
import { BulkJobBatchInfo, BulkJobWithBatches, SalesforceOrgUi } from '@jetstream/types';
import { Grid, Icon, Spinner } from '@jetstream/ui';
import classNames from 'classnames';
import { FunctionComponent, useEffect, useState } from 'react';
import { getFilename, getOrgUrlParams } from '@jetstream/shared/ui-utils';

export interface LoadRecordsBatchResultsTableProps {
  selectedOrg: SalesforceOrgUi;
  serverUrl: string;
  jobInfo: BulkJobWithBatches;
}

export const LoadRecordsBatchResultsTable: FunctionComponent<LoadRecordsBatchResultsTableProps> = ({ selectedOrg, serverUrl, jobInfo }) => {
  const [orgUrlParams, setOrgUrlParams] = useState<string>(null);
  const [filenamePrefix, setFilenamePrefix] = useState<string>(null);

  useEffect(() => {
    if (selectedOrg) {
      setOrgUrlParams(getOrgUrlParams(selectedOrg));
      setFilenamePrefix(getFilename(selectedOrg, ['load']));
    } else {
      setOrgUrlParams('');
    }
  }, [selectedOrg]);

  function getLinkUrl(batch: BulkJobBatchInfo, type: 'request' | 'result' | 'failed') {
    let url = `${serverUrl}/static/sfdc/bulk/${batch.jobId}/${batch.id}`;
    url += `?type=${type}`;
    url += `&filename=${encodeURIComponent(`${filenamePrefix}-${type}.csv`)}`;
    url += `&${orgUrlParams}`;
    return url;
  }

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
              width: 150px;
            `}
          >
            <div className="slds-truncate" title="Batch Number">
              Batch Id
            </div>
          </th>
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
              Processed Records
            </div>
          </th>
          <th scope="col">
            <div className="slds-truncate" title="Records Failed">
              Failed Records
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
        {jobInfo.batches.map((batch) => (
          <tr key={batch.id} className="slds-hint-parent">
            <td className="slds-is-relative">
              {batch.state === 'Failed' && (
                <Icon
                  type="utility"
                  icon="error"
                  description="batch failed"
                  className="slds-icon slds-icon_small slds-icon-text-error slds-m-horizontal_xxx-small"
                />
              )}
              {batch.state === 'Completed' && (
                <Icon
                  type="utility"
                  icon="success"
                  description="batch completed"
                  className="slds-icon slds-icon_small slds-icon-text-success slds-m-horizontal_xxx-small"
                />
              )}
              {(batch.state === 'Queued' || batch.state === 'InProgress') && <Spinner size="x-small" />}
            </td>
            <th scope="row">{batch.id}</th>
            <td>
              {batch.state === 'Completed' && (
                <Grid vertical>
                  <div>
                    {/* All Results */}
                    <a href={getLinkUrl(batch, 'result')} target="_blank" rel="noreferrer">
                      <Icon type="utility" icon="download" className="slds-button__icon slds-button__icon_left" omitContainer />
                      Results
                    </a>
                  </div>
                  {/* TODO: implement me */}
                  {/* Failure Results */}
                  {/* {batch.numberRecordsFailed > 0 && (
                    <div>
                      <a
                        href={getLinkUrl(batch, 'failed')}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <Icon type="utility" icon="download" className="slds-button__icon slds-button__icon_left" omitContainer />
                        Failed Results
                      </a>
                    </div>
                  )} */}
                  <div>
                    {/* Request */}
                    <a href={getLinkUrl(batch, 'request')} target="_blank" rel="noreferrer">
                      <Icon type="utility" icon="download" className="slds-button__icon slds-button__icon_left" omitContainer />
                      Request
                    </a>
                  </div>
                </Grid>
              )}
            </td>
            <td>
              <div className="slds-truncate" title={batch.createdDate}>
                {batch.createdDate}
              </div>
            </td>
            <td>
              {(batch.state === 'Completed' || batch.state === 'Failed') && (
                <div className="slds-truncate" title={batch.systemModstamp}>
                  {batch.systemModstamp}
                </div>
              )}
            </td>
            <td>
              <div className="slds-truncate" title={`${batch.numberRecordsProcessed}`}>
                {batch.numberRecordsProcessed}
              </div>
            </td>
            <td>
              <div
                className={classNames('slds-truncate', {
                  'slds-text-color_error': batch.numberRecordsFailed > 0,
                  'slds-text-color_success': batch.numberRecordsFailed === 0,
                })}
                title={`${batch.numberRecordsFailed}`}
              >
                {batch.numberRecordsFailed}
              </div>
            </td>
            <td>
              <div className="slds-truncate" title={batch.state}>
                {batch.state}
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export default LoadRecordsBatchResultsTable;
