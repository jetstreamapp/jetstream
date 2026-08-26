import { css } from '@emotion/react';
import type { ApexTestResultRecord } from '@jetstream/types';
import { Badge, Grid, Icon, ScopedNotification, Spinner, Tooltip } from '@jetstream/ui';
import { FunctionComponent, useState } from 'react';
import type { TestRunDetailViewModel } from '../apex-test-runner-types';
import { isTestRunInProgress } from '../useApexTestRunsList';
import TestResultDetailModal from './TestResultDetailModal';
import TestRunResultsTable from './TestRunResultsTable';
import { formatTestTime, getRunStatusBadgeType } from './test-run-utils';

export interface TestRunDetailProps {
  detail: TestRunDetailViewModel;
  loading: boolean;
  aborting: boolean;
  errorMessage: string | null;
  pollingTimedOut: boolean;
  onAbort: () => void;
  onResumePolling: () => void;
}

export const TestRunDetail: FunctionComponent<TestRunDetailProps> = ({
  detail,
  loading,
  aborting,
  errorMessage,
  pollingTimedOut,
  onAbort,
  onResumePolling,
}) => {
  const [selectedResult, setSelectedResult] = useState<ApexTestResultRecord | null>(null);
  const { run, queueItems, testResults } = detail;

  if (!run) {
    return null;
  }

  const inProgress = isTestRunInProgress(run);
  // MethodsCompleted includes failed methods
  const methodsRun = run.MethodsCompleted ?? 0;

  return (
    <div
      className="slds-is-relative"
      css={css`
        min-height: 60px;
      `}
    >
      {selectedResult && <TestResultDetailModal testResult={selectedResult} onClose={() => setSelectedResult(null)} />}
      {loading && !testResults.length && <Spinner size="small" />}
      <Grid verticalAlign="center" wrap className="slds-m-vertical_x-small">
        <Badge type={getRunStatusBadgeType(run.Status)}>{run.Status}</Badge>
        {inProgress && <Spinner inline size="x-small" containerClassName="slds-m-left_small" />}
        <span className="slds-m-left_small">
          {run.MethodsEnqueued !== null && (
            <>
              <strong>{methodsRun}</strong> of <strong>{run.MethodsEnqueued}</strong> methods run
            </>
          )}
        </span>
        {!!run.MethodsFailed && (
          <span className="slds-m-left_small slds-text-color_error">
            {run.MethodsFailed} {run.MethodsFailed === 1 ? 'failure' : 'failures'}
          </span>
        )}
        {run.TestTime !== null && <span className="slds-m-left_small">{formatTestTime(run.TestTime)}</span>}
        <div className="slds-col_bump-left">
          {inProgress && (
            <Tooltip content="The currently executing test class will finish, remaining tests are cancelled">
              <button className="slds-button slds-button_destructive" disabled={aborting} onClick={onAbort}>
                <Icon type="utility" icon="ban" className="slds-button__icon slds-button__icon_left" omitContainer />
                Abort Remaining Tests
              </button>
            </Tooltip>
          )}
          {pollingTimedOut && (
            <button className="slds-button slds-button_neutral" onClick={onResumePolling}>
              <Icon type="utility" icon="refresh" className="slds-button__icon slds-button__icon_left" omitContainer />
              Resume Polling
            </button>
          )}
        </div>
      </Grid>
      {errorMessage && (
        <ScopedNotification theme="error" className="slds-m-vertical_x-small">
          {errorMessage}
        </ScopedNotification>
      )}
      {inProgress && !!queueItems.length && (
        <Grid wrap className="slds-m-bottom_x-small">
          {queueItems.map((queueItem) => (
            <Badge key={queueItem.Id} className="slds-m-right_x-small slds-m-bottom_xx-small" title={queueItem.Status}>
              {queueItem.ApexClass?.Name ?? queueItem.ApexClassId} — {queueItem.Status}
              {queueItem.ExtendedStatus ? ` ${queueItem.ExtendedStatus}` : ''}
            </Badge>
          ))}
        </Grid>
      )}
      <TestRunResultsTable testResults={testResults} onRowSelection={setSelectedResult} />
    </div>
  );
};

export default TestRunDetail;
