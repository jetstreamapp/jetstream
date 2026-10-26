import { logger } from '@jetstream/shared/client-logger';
import { tracker } from '@jetstream/shared/ui-utils';
import {
  AutomationControlActivationState,
  AutomationControlHistoryAction,
  AutomationControlHistoryEntry,
  AutomationControlHistoryItem,
  AutomationControlHistoryItemStatus,
  AutomationControlHistorySource,
  AutomationControlRestoreAction,
  AutomationMetadataType,
  BadgeType,
  Maybe,
} from '@jetstream/types';
import { automationControlHistoryDb } from '@jetstream/ui/db';
import { format } from 'date-fns/format';
import { getAutomationFullName, getAutomationTypeLabel, isFlowAutomationType, isTableRowItem } from './automation-control-data-utils';
import {
  AutomationControlDeploymentItem,
  DeploymentItem,
  MetadataCompositeResponseError,
  StagedHistoryRestoreResult,
  TableRowItem,
  TableRowItemChild,
  TableRowItemSnapshot,
  TableRowOrItemOrChild,
} from './automation-control-types';

export function getHistoryActionLabel(action: AutomationControlHistoryAction) {
  switch (action) {
    case 'rollback':
      return 'Rolled back';
    case 'redeploy':
      return 'Re-deployed';
    case 'deploy':
    default:
      return 'Deployed';
  }
}

export function getRestoreActionLabel(action: AutomationControlRestoreAction) {
  return action === 'rollback' ? 'roll back' : 're-deploy';
}

/** e.g. "Oct 20, 2026, 3:15 PM" */
export function formatHistoryDate(date: Date) {
  return format(date, 'PPp');
}

export function getHistoryStatus({ successCount, errorCount, incompleteCount }: AutomationControlHistoryEntry): {
  label: string;
  badgeType: BadgeType;
} {
  if (incompleteCount > 0) {
    return { label: 'Incomplete', badgeType: 'warning' };
  }
  if (errorCount === 0) {
    return { label: 'Success', badgeType: 'success' };
  }
  if (successCount === 0) {
    return { label: 'Failed', badgeType: 'error' };
  }
  return { label: 'Partial success', badgeType: 'warning' };
}

function getDeployErrorMessage(errors: Maybe<MetadataCompositeResponseError[]>): string | null {
  if (!Array.isArray(errors) || errors.length === 0) {
    return null;
  }
  return errors.map(({ message }) => message).join('\n') || 'An unknown error has occurred.';
}

function getInitialActivationState({
  isActiveInitialState,
  activeVersionNumberInitialState,
}: TableRowItem): AutomationControlActivationState {
  return { isActive: isActiveInitialState, activeVersionNumber: activeVersionNumberInitialState ?? null };
}

function getPendingActivationState({ isActive, activeVersionNumber }: TableRowItem): AutomationControlActivationState {
  return { isActive, activeVersionNumber: activeVersionNumber ?? null };
}

interface BuildHistoryEntryParams {
  key: string;
  org: string;
  action: AutomationControlHistoryAction;
  source: AutomationControlHistorySource | null;
  /** Rollback deploys each row's initial state, so before and after are swapped */
  isRollback: boolean;
  submittedItems: DeploymentItem[];
  deployResultsByKey: Record<string, AutomationControlDeploymentItem>;
  createdAt?: Date;
}

/**
 * Build the history entry for a deployment from the items that were submitted and the per-item results
 * the deploy has emitted so far.
 *
 * An item without a result is `incomplete` — the entry is first saved before anything is deployed and
 * an interrupted deploy never reports the rest — so its change may or may not have been applied.
 */
export function buildHistoryEntry({
  key,
  org,
  action,
  source,
  isRollback,
  submittedItems,
  deployResultsByKey,
  createdAt = new Date(),
}: BuildHistoryEntryParams): AutomationControlHistoryEntry {
  const items = submittedItems.map(({ metadata, deploy }): AutomationControlHistoryItem => {
    const result = deployResultsByKey[metadata.key];
    // items that failed to prepare are never submitted, so they have an error but no result
    const errorMessage = getDeployErrorMessage(deploy.retrieveError) || getDeployErrorMessage(result?.deployError);
    let status: AutomationControlHistoryItemStatus = 'success';
    if (errorMessage) {
      status = 'error';
    } else if (!result) {
      status = 'incomplete';
    }
    return {
      key: metadata.key,
      type: metadata.type,
      fullName: getAutomationFullName(metadata.type, metadata.record),
      sobject: metadata.sobject,
      label: metadata.label,
      previous: isRollback ? getPendingActivationState(metadata) : getInitialActivationState(metadata),
      deployed: isRollback ? getInitialActivationState(metadata) : getPendingActivationState(metadata),
      status,
      errorMessage,
    };
  });

  return {
    key,
    org,
    action,
    source,
    createdAt,
    sobjects: Array.from(new Set(items.map(({ sobject }) => sobject))).sort(),
    types: Array.from(new Set(items.map(({ type }) => type))),
    successCount: items.filter(({ status }) => status === 'success').length,
    errorCount: items.filter(({ status }) => status === 'error').length,
    incompleteCount: items.filter(({ status }) => status === 'incomplete').length,
    items,
  };
}

/**
 * Records one deployment. Call `save()` before anything is submitted (every item is then incomplete) so a
 * deploy interrupted by closing the page is still recorded, and again with the latest results as they
 * arrive — every save replaces the same entry.
 *
 * History is best-effort: `save()` never rejects, so a failure to build or store the entry can never
 * surface as a failed deployment.
 */
export function createHistoryRecorder(params: Omit<BuildHistoryEntryParams, 'key' | 'createdAt' | 'deployResultsByKey'>) {
  const key = automationControlHistoryDb.generateKey();
  const createdAt = new Date();

  async function save(deployResultsByKey: Record<string, AutomationControlDeploymentItem> = {}) {
    try {
      await automationControlHistoryDb.saveEntry(buildHistoryEntry({ ...params, key, createdAt, deployResultsByKey }));
    } catch (ex) {
      logger.warn('[AUTOMATION][HISTORY] Error saving history entry', ex);
      tracker.warn('Automation Control history save failed', ex);
    }
  }

  return { key, createdAt, save };
}

/**
 * Target state for each item of a restore. A rollback skips items that failed (they never changed) but
 * keeps incomplete ones — staging compares with Salesforce, so any that never changed are skipped there.
 * A re-deploy includes every item so failures are retried.
 */
export function getRestoreSnapshot(entry: AutomationControlHistoryEntry, action: AutomationControlRestoreAction): TableRowItemSnapshot[] {
  return entry.items
    .filter(({ status }) => action === 'redeploy' || status !== 'error')
    .map(({ key, type, sobject, label, previous, deployed }) => {
      const { isActive, activeVersionNumber } = action === 'rollback' ? previous : deployed;
      return { key, type, sobject, label, isActive, activeVersionNumber };
    });
}

/**
 * Stage a restore snapshot onto freshly fetched rows. Only items whose current Salesforce state
 * differs from the target become pending changes, so the normal Review Changes step shows exactly
 * what will change.
 */
export function stageRestoreSnapshot(
  rowsByKey: Record<string, TableRowOrItemOrChild>,
  snapshot: TableRowItemSnapshot[],
  /** Types whose fetch failed — their items are absent because they could not be loaded, not because they were deleted */
  unavailableTypes: Set<AutomationMetadataType>,
): { rowsByKey: Record<string, TableRowOrItemOrChild>; result: StagedHistoryRestoreResult } {
  const output = { ...rowsByKey };
  const result: StagedHistoryRestoreResult = { stagedCount: 0, stagedKeys: [], unchangedCount: 0, missingItems: [] };

  snapshot.forEach(({ key, type, label, isActive, activeVersionNumber }) => {
    const row = output[key];
    if (!row || !isTableRowItem(row)) {
      const reason = unavailableTypes.has(type)
        ? `${getAutomationTypeLabel(type)} automation could not be loaded from Salesforce.`
        : 'Not found in Salesforce, it may have been deleted.';
      result.missingItems.push({ key, label, reason });
      return;
    }

    if (!isFlowAutomationType(row.type)) {
      if (isActive === row.isActiveInitialState) {
        result.unchangedCount++;
        return;
      }
      output[key] = { ...row, isActive };
      result.stagedCount++;
      result.stagedKeys.push(key);
      return;
    }

    // Flows and Process Builders are activated by version — an "active" target without a version
    // deployed as inactive, so it is restored that way too
    const targetVersion = isActive ? activeVersionNumber : null;
    if (targetVersion === (row.activeVersionNumberInitialState ?? null)) {
      result.unchangedCount++;
      return;
    }
    const versions = row.children || [];
    if (targetVersion !== null && !versions.some(({ record }) => record.VersionNumber === targetVersion)) {
      result.missingItems.push({ key, label, reason: `Version ${targetVersion} no longer exists.` });
      return;
    }
    versions.forEach((version) => {
      output[version.key] = { ...(output[version.key] as TableRowItemChild), isActive: version.record.VersionNumber === targetVersion };
    });
    output[key] = { ...row, isActive: targetVersion !== null, activeVersionNumber: targetVersion };
    result.stagedCount++;
    result.stagedKeys.push(key);
  });

  return { rowsByKey: output, result };
}
