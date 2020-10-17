/** @jsx jsx */
import { css, jsx } from '@emotion/core';
import { Grid, Icon, Spinner } from '@jetstream/ui';
import classNames from 'classnames';
import { FunctionComponent } from 'react';
import { LoadDataBatchApiProgress } from '../../load-records-types';
import numeral from 'numeral';

export interface LoadRecordsBatchApiResultsTableProps {
  processingStatus: LoadDataBatchApiProgress;
  inProgress: boolean;
  failed: boolean;
  startTime: string;
  endTime: string;
  onDownload: (type: 'results' | 'failure') => void;
}

export const LoadRecordsBatchApiResultsTable: FunctionComponent<LoadRecordsBatchApiResultsTableProps> = ({
  processingStatus,
  inProgress,
  failed,
  startTime,
  endTime,
  onDownload,
}) => {
  const status = inProgress ? 'Processing' : 'Finished';
  const total = numeral(processingStatus.total || 0).format('0,0');
  const success = numeral(processingStatus.success || 0).format('0,0');
  const failure = numeral(processingStatus.failure || 0).format('0,0');

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
        <tr className="slds-hint-parent">
          <td className="slds-is-relative">
            {failed && (
              <Icon
                type="utility"
                icon="error"
                description="batch failed"
                className="slds-icon slds-icon_small slds-icon-text-error slds-m-horizontal_xxx-small"
              />
            )}
            {!failed && !inProgress && !processingStatus.failure && (
              <Icon
                type="utility"
                icon="success"
                description="Completed successfully"
                title="Completed successfully"
                className="slds-icon slds-icon_small slds-icon-text-success slds-m-horizontal_xxx-small"
              />
            )}
            {!failed && !inProgress && !!processingStatus.failure && (
              <Icon
                type="utility"
                icon="warning"
                description="Batch completed with errors"
                title="Batch completed with errors"
                className="slds-icon slds-icon_small slds-icon-text-warning slds-m-horizontal_xxx-small"
              />
            )}

            {inProgress && <Spinner size="x-small" />}
          </td>
          <td>
            {!inProgress && (
              <Grid vertical>
                <div>
                  <button className="slds-button" onClick={() => onDownload('results')}>
                    <Icon type="utility" icon="download" className="slds-button__icon slds-button__icon_left" omitContainer />
                    Download Results
                  </button>
                </div>
                {processingStatus.failure > 0 && (
                  <div>
                    <button className="slds-button" onClick={() => onDownload('failure')}>
                      <Icon type="utility" icon="download" className="slds-button__icon slds-button__icon_left" omitContainer />
                      Download Failures
                    </button>
                  </div>
                )}
              </Grid>
            )}
          </td>
          <td>
            <div className="slds-truncate" title={startTime}>
              {startTime}
            </div>
          </td>
          <td>
            {endTime && (
              <div className="slds-truncate" title={endTime}>
                {endTime}
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
              Success: <span className={classNames('slds-truncate slds-text-color_success')}>{success}</span>
            </div>
            <div>
              Failures:{' '}
              <span
                className={classNames('slds-truncate', {
                  'slds-text-color_error': processingStatus.failure > 0,
                  'slds-text-color_success': processingStatus.failure === 0,
                })}
              >
                {failure}
              </span>
            </div>
          </td>
          <td>
            <div className="slds-truncate" title={status}>
              {status}
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  );
};

export default LoadRecordsBatchApiResultsTable;
