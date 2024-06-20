import { formatNumber } from '@jetstream/shared/ui-utils';
import { Grid, Icon, Spinner } from '@jetstream/ui';
import classNames from 'classnames';
import { FunctionComponent, useEffect, useState } from 'react';
import { LoadMultiObjectRequestWithResult } from './load-records-multi-object-types';
import LoadRecordsMultiObjectRecordModal from './LoadRecordsMultiObjectRecordModal';

const STATUSES = {
  NOT_STARTED: 'Not Started',
  IN_PROGRESS: 'In-Progress',
  FAILED: 'Failed',
  FINISHED: 'Finished',
};

export interface LoadRecordsMultiObjectResultsTableRowProps {
  row: LoadMultiObjectRequestWithResult;
  onDownloadResults: (data: LoadMultiObjectRequestWithResult[], which: 'results' | 'failures') => void;
}

export const LoadRecordsMultiObjectResultsTableRow: FunctionComponent<LoadRecordsMultiObjectResultsTableRowProps> = ({
  row,
  onDownloadResults,
}) => {
  const { loading, started, finished, errorMessage, data, results, dataWithResultsByGraphId, recordWithResponseByRefId } = row;

  const [{ successCount, failureCount }, setSuccessFailureCount] = useState({ successCount: 0, failureCount: 0 });
  const [startTime, setStartTime] = useState<string | null>(null);
  const [endTime, setEndTime] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const totalCount = Object.keys(recordWithResponseByRefId).length;
  const total = formatNumber(totalCount);
  const finishedSuccessfully = finished && successCount > 0 && failureCount === 0;
  const finishedAllFailed = finished && successCount === 0;
  const finishedPartialSuccess = finished && successCount > 0 && failureCount > 0;

  useEffect(() => {
    if ((!finished && successCount) || failureCount) {
      setSuccessFailureCount({ successCount: 0, failureCount: 0 });
    }
  }, [finished]);

  useEffect(() => {
    if (results) {
      const counts = results.reduce(
        (output, result) => {
          if (result.isSuccessful) {
            output.successCount += result.graphResponse.compositeResponse.length;
          } else {
            output.failureCount += result.graphResponse.compositeResponse.length;
          }
          return output;
        },
        {
          successCount: 0,
          failureCount: 0,
        }
      );

      // if there is a bonkers failure, then there might only be one returned record
      if (finished && counts.successCount + counts.failureCount !== totalCount) {
        counts.failureCount = totalCount - counts.successCount;
      }

      setSuccessFailureCount(counts);
    }
  }, [results]);

  useEffect(() => {
    if (started) {
      setStartTime(started.toLocaleString());
    } else if (startTime) {
      setStartTime(null);
    }
  }, [started, startTime]);

  useEffect(() => {
    if (finished) {
      setEndTime(finished.toLocaleString());
    } else if (endTime) {
      setEndTime(null);
    }
  }, [finished, endTime]);

  useEffect(() => {
    if (!started && !loading) {
      setStatus(STATUSES.NOT_STARTED);
    } else if (started && finished && !loading && !errorMessage) {
      setStatus(STATUSES.FINISHED);
    } else if (started && finished && !loading && errorMessage) {
      setStatus(STATUSES.FAILED);
    } else {
      setStatus(STATUSES.IN_PROGRESS);
    }
  }, [started, finished, loading, errorMessage]);

  return (
    <tr className="slds-hint-parent">
      <td className="slds-is-relative">
        {finishedAllFailed && (
          <Icon
            type="utility"
            icon="error"
            description="All records failed"
            className="slds-icon slds-icon_small slds-icon-text-error slds-m-horizontal_xxx-small"
          />
        )}
        {finishedSuccessfully && (
          <Icon
            type="utility"
            icon="success"
            description="Completed successfully"
            title="Completed successfully"
            className="slds-icon slds-icon_small slds-icon-text-success slds-m-horizontal_xxx-small"
          />
        )}
        {finishedPartialSuccess && (
          <Icon
            type="utility"
            icon="warning"
            description="Batch completed with errors"
            title="Completed with errors"
            className="slds-icon slds-icon_small slds-icon-text-warning slds-m-horizontal_xxx-small"
          />
        )}

        {loading && <Spinner size="x-small" />}
      </td>
      <td>
        {status === STATUSES.FAILED && <span className="slds-text-color_error">{errorMessage}</span>}
        {status === STATUSES.FINISHED && (
          <Grid vertical>
            {/* All Results */}
            {successCount > 0 && (
              <div>
                <button className="slds-button" onClick={() => onDownloadResults([row], 'results')}>
                  <Icon type="utility" icon="download" className="slds-button__icon slds-button__icon_left" omitContainer />
                  Download Results
                </button>
              </div>
            )}
            {/* Failure Results */}
            {failureCount > 0 && (
              <div>
                <button className="slds-button" onClick={() => onDownloadResults([row], 'failures')}>
                  <Icon type="utility" icon="download" className="slds-button__icon slds-button__icon_left" omitContainer />
                  Download Failures
                </button>
              </div>
            )}
          </Grid>
        )}
      </td>
      <td>
        {startTime && (
          <div className="slds-truncate" title={startTime}>
            {startTime}
          </div>
        )}
      </td>
      <td>
        {endTime && (
          <div className="slds-truncate" title={endTime}>
            {endTime}
          </div>
        )}
      </td>
      <td>
        <Grid vertical verticalAlign="center">
          <div className="slds-truncate" title={total}>
            {total}
          </div>
          <LoadRecordsMultiObjectRecordModal data={row} />
        </Grid>
      </td>
      <td>
        {status !== STATUSES.NOT_STARTED && (
          <div title={`Success: ${successCount} / Failures: ${failureCount}`}>
            <div>
              Success: <span className={classNames('slds-truncate slds-text-color_success')}>{successCount}</span>
            </div>
            <div>
              Failures:{' '}
              <span
                className={classNames('slds-truncate', {
                  'slds-text-color_error': failureCount > 0,
                  'slds-text-color_success': failureCount === 0,
                })}
              >
                {failureCount}
              </span>
            </div>
          </div>
        )}
      </td>
      <td>
        <div className="slds-truncate" title={status || undefined}>
          {status}
        </div>
      </td>
    </tr>
  );
};

export default LoadRecordsMultiObjectResultsTableRow;
