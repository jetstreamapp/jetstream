import { formatNumber } from '@jetstream/shared/ui-utils';
import { BulkJobBatchInfo } from '@jetstream/types';
import { Grid, Icon, Spinner } from '@jetstream/ui';
import classNames from 'classnames';
import { FunctionComponent, useEffect, useRef, useState } from 'react';

export interface LoadRecordsBulkApiResultsTableRowProps {
  batch: BulkJobBatchInfo;
  onDownload: (type: 'results' | 'failures', batch: BulkJobBatchInfo) => Promise<void>;
  onView: (type: 'results' | 'failures', batch: BulkJobBatchInfo) => Promise<void>;
}

export const LoadRecordsBulkApiResultsTableRow: FunctionComponent<LoadRecordsBulkApiResultsTableRowProps> = ({
  batch,
  onDownload,
  onView,
}) => {
  const isMounted = useRef(true);
  const [downloadResultsRecordsLoading, setDownloadResultsRecordsLoading] = useState(false);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const total = formatNumber(batch.numberRecordsProcessed);
  const success = formatNumber(batch.numberRecordsProcessed - batch.numberRecordsFailed);
  const failure = formatNumber(batch.numberRecordsFailed || 0);
  const hasErrors = !!batch.numberRecordsFailed;

  async function downloadResults(type: 'results' | 'failures') {
    try {
      // Emit to parent that the user would like to download records
      // this is a promise to control loading indicators
      setDownloadResultsRecordsLoading(true);
      await onDownload(type, batch);
      if (isMounted.current) {
        setDownloadResultsRecordsLoading(false);
      }
    } catch (ex) {
      if (isMounted.current && downloadResultsRecordsLoading) {
        setDownloadResultsRecordsLoading(false);
      }
      // TODO: show error message
    }
  }

  async function viewResults(type: 'results' | 'failures') {
    try {
      // Emit to parent that the user would like to download records
      // this is a promise to control loading indicators
      setDownloadResultsRecordsLoading(true);
      await onView(type, batch);
      if (isMounted.current) {
        setDownloadResultsRecordsLoading(false);
      }
    } catch (ex) {
      if (isMounted.current && downloadResultsRecordsLoading) {
        setDownloadResultsRecordsLoading(false);
      }
      // TODO: show error message
    }
  }

  return (
    <tr key={batch.id} className="slds-hint-parent">
      <th className="slds-is-relative" scope="row">
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
      </th>
      <td>
        {batch.state === 'Completed' && (
          <Grid vertical className="slds-text-align_right">
            <div className="slds-is-relative">
              {downloadResultsRecordsLoading && <Spinner size="small" />}
              {/* All Results */}
              {batch.numberRecordsProcessed > batch.numberRecordsFailed && (
                <div>
                  <span className="slds-m-right_small text-bold">All Results</span>
                  <button className="slds-button" onClick={() => downloadResults('results')}>
                    <Icon type="utility" icon="download" className="slds-button__icon slds-button__icon_left" omitContainer />
                    Download
                  </button>
                  <button className="slds-button slds-m-left_x-small" onClick={() => viewResults('results')}>
                    <Icon type="utility" icon="preview" className="slds-button__icon slds-button__icon_left" omitContainer />
                    View
                  </button>
                </div>
              )}
              {/* Failure Results */}
              {batch.numberRecordsFailed > 0 && (
                <div>
                  <span className="slds-m-right_small text-bold">Failures</span>
                  <button className="slds-button" onClick={() => downloadResults('failures')}>
                    <Icon type="utility" icon="download" className="slds-button__icon slds-button__icon_left" omitContainer />
                    Download
                  </button>
                  <button className="slds-button slds-m-left_x-small" onClick={() => viewResults('failures')}>
                    <Icon type="utility" icon="preview" className="slds-button__icon slds-button__icon_left" omitContainer />
                    View
                  </button>
                </div>
              )}
            </div>
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
      <td title={`Batch Id: ${batch.id?.substring(0, 15)}`}>
        <div className="slds-truncate">{batch.state}</div>
      </td>
    </tr>
  );
};

export default LoadRecordsBulkApiResultsTableRow;
