import { css } from '@emotion/react';
import { convertDateToLocale, formatNumber } from '@jetstream/shared/ui-utils';
import { DeployResult, DownloadType } from '@jetstream/types';
import { Grid, Icon, Spinner } from '@jetstream/ui';
import classNames from 'classnames';
import { FunctionComponent } from 'react';

const LOADING_STATUSES = new Set(['Pending', 'InProgress', 'Canceling']);
const FAILED_STATUSES = new Set(['Failed', 'Canceled']);

function getUserStatus(results: DeployResult, fallback: string) {
  if (!results) {
    return fallback;
  }
  switch (results.status) {
    case 'InProgress':
      return 'In Progress';
    case 'SucceededPartial':
      return 'Partial Success';
    default:
      return results.status;
  }
}

export interface LoadRecordsCustomMetadataResultsTableProps {
  results: DeployResult;
  onDownload: (type: DownloadType) => void;
  onViewResults: (type: DownloadType) => void;
}

export const LoadRecordsCustomMetadataResultsTable: FunctionComponent<LoadRecordsCustomMetadataResultsTableProps> = ({
  results,
  onDownload,
  onViewResults,
}) => {
  const total = formatNumber(results.numberComponentsTotal || 0);
  const success = formatNumber(results.numberComponentsDeployed || 0);
  const failure = formatNumber(results.numberComponentErrors || 0);
  const startTime = results.startDate ? convertDateToLocale(results.startDate) : '';
  const endTime = results.completedDate ? convertDateToLocale(results.completedDate) : '';

  const inProgress = LOADING_STATUSES.has(results.status);
  const failed = FAILED_STATUSES.has(results.status);
  const status = getUserStatus(results, 'In Progress');

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
              width: 260px;
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
          <th className="slds-is-relative" scope="row">
            {failed && (
              <Icon
                type="utility"
                icon="error"
                description="batch failed"
                className="slds-icon slds-icon_small slds-icon-text-error slds-m-horizontal_xxx-small"
              />
            )}
            {!failed && !inProgress && !results.numberComponentErrors && (
              <Icon
                type="utility"
                icon="success"
                description="Completed successfully"
                title="Completed successfully"
                className="slds-icon slds-icon_small slds-icon-text-success slds-m-horizontal_xxx-small"
              />
            )}
            {!failed && !inProgress && !!results.numberComponentErrors && (
              <Icon
                type="utility"
                icon="warning"
                description="Batch completed with errors"
                title="Batch completed with errors"
                className="slds-icon slds-icon_small slds-icon-text-warning slds-m-horizontal_xxx-small"
              />
            )}

            {inProgress && <Spinner size="x-small" />}
          </th>
          <td>
            {!inProgress && (
              <Grid vertical className="slds-text-align_right">
                {results.errorMessage && <div className="slds-text-color_error">{results.errorMessage}</div>}
                {/* All Results */}
                {results.numberComponentsDeployed > 0 && (
                  <div>
                    <span className="slds-m-right_small text-bold">All Results</span>
                    <button className="slds-button" onClick={() => onDownload('results')}>
                      <Icon type="utility" icon="download" className="slds-button__icon slds-button__icon_left" omitContainer />
                      Download
                    </button>
                    <button className="slds-button slds-m-left_x-small" onClick={() => onViewResults('results')}>
                      <Icon type="utility" icon="preview" className="slds-button__icon slds-button__icon_left" omitContainer />
                      View
                    </button>
                  </div>
                )}
                {/* Failure Results */}
                {results.numberComponentErrors > 0 && (
                  <div>
                    <span className="slds-m-right_small text-bold">Failures</span>
                    <button className="slds-button" onClick={() => onDownload('failures')}>
                      <Icon type="utility" icon="download" className="slds-button__icon slds-button__icon_left" omitContainer />
                      Download
                    </button>
                    <button className="slds-button slds-m-left_x-small" onClick={() => onViewResults('failures')}>
                      <Icon type="utility" icon="preview" className="slds-button__icon slds-button__icon_left" omitContainer />
                      View
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
                  'slds-text-color_error': results.numberComponentErrors > 0,
                  'slds-text-color_success': results.numberComponentErrors === 0,
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

export default LoadRecordsCustomMetadataResultsTable;
