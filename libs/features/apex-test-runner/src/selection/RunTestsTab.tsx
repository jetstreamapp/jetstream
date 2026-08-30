import { css } from '@emotion/react';
import { ANALYTICS_KEYS } from '@jetstream/shared/constants';
import { getErrorMessage } from '@jetstream/shared/utils';
import type { SalesforceOrgUi } from '@jetstream/types';
import { Checkbox, Grid, Icon, Input, ScopedNotification, Spinner } from '@jetstream/ui';
import { useAmplitude } from '@jetstream/ui-core';
import { FunctionComponent, useCallback, useMemo, useState } from 'react';
import { buildRunTestsPayload, runTestsAsync } from '../apex-test-runner-data.utils';
import { useApexTestClasses } from '../useApexTestClasses';
import { useApexTestSuites } from '../useApexTestSuites';
import TestClassSelection from './TestClassSelection';
import TestSuiteManagerModal from './TestSuiteManagerModal';
import TestSuitesPopover from './TestSuitesPopover';

export interface RunTestsTabProps {
  selectedOrg: SalesforceOrgUi;
  apiVersion: string;
  onRunStarted: (asyncApexJobId: string) => void;
}

export const RunTestsTab: FunctionComponent<RunTestsTabProps> = ({ selectedOrg, apiVersion, onRunStarted }) => {
  const { trackEvent } = useAmplitude();
  const { testClasses, unknownClasses, loading, progressText, errorMessage, refresh } = useApexTestClasses(selectedOrg);
  const suitesState = useApexTestSuites(selectedOrg, apiVersion);
  const [selectedClasses, setSelectedClasses] = useState<Map<string, Set<string> | 'ALL'>>(() => new Map());
  const [suiteManagerOpen, setSuiteManagerOpen] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [launchError, setLaunchError] = useState<string | null>(null);
  const [maxFailedTests, setMaxFailedTests] = useState('');
  const [skipCodeCoverage, setSkipCodeCoverage] = useState(false);

  const runOptions = useMemo(() => {
    const parsedMaxFailedTests = Number.parseInt(maxFailedTests, 10);
    return {
      maxFailedTests: Number.isInteger(parsedMaxFailedTests) && parsedMaxFailedTests >= 0 ? parsedMaxFailedTests : undefined,
      skipCodeCoverage,
    };
  }, [maxFailedTests, skipCodeCoverage]);

  const classesById = useMemo(
    () => new Map([...testClasses, ...unknownClasses].map((item) => [item.classId, item])),
    [testClasses, unknownClasses],
  );

  const selectedMethodCount = useMemo(() => {
    let count = 0;
    for (const [classId, selection] of selectedClasses) {
      count += selection === 'ALL' ? (classesById.get(classId)?.methods.length ?? 0) : selection.size;
    }
    return count;
  }, [selectedClasses, classesById]);

  const handleToggleClass = useCallback((classId: string) => {
    setSelectedClasses((prior) => {
      const updated = new Map(prior);
      updated.has(classId) ? updated.delete(classId) : updated.set(classId, 'ALL');
      return updated;
    });
  }, []);

  const handleToggleMethod = useCallback(
    (classId: string, method: string) => {
      setSelectedClasses((prior) => {
        const updated = new Map(prior);
        const allMethods = classesById.get(classId)?.methods ?? [];
        const current = updated.get(classId);
        let methods: Set<string>;
        if (current === 'ALL') {
          methods = new Set(allMethods.filter((currentMethod) => currentMethod !== method));
        } else if (current instanceof Set) {
          methods = new Set(current);
          methods.has(method) ? methods.delete(method) : methods.add(method);
        } else {
          methods = new Set([method]);
        }
        if (methods.size === 0) {
          updated.delete(classId);
        } else if (methods.size === allMethods.length) {
          updated.set(classId, 'ALL');
        } else {
          updated.set(classId, methods);
        }
        return updated;
      });
    },
    [classesById],
  );

  const handleSelectAllVisible = useCallback((classIds: string[], select: boolean) => {
    setSelectedClasses((prior) => {
      const updated = new Map(prior);
      for (const classId of classIds) {
        select ? updated.set(classId, 'ALL') : updated.delete(classId);
      }
      return updated;
    });
  }, []);

  const handleRunTests = useCallback(async () => {
    try {
      setLaunching(true);
      setLaunchError(null);
      const hasMethodLevelSelection = Array.from(selectedClasses.values()).some((selection) => selection !== 'ALL');
      const asyncApexJobId = await runTestsAsync(
        selectedOrg,
        buildRunTestsPayload({ type: 'tests', classes: selectedClasses }, runOptions),
      );
      trackEvent(ANALYTICS_KEYS.apex_tests_run, {
        classCount: selectedClasses.size,
        methodCount: selectedMethodCount,
        hasMethodLevelSelection,
        skipCodeCoverage: runOptions.skipCodeCoverage,
        hasMaxFailedTests: runOptions.maxFailedTests !== undefined,
        source: 'classes',
      });
      onRunStarted(asyncApexJobId);
    } catch (ex) {
      setLaunchError(getErrorMessage(ex));
    } finally {
      setLaunching(false);
    }
  }, [selectedOrg, selectedClasses, selectedMethodCount, runOptions, trackEvent, onRunStarted]);

  const handleRunSuite = useCallback(
    async (suiteId: string) => {
      try {
        setLaunching(true);
        setLaunchError(null);
        const asyncApexJobId = await runTestsAsync(selectedOrg, buildRunTestsPayload({ type: 'suite', suiteId }, runOptions));
        trackEvent(ANALYTICS_KEYS.apex_tests_run, {
          skipCodeCoverage: runOptions.skipCodeCoverage,
          hasMaxFailedTests: runOptions.maxFailedTests !== undefined,
          source: 'suite',
        });
        onRunStarted(asyncApexJobId);
      } catch (ex) {
        setLaunchError(getErrorMessage(ex));
      } finally {
        setLaunching(false);
      }
    },
    [selectedOrg, runOptions, trackEvent, onRunStarted],
  );

  const handleRefresh = useCallback(() => {
    refresh();
    trackEvent(ANALYTICS_KEYS.apex_tests_class_refresh);
  }, [refresh, trackEvent]);

  return (
    <div className="slds-is-relative">
      {suiteManagerOpen && (
        <TestSuiteManagerModal suitesState={suitesState} testClasses={testClasses} onClose={() => setSuiteManagerOpen(false)} />
      )}
      <Grid verticalAlign="center" className="slds-m-vertical_x-small">
        <button className="slds-button slds-button_brand" disabled={launching || selectedClasses.size === 0} onClick={handleRunTests}>
          <Icon type="utility" icon="play" className="slds-button__icon slds-button__icon_left" omitContainer />
          Run Selected Tests
        </button>
        <TestSuitesPopover
          suitesState={suitesState}
          launching={launching}
          onRunSuite={handleRunSuite}
          onOpenManager={() => setSuiteManagerOpen(true)}
        />
        {!!selectedClasses.size && (
          <span className="slds-m-left_small">
            {selectedClasses.size} {selectedClasses.size === 1 ? 'class' : 'classes'}
            {selectedMethodCount ? ` / ${selectedMethodCount} ${selectedMethodCount === 1 ? 'method' : 'methods'}` : ''} selected
          </span>
        )}
        {!!selectedClasses.size && (
          <button className="slds-button slds-m-left_small" onClick={() => setSelectedClasses(new Map())}>
            Clear Selection
          </button>
        )}
        <div className="slds-col_bump-left">
          <button
            className="slds-button slds-button_neutral"
            disabled={loading}
            onClick={handleRefresh}
            title="Re-check the org for new or changed test classes"
          >
            <Icon type="utility" icon="refresh" className="slds-button__icon slds-button__icon_left" omitContainer />
            Refresh Test Classes
          </button>
        </div>
      </Grid>
      <Grid verticalAlign="end" className="slds-m-bottom_x-small">
        <Input
          label="Stop After Failures"
          labelHelp="Stop executing new tests after this many failures. Leave blank for no limit. Applies to class and suite runs."
          css={css`
            width: 170px;
          `}
        >
          <input
            id="max-failed-tests"
            className="slds-input"
            type="number"
            min={0}
            step={1}
            placeholder="No limit"
            disabled={launching}
            value={maxFailedTests}
            onChange={(event) => setMaxFailedTests(event.target.value)}
          />
        </Input>
        <Checkbox
          id="skip-code-coverage"
          className="slds-m-left_small slds-m-bottom_xx-small"
          checked={skipCodeCoverage}
          disabled={launching}
          label="Skip code coverage"
          labelHelp="Runs faster, but coverage results are not collected. Applies to class and suite runs."
          onChange={setSkipCodeCoverage}
        />
      </Grid>
      {launchError && (
        <ScopedNotification theme="error" className="slds-m-vertical_x-small">
          {launchError}
        </ScopedNotification>
      )}
      {errorMessage && (
        <ScopedNotification theme="error" className="slds-m-vertical_x-small">
          {errorMessage}
        </ScopedNotification>
      )}
      {loading && (
        <div className="slds-is-relative slds-m-vertical_large">
          <Spinner size="small" />
          {progressText && <p className="slds-text-align_center slds-p-top_x-large">{progressText}</p>}
        </div>
      )}
      {!loading && (
        <TestClassSelection
          testClasses={testClasses}
          unknownClasses={unknownClasses}
          selectedClasses={selectedClasses}
          onToggleClass={handleToggleClass}
          onToggleMethod={handleToggleMethod}
          onSelectAllVisible={handleSelectAllVisible}
        />
      )}
    </div>
  );
};

export default RunTestsTab;
