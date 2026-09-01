import { ANALYTICS_KEYS } from '@jetstream/shared/constants';
import { useNonInitialEffect } from '@jetstream/shared/ui-utils';
import { getErrorMessage } from '@jetstream/shared/utils';
import type { SalesforceOrgUi } from '@jetstream/types';
import { useAmplitude } from '@jetstream/ui-core';
import { useCallback, useMemo, useState } from 'react';
import { buildRunTestsPayload, runTestsAsync } from './apex-test-runner-data.utils';
import { useApexTestClasses } from './useApexTestClasses';
import { useApexTestSuites } from './useApexTestSuites';

/**
 * Selection and launch state for Apex test runs. Lives above the tab container because the launch
 * actions (Run Selected Tests / suite runs) render in the page header while the class selection and
 * run options render inside the Run Tests tab.
 */
export function useApexTestRunLauncher(selectedOrg: SalesforceOrgUi, apiVersion: string, onRunStarted: (asyncApexJobId: string) => void) {
  const { trackEvent } = useAmplitude();
  const classesState = useApexTestClasses(selectedOrg);
  const suitesState = useApexTestSuites(selectedOrg, apiVersion);
  const [selectedClasses, setSelectedClasses] = useState<Map<string, Set<string> | 'ALL'>>(() => new Map());
  const [launching, setLaunching] = useState(false);
  const [launchError, setLaunchError] = useState<string | null>(null);
  const [maxFailedTests, setMaxFailedTests] = useState('');
  const [skipCodeCoverage, setSkipCodeCoverage] = useState(false);

  // The classes/suites hooks refetch on their own when the org changes, but this hook outlives the
  // switch (the header and tabs stay mounted) so selection and run options reset explicitly
  useNonInitialEffect(() => {
    setSelectedClasses(new Map());
    setLaunchError(null);
    setMaxFailedTests('');
    setSkipCodeCoverage(false);
  }, [selectedOrg.uniqueId]);

  const runOptions = useMemo(() => {
    const parsedMaxFailedTests = Number.parseInt(maxFailedTests, 10);
    return {
      maxFailedTests: Number.isInteger(parsedMaxFailedTests) && parsedMaxFailedTests >= 0 ? parsedMaxFailedTests : undefined,
      skipCodeCoverage,
    };
  }, [maxFailedTests, skipCodeCoverage]);

  const classesById = useMemo(
    () => new Map([...classesState.testClasses, ...classesState.unknownClasses].map((item) => [item.classId, item])),
    [classesState.testClasses, classesState.unknownClasses],
  );

  const selectedMethodCount = useMemo(() => {
    let count = 0;
    for (const [classId, selection] of selectedClasses) {
      count += selection === 'ALL' ? (classesById.get(classId)?.methods.length ?? 0) : selection.size;
    }
    return count;
  }, [selectedClasses, classesById]);

  const toggleClass = useCallback((classId: string) => {
    setSelectedClasses((prior) => {
      const updated = new Map(prior);
      updated.has(classId) ? updated.delete(classId) : updated.set(classId, 'ALL');
      return updated;
    });
  }, []);

  const toggleMethod = useCallback(
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

  const selectAllVisible = useCallback((classIds: string[], select: boolean) => {
    setSelectedClasses((prior) => {
      const updated = new Map(prior);
      for (const classId of classIds) {
        select ? updated.set(classId, 'ALL') : updated.delete(classId);
      }
      return updated;
    });
  }, []);

  const clearSelection = useCallback(() => setSelectedClasses(new Map()), []);

  const runSelectedTests = useCallback(async () => {
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

  const runSuite = useCallback(
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

  return {
    classesState,
    suitesState,
    selectedClasses,
    selectedMethodCount,
    launching,
    launchError,
    maxFailedTests,
    setMaxFailedTests,
    skipCodeCoverage,
    setSkipCodeCoverage,
    toggleClass,
    toggleMethod,
    selectAllVisible,
    clearSelection,
    runSelectedTests,
    runSuite,
  };
}
