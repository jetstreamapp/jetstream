import { useSetTraceFlag } from '@jetstream/connected-ui';
import { TITLES } from '@jetstream/shared/constants';
import { APP_ROUTES } from '@jetstream/shared/ui-router';
import { usePrimaryActionShortcut, useTitle } from '@jetstream/shared/ui-utils';
import {
  ariaDisabledButtonProps,
  AutoFullHeightContainer,
  getAriaKeyshortcuts,
  getModifierKey,
  Icon,
  KeyboardShortcut,
  Page,
  PageHeader,
  PageHeaderActions,
  PageHeaderRow,
  PageHeaderTitle,
  ScopedNotification,
  Tabs,
  TabsRef,
  Tooltip,
} from '@jetstream/ui';
import { applicationCookieState, selectedOrgState } from '@jetstream/ui/app-state';
import { useAtomValue } from 'jotai';
import { FunctionComponent, useCallback, useEffect, useRef, useState } from 'react';
import CoverageTab from './coverage/CoverageTab';
import TestRunsTab from './runs/TestRunsTab';
import RunTestsTab from './selection/RunTestsTab';
import TestSuiteManagerModal from './selection/TestSuiteManagerModal';
import TestSuitesPopover from './selection/TestSuitesPopover';
import type { SelectedTestRun } from './useApexTestRun';
import { useApexTestRunLauncher } from './useApexTestRunLauncher';
import { useApexTestRunsList } from './useApexTestRunsList';

const HEIGHT_BUFFER = 170;

export const ApexTestRunner: FunctionComponent = () => {
  useTitle(TITLES.APEX_TESTS);
  const selectedOrg = useAtomValue(selectedOrgState);
  const { defaultApiVersion } = useAtomValue(applicationCookieState);
  const tabsRef = useRef<TabsRef>(null);
  const [selectedRun, setSelectedRun] = useState<SelectedTestRun | null>(null);
  const [suiteManagerOpen, setSuiteManagerOpen] = useState(false);
  const runsList = useApexTestRunsList(selectedOrg);
  const { addOptimisticRun, fetchRuns, runs } = runsList;
  // Keep a trace flag active while the page is open so test runs capture debug logs (same as Anonymous Apex)
  useSetTraceFlag(selectedOrg, 1);

  const handleRunStarted = useCallback(
    (asyncApexJobId: string) => {
      addOptimisticRun(asyncApexJobId, selectedOrg.userId ?? '');
      setSelectedRun({ runId: `optimistic-${asyncApexJobId}`, asyncApexJobId });
      tabsRef.current?.changeTab('test-runs');
      fetchRuns();
      // A run launched from within the Run Tests panel would drop focus to <body> when the panel
      // hides (and a suite run's popover unmounts entirely) — land on the newly active tab instead
      window.setTimeout(() => {
        tabsRef.current?.focusTab('test-runs');
      });
    },
    [addOptimisticRun, fetchRuns, selectedOrg.userId],
  );

  const launcher = useApexTestRunLauncher(selectedOrg, defaultApiVersion, handleRunStarted);
  const { classesState, launchError, launching, runSelectedTests, runSuite, selectedClasses, suitesState } = launcher;

  const runDisabled = launching || selectedClasses.size === 0;
  usePrimaryActionShortcut(runSelectedTests, { disabled: runDisabled || suiteManagerOpen });

  // Once the real ApexTestRunResult for an optimistic selection arrives, swap the selection to it so run detail polling begins
  useEffect(() => {
    if (selectedRun?.runId.startsWith('optimistic-')) {
      const realRun = runs.find(
        (run) => !run.Id.startsWith('optimistic-') && run.AsyncApexJobId.slice(0, 15) === selectedRun.asyncApexJobId.slice(0, 15),
      );
      if (realRun) {
        setSelectedRun({ runId: realRun.Id, asyncApexJobId: realRun.AsyncApexJobId });
      }
    }
  }, [runs, selectedRun]);

  // Clear the run selection when the org changes — the runs list resets as well, and the suite
  // manager (if open) would otherwise keep showing the previous org's suites mid-edit
  useEffect(() => {
    setSelectedRun(null);
    setSuiteManagerOpen(false);
  }, [selectedOrg.uniqueId]);

  return (
    <Page testId="apex-test-runner-page">
      {suiteManagerOpen && (
        <TestSuiteManagerModal
          suitesState={suitesState}
          testClasses={classesState.testClasses}
          onClose={() => setSuiteManagerOpen(false)}
        />
      )}
      <PageHeader>
        <PageHeaderRow>
          <PageHeaderTitle icon={{ type: 'standard', icon: 'apex' }} label="Apex Test Runner" docsPath={APP_ROUTES.APEX_TESTS.DOCS} />
          <PageHeaderActions colType="actions" buttonType="separate">
            <TestSuitesPopover
              suitesState={suitesState}
              launching={launching}
              onRunSuite={runSuite}
              onOpenManager={() => setSuiteManagerOpen(true)}
            />
            <Tooltip
              openDelay={500}
              content={
                <div className="slds-p-bottom_small">
                  <KeyboardShortcut inverse keys={[getModifierKey(), 'enter']} />
                </div>
              }
            >
              {/* Stays focusable while disabled so the shortcut tooltip stays reachable and focus
                  survives the launch */}
              <button
                type="button"
                className="slds-button slds-button_brand"
                aria-keyshortcuts={getAriaKeyshortcuts([getModifierKey(), 'enter'])}
                {...ariaDisabledButtonProps(runDisabled, () => runSelectedTests())}
              >
                <Icon type="utility" icon="play" className="slds-button__icon slds-button__icon_left" omitContainer />
                Run Selected Tests
              </button>
            </Tooltip>
          </PageHeaderActions>
        </PageHeaderRow>
      </PageHeader>
      <AutoFullHeightContainer
        bottomBuffer={10}
        className="slds-p-horizontal_x-small slds-scrollable_none"
        bufferIfNotRendered={HEIGHT_BUFFER}
      >
        {/* Rendered above the tabs because a run can be launched from the page header on any tab */}
        {launchError && (
          <ScopedNotification theme="error" className="slds-m-vertical_x-small">
            {launchError}
          </ScopedNotification>
        )}
        <Tabs
          ref={tabsRef}
          renderAllContent
          tabs={[
            {
              id: 'run-tests',
              title: 'Run Tests',
              content: <RunTestsTab key={selectedOrg.uniqueId} launcher={launcher} />,
            },
            {
              id: 'test-runs',
              title: 'Test Runs',
              content: (
                <TestRunsTab
                  key={selectedOrg.uniqueId}
                  selectedOrg={selectedOrg}
                  apiVersion={defaultApiVersion}
                  runsList={runsList}
                  selectedRun={selectedRun}
                  onSelectedRunChange={setSelectedRun}
                />
              ),
            },
            {
              id: 'code-coverage',
              title: 'Code Coverage',
              content: <CoverageTab key={selectedOrg.uniqueId} selectedOrg={selectedOrg} />,
            },
          ]}
        />
      </AutoFullHeightContainer>
    </Page>
  );
};

export default ApexTestRunner;
