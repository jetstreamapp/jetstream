import { css } from '@emotion/react';
import type { ApexTestResultRecord, SalesforceOrgUi } from '@jetstream/types';
import { ariaDisabledButtonProps, Badge, Grid, Icon, ScopedNotification, Spinner, Tooltip, useAnnouncer } from '@jetstream/ui';
import { FunctionComponent, useEffect, useRef, useState } from 'react';
import type { TestRunDetailViewModel } from '../apex-test-runner-types';
import { isTestRunInProgress } from '../useApexTestRunsList';
import TestResultDetailModal from './TestResultDetailModal';
import TestRunResultsTable from './TestRunResultsTable';
import { formatTestTime, getRunStatusBadgeType } from './test-run-utils';

export interface TestRunDetailProps {
  selectedOrg: SalesforceOrgUi;
  detail: TestRunDetailViewModel;
  loading: boolean;
  aborting: boolean;
  errorMessage: string | null;
  pollingTimedOut: boolean;
  onAbort: () => void;
  onResumePolling: () => void;
}

export const TestRunDetail: FunctionComponent<TestRunDetailProps> = ({
  selectedOrg,
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
  const { announce, announcer } = useAnnouncer();
  const statusRef = useRef<HTMLSpanElement>(null);

  const inProgress = !!run && isTestRunInProgress(run);
  // MethodsCompleted includes failed methods
  const methodsRun = run?.MethodsCompleted ?? 0;

  // Announce the polled status once it reaches a terminal state, and catch focus when the control
  // the user activated (Abort, Resume Polling) unmounts as a result of that activation
  const previousRunStateRef = useRef({ runId: run?.Id ?? null, inProgress, pollingTimedOut });
  useEffect(() => {
    const previous = previousRunStateRef.current;
    previousRunStateRef.current = { runId: run?.Id ?? null, inProgress, pollingTimedOut };
    if (!run || previous.runId !== run.Id) {
      return;
    }
    const runFinished = previous.inProgress && !inProgress;
    const pollingResumed = previous.pollingTimedOut && !pollingTimedOut;
    if (runFinished) {
      const failureCount = run.MethodsFailed ?? 0;
      announce(
        `Test run ${run.Status}. ${methodsRun} of ${run.MethodsEnqueued ?? methodsRun} tests run, ${failureCount} ${
          failureCount === 1 ? 'failure' : 'failures'
        }.`,
      );
    }
    if ((runFinished || pollingResumed) && document.activeElement === document.body) {
      statusRef.current?.focus();
    }
  }, [run, inProgress, pollingTimedOut, methodsRun, announce]);

  if (!run) {
    return null;
  }

  return (
    <div
      className="slds-is-relative"
      css={css`
        min-height: 60px;
      `}
    >
      {announcer}
      {selectedResult && (
        <TestResultDetailModal selectedOrg={selectedOrg} testResult={selectedResult} onClose={() => setSelectedResult(null)} />
      )}
      {loading && !testResults.length && <Spinner size="small" />}
      <Grid verticalAlign="center" wrap className="slds-m-vertical_x-small">
        {/* Persistent focus target for when Abort / Resume Polling unmount under the keyboard user */}
        <span ref={statusRef} tabIndex={-1}>
          <Badge type={getRunStatusBadgeType(run.Status)}>{run.Status}</Badge>
        </span>
        {inProgress && <Spinner inline size="x-small" containerClassName="slds-m-left_small" />}
        <span className="slds-m-left_small" role="status">
          {run.MethodsEnqueued !== null && (
            <>
              <strong>{methodsRun}</strong> of <strong>{run.MethodsEnqueued}</strong> tests run
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
              {/* Stays focusable while aborting — native disabled would drop focus to <body> */}
              <button className="slds-button slds-button_destructive" {...ariaDisabledButtonProps(aborting, () => onAbort())}>
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
