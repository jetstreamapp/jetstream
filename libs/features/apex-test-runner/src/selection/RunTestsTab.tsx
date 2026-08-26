import { ANALYTICS_KEYS } from '@jetstream/shared/constants';
import { getErrorMessage } from '@jetstream/shared/utils';
import type { SalesforceOrgUi } from '@jetstream/types';
import { Grid, Icon, ScopedNotification, Spinner } from '@jetstream/ui';
import { useAmplitude } from '@jetstream/ui-core';
import { FunctionComponent, useCallback, useMemo, useState } from 'react';
import { buildRunTestsPayload, runTestsAsync } from '../apex-test-runner-data.utils';
import { useApexTestClasses } from '../useApexTestClasses';
import TestClassSelection from './TestClassSelection';

export interface RunTestsTabProps {
  selectedOrg: SalesforceOrgUi;
  onRunStarted: (asyncApexJobId: string) => void;
}

export const RunTestsTab: FunctionComponent<RunTestsTabProps> = ({ selectedOrg, onRunStarted }) => {
  const { trackEvent } = useAmplitude();
  const { testClasses, unknownClasses, loading, progressText, errorMessage, refresh } = useApexTestClasses(selectedOrg);
  const [selectedClasses, setSelectedClasses] = useState<Map<string, Set<string> | 'ALL'>>(() => new Map());
  const [launching, setLaunching] = useState(false);
  const [launchError, setLaunchError] = useState<string | null>(null);

  const classesByid = useMemo(
    () => new Map([...testClasses, ...unknownClasses].map((item) => [item.classId, item])),
    [testClasses, unknownClasses],
  );

  const selectedMethodCount = useMemo(() => {
    let count = 0;
    for (const [classId, selection] of selectedClasses) {
      count += selection === 'ALL' ? (classesByid.get(classId)?.methods.length ?? 0) : selection.size;
    }
    return count;
  }, [selectedClasses, classesByid]);

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
        const allMethods = classesByid.get(classId)?.methods ?? [];
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
    [classesByid],
  );

  const handleRunTests = useCallback(async () => {
    try {
      setLaunching(true);
      setLaunchError(null);
      const hasMethodLevelSelection = Array.from(selectedClasses.values()).some((selection) => selection !== 'ALL');
      const asyncApexJobId = await runTestsAsync(selectedOrg, buildRunTestsPayload({ type: 'tests', classes: selectedClasses }));
      trackEvent(ANALYTICS_KEYS.apex_tests_run, {
        classCount: selectedClasses.size,
        methodCount: selectedMethodCount,
        hasMethodLevelSelection,
        source: 'classes',
      });
      onRunStarted(asyncApexJobId);
    } catch (ex) {
      setLaunchError(getErrorMessage(ex));
    } finally {
      setLaunching(false);
    }
  }, [selectedOrg, selectedClasses, selectedMethodCount, trackEvent, onRunStarted]);

  const handleRefresh = useCallback(() => {
    refresh();
    trackEvent(ANALYTICS_KEYS.apex_tests_class_refresh);
  }, [refresh, trackEvent]);

  return (
    <div className="slds-is-relative">
      <Grid verticalAlign="center" className="slds-m-vertical_x-small">
        <button className="slds-button slds-button_brand" disabled={launching || selectedClasses.size === 0} onClick={handleRunTests}>
          <Icon type="utility" icon="play" className="slds-button__icon slds-button__icon_left" omitContainer />
          Run Selected Tests
        </button>
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
        />
      )}
    </div>
  );
};

export default RunTestsTab;
