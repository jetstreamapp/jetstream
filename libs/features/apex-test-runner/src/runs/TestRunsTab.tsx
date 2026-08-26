import { ANALYTICS_KEYS } from '@jetstream/shared/constants';
import type { SalesforceOrgUi } from '@jetstream/types';
import { Grid, Icon, ScopedNotification, Spinner, Tooltip } from '@jetstream/ui';
import { useAmplitude } from '@jetstream/ui-core';
import { formatDate } from 'date-fns/format';
import { FunctionComponent, useCallback } from 'react';
import { SelectedTestRun, useApexTestRun } from '../useApexTestRun';
import type { useApexTestRunsList } from '../useApexTestRunsList';
import TestRunDetail from './TestRunDetail';
import TestRunsTable from './TestRunsTable';

export interface TestRunsTabProps {
  selectedOrg: SalesforceOrgUi;
  apiVersion: string;
  runsList: ReturnType<typeof useApexTestRunsList>;
  selectedRun: SelectedTestRun | null;
  onSelectedRunChange: (run: SelectedTestRun | null) => void;
}

export const TestRunsTab: FunctionComponent<TestRunsTabProps> = ({
  selectedOrg,
  apiVersion,
  runsList,
  selectedRun,
  onSelectedRunChange,
}) => {
  const { trackEvent } = useAmplitude();
  const { runs, loading, errorMessage, lastChecked, isPaused, togglePause, fetchRuns } = runsList;
  const runDetail = useApexTestRun(selectedOrg, apiVersion, selectedRun);

  const handleRowSelection = useCallback(
    (run: { Id: string; AsyncApexJobId: string }) => {
      onSelectedRunChange({ runId: run.Id, asyncApexJobId: run.AsyncApexJobId });
    },
    [onSelectedRunChange],
  );

  const handleAbort = useCallback(() => {
    runDetail.abort();
    trackEvent(ANALYTICS_KEYS.apex_tests_aborted);
  }, [runDetail, trackEvent]);

  return (
    <div className="slds-is-relative">
      <Grid verticalAlign="center" className="slds-m-vertical_x-small">
        <button className="slds-button slds-button_neutral" onClick={() => fetchRuns()}>
          <Icon type="utility" icon="refresh" className="slds-button__icon slds-button__icon_left" omitContainer />
          Refresh
        </button>
        <Tooltip content={isPaused ? 'Resume checking for new test runs' : 'Pause checking for new test runs'}>
          <button className="slds-button slds-button_neutral slds-m-left_x-small" onClick={togglePause}>
            <Icon type="utility" icon={isPaused ? 'play' : 'pause'} className="slds-button__icon slds-button__icon_left" omitContainer />
            {isPaused ? 'Resume' : 'Pause'}
          </button>
        </Tooltip>
        {lastChecked && (
          <span className="slds-m-left_small slds-text-body_small slds-text-color_weak" title="Test runs from all users are shown">
            Last checked {formatDate(lastChecked, 'h:mm:ss a')}
          </span>
        )}
      </Grid>
      {errorMessage && (
        <ScopedNotification theme="error" className="slds-m-vertical_x-small">
          {errorMessage}
        </ScopedNotification>
      )}
      {loading && !runs.length && <Spinner size="small" />}
      {!loading && !runs.length && (
        <p className="slds-m-vertical_medium slds-text-align_center">
          No recent test runs. Runs started outside Jetstream will also show up here.
        </p>
      )}
      {!!runs.length && (
        <TestRunsTable
          runs={runs}
          selectedRunId={selectedRun?.runId}
          maxHeight={selectedRun ? '240px' : undefined}
          onRowSelection={handleRowSelection}
        />
      )}
      {selectedRun && runDetail.detail && (
        <TestRunDetail
          selectedOrg={selectedOrg}
          detail={runDetail.detail}
          loading={runDetail.loading}
          aborting={runDetail.aborting}
          errorMessage={runDetail.errorMessage}
          pollingTimedOut={runDetail.pollingTimedOut}
          onAbort={handleAbort}
          onResumePolling={runDetail.resumePolling}
        />
      )}
    </div>
  );
};

export default TestRunsTab;
