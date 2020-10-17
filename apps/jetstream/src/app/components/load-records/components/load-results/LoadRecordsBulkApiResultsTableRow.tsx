/** @jsx jsx */
import { jsx } from '@emotion/core';
import { BulkJobBatchInfo } from '@jetstream/types';
import { Grid, Icon, Spinner } from '@jetstream/ui';
import classNames from 'classnames';
import { FunctionComponent } from 'react';
import numeral from 'numeral';

export interface LoadRecordsBulkApiResultsTableRowProps {
  batch: BulkJobBatchInfo;
  serverUrl: string;
  hasErrors: boolean;
  filenamePrefix: string;
  orgUrlParams: string;
  onDownload: (type: 'results' | 'failure', url: string) => void;
}

export const LoadRecordsBulkApiResultsTableRow: FunctionComponent<LoadRecordsBulkApiResultsTableRowProps> = ({
  batch,
  serverUrl,
  hasErrors,
  filenamePrefix,
  orgUrlParams,
  onDownload,
}) => {
  function getLinkUrl(batch: BulkJobBatchInfo, type: 'request' | 'result' | 'failed') {
    let url = `${serverUrl}/static/sfdc/bulk/${batch.jobId}/${batch.id}`;
    url += `?type=${type}`;
    // url += `&filename=${encodeURIComponent(`${filenamePrefix}-${type}.csv`)}`;
    url += `&${orgUrlParams}`;
    return url;
  }

  const total = numeral(batch.numberRecordsProcessed).format('0,0');
  const success = numeral(batch.numberRecordsProcessed - batch.numberRecordsFailed).format('0,0');
  const failure = numeral(batch.numberRecordsFailed || 0).format('0,0');

  return (
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
        {batch.state === 'Completed' && !hasErrors && (
          <Icon
            type="utility"
            icon="success"
            description="Batch completed successfully"
            title="Batch completed successfully"
            className="slds-icon slds-icon_small slds-icon-text-success slds-m-horizontal_xxx-small"
          />
        )}
        {batch.state === 'Completed' && hasErrors && (
          <Icon
            type="utility"
            icon="warning"
            description="Batch completed with errors"
            title="Batch completed with errors"
            className="slds-icon slds-icon_small slds-icon-text-warning slds-m-horizontal_xxx-small"
          />
        )}
        {(batch.state === 'Queued' || batch.state === 'InProgress') && <Spinner size="x-small" />}
      </td>
      <td>
        {batch.state === 'Completed' && (
          <Grid vertical>
            <div>
              {/* All Results */}
              {/* <a className="slds-button" href={getLinkUrl(batch, 'result')} target="_blank" rel="noreferrer">
                <Icon type="utility" icon="download" className="slds-button__icon slds-button__icon_left" omitContainer />
                Download Results
              </a> */}
              <button className="slds-button" onClick={() => onDownload('results', getLinkUrl(batch, 'result'))}>
                <Icon type="utility" icon="download" className="slds-button__icon slds-button__icon_left" omitContainer />
                Download Results
              </button>
            </div>
            {/* TODO: implement me */}
            {/* Failure Results */}
            {/* {batch.numberRecordsFailed > 0 && (
                    <div>
              <button className="slds-button" onClick={() => onDownload('failed', getLinkUrl(batch, 'failed'))}>
                <Icon type="utility" icon="download" className="slds-button__icon slds-button__icon_left" omitContainer />
                Download Failures
              </button>
                    </div>
                  )} */}
          </Grid>
        )}
        {batch.state === 'Failed' && batch.stateMessage && (
          <div className="slds-cell-wrap slds-line-clamp slds-text-color_error" title="{batch.stateMessage}">
            {batch.stateMessage}
          </div>
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
        <div className="slds-truncate" title={total}>
          {total}
        </div>
      </td>
      <td title={`Success: ${success} / Failures: ${failure}`}>
        <div>
          Success: <span className="slds-truncate slds-text-color_success">{success}</span>
        </div>
        <div>
          Failures:{' '}
          <span
            className={classNames('slds-truncate', {
              'slds-text-color_error': batch.numberRecordsFailed > 0,
              'slds-text-color_success': batch.numberRecordsFailed === 0,
            })}
          >
            {failure}
          </span>
        </div>
      </td>
      <td>
        <div className="slds-truncate" title={batch.state}>
          {batch.state}
        </div>
      </td>
    </tr>
  );
};

export default LoadRecordsBulkApiResultsTableRow;
