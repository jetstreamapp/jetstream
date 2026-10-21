import { AutomationControlHistoryEntry } from '@jetstream/types';
import { describe, expect, test } from 'vitest';
import { buildHistoryEntry, getRestoreSnapshot, stageRestoreSnapshot } from '../automation-control-history-utils';
import {
  AutomationControlDeploymentItem,
  DeploymentItem,
  TableRowItem,
  TableRowItemChild,
  TableRowOrItemOrChild,
  ToolingFlowVersionRecord,
} from '../automation-control-types';

function buildValidationRuleRow(overrides: Partial<TableRowItem> = {}): TableRowItem {
  return {
    path: ['Validation Rule', 'Require_Phone'],
    key: 'ValidationRule_03d000000000001',
    parentKey: 'ValidationRule',
    type: 'ValidationRule',
    sobject: 'Account',
    record: { FullName: 'Account.Require_Phone' } as TableRowItem['record'],
    link: '',
    readOnly: false,
    isActive: true,
    isActiveInitialState: true,
    label: 'Require_Phone',
    lastModifiedBy: '',
    description: null,
    additionalData: [],
    ...overrides,
  };
}

/** A record triggered flow with versions 1-3, where `activeVersion` is active in Salesforce */
function buildFlowRows(activeVersion: number | null): { parent: TableRowItem; versions: TableRowItemChild[] } {
  const key = 'FlowRecordTriggered_300000000000001';
  const versions = [1, 2, 3].map((versionNumber): TableRowItemChild => ({
    path: ['Flow', 'My_Flow', `Version ${versionNumber}`],
    key: `${key}_30100000000000${versionNumber}`,
    parentKey: key,
    type: 'FlowRecordTriggered',
    sobject: 'Contact',
    record: { VersionNumber: versionNumber } as ToolingFlowVersionRecord,
    isActive: versionNumber === activeVersion,
    isActiveInitialState: versionNumber === activeVersion,
    label: `My Flow (V${versionNumber})`,
    lastModifiedBy: '',
    description: null,
    additionalData: [],
  }));
  const parent: TableRowItem = {
    ...buildValidationRuleRow(),
    path: ['Flow', 'My_Flow'],
    key,
    parentKey: 'FlowRecordTriggered',
    type: 'FlowRecordTriggered',
    sobject: 'Contact',
    readOnly: true,
    isActive: activeVersion !== null,
    isActiveInitialState: activeVersion !== null,
    activeVersionNumber: activeVersion,
    activeVersionNumberInitialState: activeVersion,
    label: 'My Flow',
    children: versions,
  };
  return { parent, versions };
}

function toRowsByKey(rows: TableRowOrItemOrChild[]): Record<string, TableRowOrItemOrChild> {
  return Object.fromEntries(rows.map((row) => [row.key, row]));
}

function buildDeploymentItem(metadata: TableRowItem, deploy: Partial<AutomationControlDeploymentItem> = {}): DeploymentItem {
  return {
    status: 'Deploying',
    metadata,
    deploy: { type: metadata.type, id: metadata.key, value: metadata.isActive, requireMetadataApi: false, ...deploy },
  };
}

describe('buildHistoryEntry', () => {
  const deactivatedRule = buildValidationRuleRow({ isActive: false });
  const failedRule = buildValidationRuleRow({ key: 'ValidationRule_03d000000000002', label: 'Require_Email', isActive: false });
  const notPreparedRule = buildValidationRuleRow({
    key: 'ValidationRule_03d000000000003',
    sobject: 'Lead',
    label: 'Require_Company',
    isActive: false,
  });
  const interruptedRule = buildValidationRuleRow({ key: 'ValidationRule_03d000000000004', label: 'Require_Fax', isActive: false });
  const { parent: flow } = buildFlowRows(2);
  const flowToVersion3 = { ...flow, activeVersionNumber: 3 };

  const submittedItems = [
    buildDeploymentItem(deactivatedRule),
    buildDeploymentItem(failedRule),
    buildDeploymentItem(notPreparedRule, { retrieveError: [{ errorCode: 'NOT_FOUND', message: 'Could not retrieve metadata' }] }),
    buildDeploymentItem(interruptedRule),
    buildDeploymentItem(flowToVersion3),
  ];
  const deployResultsByKey: Record<string, AutomationControlDeploymentItem> = {
    [deactivatedRule.key]: submittedItems[0].deploy,
    [failedRule.key]: { ...submittedItems[1].deploy, deployError: [{ errorCode: 'FIELD_INTEGRITY_EXCEPTION', message: 'Bad value' }] },
    [flowToVersion3.key]: submittedItems[4].deploy,
  };

  test('records the state before and after each item along with its result', () => {
    const createdAt = new Date('2026-10-20T15:15:00Z');
    const entry = buildHistoryEntry({
      key: 'ach_1',
      org: 'org-1',
      action: 'deploy',
      source: null,
      isRollback: false,
      submittedItems,
      deployResultsByKey,
      createdAt,
    });

    expect(entry).toMatchObject({
      key: 'ach_1',
      org: 'org-1',
      action: 'deploy',
      source: null,
      createdAt,
      sobjects: ['Account', 'Contact', 'Lead'],
      types: ['ValidationRule', 'FlowRecordTriggered'],
      successCount: 2,
      errorCount: 2,
      incompleteCount: 1,
    });
    expect(entry.items).toEqual([
      {
        key: deactivatedRule.key,
        type: 'ValidationRule',
        fullName: 'Account.Require_Phone',
        sobject: 'Account',
        label: 'Require_Phone',
        previous: { isActive: true, activeVersionNumber: null },
        deployed: { isActive: false, activeVersionNumber: null },
        status: 'success',
        errorMessage: null,
      },
      expect.objectContaining({ key: failedRule.key, status: 'error', errorMessage: 'Bad value' }),
      expect.objectContaining({ key: notPreparedRule.key, status: 'error', errorMessage: 'Could not retrieve metadata' }),
      // no result was received, so the change may or may not have been applied
      expect.objectContaining({ key: interruptedRule.key, status: 'incomplete', errorMessage: null }),
      expect.objectContaining({
        key: flowToVersion3.key,
        previous: { isActive: true, activeVersionNumber: 2 },
        deployed: { isActive: true, activeVersionNumber: 3 },
        status: 'success',
      }),
    ]);
  });

  test('swaps before and after for a rollback, which deploys each initial state', () => {
    const source = { key: 'ach_1', createdAt: new Date('2026-10-20T15:15:00Z') };
    const entry = buildHistoryEntry({
      key: 'ach_2',
      org: 'org-1',
      action: 'rollback',
      source,
      isRollback: true,
      submittedItems: [submittedItems[0], submittedItems[4]],
      deployResultsByKey,
    });

    expect(entry.source).toEqual(source);
    expect(entry.items.map(({ previous, deployed }) => ({ previous, deployed }))).toEqual([
      { previous: { isActive: false, activeVersionNumber: null }, deployed: { isActive: true, activeVersionNumber: null } },
      { previous: { isActive: true, activeVersionNumber: 3 }, deployed: { isActive: true, activeVersionNumber: 2 } },
    ]);
  });
});

describe('getRestoreSnapshot', () => {
  const entry = {
    items: [
      {
        key: 'ValidationRule_1',
        type: 'ValidationRule',
        sobject: 'Account',
        label: 'Deployed rule',
        previous: { isActive: true, activeVersionNumber: null },
        deployed: { isActive: false, activeVersionNumber: null },
        status: 'success',
        errorMessage: null,
      },
      {
        key: 'FlowRecordTriggered_1',
        type: 'FlowRecordTriggered',
        sobject: 'Contact',
        label: 'Failed flow',
        previous: { isActive: true, activeVersionNumber: 2 },
        deployed: { isActive: false, activeVersionNumber: null },
        status: 'error',
        errorMessage: 'Bad value',
      },
      {
        key: 'ApexTrigger_1',
        type: 'ApexTrigger',
        sobject: 'Lead',
        label: 'Interrupted trigger',
        previous: { isActive: true, activeVersionNumber: null },
        deployed: { isActive: false, activeVersionNumber: null },
        status: 'incomplete',
        errorMessage: null,
      },
    ],
  } as AutomationControlHistoryEntry;

  test('a rollback restores the previous state of every item that may have changed', () => {
    expect(getRestoreSnapshot(entry, 'rollback')).toEqual([
      {
        key: 'ValidationRule_1',
        type: 'ValidationRule',
        sobject: 'Account',
        label: 'Deployed rule',
        isActive: true,
        activeVersionNumber: null,
      },
      {
        key: 'ApexTrigger_1',
        type: 'ApexTrigger',
        sobject: 'Lead',
        label: 'Interrupted trigger',
        isActive: true,
        activeVersionNumber: null,
      },
    ]);
  });

  test('a re-deploy applies the deployed state of every item so failures are retried', () => {
    expect(getRestoreSnapshot(entry, 'redeploy')).toEqual([
      {
        key: 'ValidationRule_1',
        type: 'ValidationRule',
        sobject: 'Account',
        label: 'Deployed rule',
        isActive: false,
        activeVersionNumber: null,
      },
      {
        key: 'FlowRecordTriggered_1',
        type: 'FlowRecordTriggered',
        sobject: 'Contact',
        label: 'Failed flow',
        isActive: false,
        activeVersionNumber: null,
      },
      {
        key: 'ApexTrigger_1',
        type: 'ApexTrigger',
        sobject: 'Lead',
        label: 'Interrupted trigger',
        isActive: false,
        activeVersionNumber: null,
      },
    ]);
  });
});

describe('stageRestoreSnapshot', () => {
  test('stages only items that differ from Salesforce and reports the rest', () => {
    const activeRule = buildValidationRuleRow();
    const inactiveRule = buildValidationRuleRow({ key: 'ValidationRule_2', isActive: false, isActiveInitialState: false });
    const rowsByKey = toRowsByKey([activeRule, inactiveRule]);

    const { rowsByKey: staged, result } = stageRestoreSnapshot(
      rowsByKey,
      [
        {
          key: activeRule.key,
          type: 'ValidationRule',
          sobject: 'Account',
          label: activeRule.label,
          isActive: false,
          activeVersionNumber: null,
        },
        {
          key: inactiveRule.key,
          type: 'ValidationRule',
          sobject: 'Account',
          label: 'Already inactive',
          isActive: false,
          activeVersionNumber: null,
        },
        {
          key: 'ValidationRule_deleted',
          type: 'ValidationRule',
          sobject: 'Account',
          label: 'Deleted',
          isActive: true,
          activeVersionNumber: null,
        },
      ],
      new Set(),
    );

    expect(result).toEqual({
      stagedCount: 1,
      stagedKeys: [activeRule.key],
      unchangedCount: 1,
      missingItems: [{ key: 'ValidationRule_deleted', label: 'Deleted', reason: 'Not found in Salesforce, it may have been deleted.' }],
    });
    expect(staged[activeRule.key]).toMatchObject({ isActive: false, isActiveInitialState: true });
    expect(staged[inactiveRule.key]).toBe(inactiveRule);
    // the input rows are never mutated
    expect(activeRule.isActive).toBe(true);
  });

  test('activates the target flow version and deactivates the others', () => {
    const { parent, versions } = buildFlowRows(2);
    const { rowsByKey, result } = stageRestoreSnapshot(
      toRowsByKey([parent, ...versions]),
      [{ key: parent.key, type: parent.type, sobject: parent.sobject, label: parent.label, isActive: true, activeVersionNumber: 3 }],
      new Set(),
    );

    expect(result.stagedCount).toBe(1);
    expect(rowsByKey[parent.key]).toMatchObject({ isActive: true, activeVersionNumber: 3 });
    expect(versions.map(({ key }) => (rowsByKey[key] as TableRowItemChild).isActive)).toEqual([false, false, true]);
    expect(versions[1].isActive).toBe(true);
  });

  test('deactivates a flow when the target has no active version', () => {
    const { parent, versions } = buildFlowRows(2);
    const { rowsByKey, result } = stageRestoreSnapshot(
      toRowsByKey([parent, ...versions]),
      [
        // an "active" flow without a version deploys as inactive
        { key: parent.key, type: parent.type, sobject: parent.sobject, label: parent.label, isActive: true, activeVersionNumber: null },
      ],
      new Set(),
    );

    expect(result.stagedCount).toBe(1);
    expect(rowsByKey[parent.key]).toMatchObject({ isActive: false, activeVersionNumber: null });
    expect(versions.map(({ key }) => (rowsByKey[key] as TableRowItemChild).isActive)).toEqual([false, false, false]);
  });

  test('skips a flow already on the target version and reports a version that no longer exists', () => {
    const { parent, versions } = buildFlowRows(2);
    const otherFlow = { ...parent, key: 'FlowRecordTriggered_2', label: 'Other Flow', children: [] };
    const { result } = stageRestoreSnapshot(
      toRowsByKey([parent, ...versions, otherFlow]),
      [
        { key: parent.key, type: parent.type, sobject: parent.sobject, label: parent.label, isActive: true, activeVersionNumber: 2 },
        {
          key: otherFlow.key,
          type: otherFlow.type,
          sobject: otherFlow.sobject,
          label: otherFlow.label,
          isActive: true,
          activeVersionNumber: 7,
        },
      ],
      new Set(),
    );

    expect(result).toEqual({
      stagedCount: 0,
      stagedKeys: [],
      unchangedCount: 1,
      missingItems: [{ key: otherFlow.key, label: 'Other Flow', reason: 'Version 7 no longer exists.' }],
    });
  });

  test('does not report items as deleted when their automation type failed to load', () => {
    const { result } = stageRestoreSnapshot(
      {},
      [
        {
          key: 'ValidationRule_1',
          type: 'ValidationRule',
          sobject: 'Account',
          label: 'Unloaded',
          isActive: false,
          activeVersionNumber: null,
        },
      ],
      new Set(['ValidationRule']),
    );

    expect(result.missingItems).toEqual([
      { key: 'ValidationRule_1', label: 'Unloaded', reason: 'Validation Rule automation could not be loaded from Salesforce.' },
    ]);
  });
});
