import { fromAutomationControlState } from '@jetstream/ui-core';
import { useAtom } from 'jotai';
import { useEffect } from 'react';
import { getRestoreSnapshot } from './automation-control-history-utils';
import { TableRowItem } from './automation-control-types';
import { useAutomationControlData } from './useAutomationControlData';

type AutomationControlData = ReturnType<typeof useAutomationControlData>;

interface UseHistoryRestoreStagingParams extends Pick<
  AutomationControlData,
  'loading' | 'hasError' | 'fetchStartedAt' | 'stageHistoryRestore' | 'stagedRestore'
> {
  /** Rows with pending changes, as of the last time they were reviewed */
  dirtyRows: TableRowItem[];
}

/**
 * Applies a rollback/re-deploy chosen from history (`pendingHistoryRestore`) to the editor's rows.
 *
 * The restore is only staged against data fetched after it was chosen (`fetchStartedAt`), so the pending
 * changes are compared with the current state in Salesforce rather than whatever was loaded before.
 *
 * @returns `historyRestore` is the staged restore only while the changes to deploy are nothing beyond what it staged
 */
export function useHistoryRestoreStaging({
  loading,
  hasError,
  fetchStartedAt,
  stageHistoryRestore,
  stagedRestore,
  dirtyRows,
}: UseHistoryRestoreStagingParams) {
  const [pendingHistoryRestore, setPendingHistoryRestore] = useAtom(fromAutomationControlState.pendingHistoryRestore);

  useEffect(() => {
    if (!pendingHistoryRestore || loading || !fetchStartedAt || fetchStartedAt < pendingHistoryRestore.requestedAt) {
      return;
    }
    setPendingHistoryRestore(null);
    // a failed load is already shown on the page and there is nothing reliable to compare against
    if (hasError) {
      return;
    }
    const { entry, action } = pendingHistoryRestore;
    stageHistoryRestore(action, { key: entry.key, createdAt: entry.createdAt }, getRestoreSnapshot(entry, action));
  }, [fetchStartedAt, hasError, loading, pendingHistoryRestore, setPendingHistoryRestore, stageHistoryRestore]);

  // A restore still waiting for data must not be staged later onto some other selection
  useEffect(() => {
    return () => setPendingHistoryRestore(null);
  }, [setPendingHistoryRestore]);

  const historyRestore =
    stagedRestore && dirtyRows.every(({ key }) => stagedRestore.result.stagedKeys.includes(key)) ? stagedRestore : null;

  return { pendingHistoryRestore, historyRestore };
}
