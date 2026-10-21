import { AutomationControlHistoryEntry } from '@jetstream/types';
import Dexie from 'dexie';
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AUTOMATION_CONTROL_HISTORY_MAX_ENTRIES_PER_ORG, automationControlHistoryDb } from '../automation-control-history.db';
import { createDexieInstance, getDexieDb, setDexieDbInstance } from '../ui-db';

function buildEntry(org: string, createdAt: Date): AutomationControlHistoryEntry {
  return {
    key: automationControlHistoryDb.generateKey(),
    org,
    action: 'deploy',
    source: null,
    createdAt,
    sobjects: ['Account'],
    types: ['ValidationRule'],
    successCount: 1,
    errorCount: 0,
    incompleteCount: 0,
    items: [
      {
        key: 'ValidationRule_03d000000000001',
        type: 'ValidationRule',
        fullName: 'Account.Require_Phone',
        sobject: 'Account',
        label: 'Require_Phone',
        previous: { isActive: true, activeVersionNumber: null },
        deployed: { isActive: false, activeVersionNumber: null },
        status: 'success',
        errorMessage: null,
      },
    ],
  };
}

describe('automationControlHistoryDb', () => {
  beforeAll(() => {
    // Scoped to this spec rather than the project's setupFiles, which the other ui-db specs do not use
    Dexie.dependencies.indexedDB = new IDBFactory();
    Dexie.dependencies.IDBKeyRange = IDBKeyRange;
    setDexieDbInstance(createDexieInstance('automation-control-history-spec'));
  });

  beforeEach(async () => {
    await getDexieDb().automation_control_history.clear();
  });

  it('generates prefixed keys', () => {
    expect(automationControlHistoryDb.generateKey()).toMatch(/^ach_[0-9a-f-]{36}$/);
  });

  it('lists only the requested org, newest first', async () => {
    const oldest = buildEntry('org-a', new Date('2026-01-01T00:00:00Z'));
    const newest = buildEntry('org-a', new Date('2026-03-01T00:00:00Z'));
    const middle = buildEntry('org-a', new Date('2026-02-01T00:00:00Z'));
    const otherOrg = buildEntry('org-b', new Date('2026-04-01T00:00:00Z'));
    for (const entry of [oldest, newest, middle, otherOrg]) {
      await automationControlHistoryDb.saveEntry(entry);
    }

    const entries = await automationControlHistoryDb.getEntries('org-a');
    expect(entries.map(({ key }) => key)).toEqual([newest.key, middle.key, oldest.key]);
    expect(entries[0]).toEqual(newest);
  });

  it('drops the oldest entries for an org beyond the retention cap without touching other orgs', async () => {
    const baseTime = new Date('2026-01-01T00:00:00Z').getTime();
    const orgEntries = Array.from({ length: AUTOMATION_CONTROL_HISTORY_MAX_ENTRIES_PER_ORG + 2 }, (_, i) =>
      buildEntry('org-a', new Date(baseTime + i * 60_000)),
    );
    const otherOrgEntry = buildEntry('org-b', new Date(baseTime - 60_000));
    await automationControlHistoryDb.saveEntry(otherOrgEntry);
    for (const entry of orgEntries) {
      await automationControlHistoryDb.saveEntry(entry);
    }

    const entries = await automationControlHistoryDb.getEntries('org-a');
    expect(entries).toHaveLength(AUTOMATION_CONTROL_HISTORY_MAX_ENTRIES_PER_ORG);
    const keptKeys = new Set(entries.map(({ key }) => key));
    expect(keptKeys.has(orgEntries[0].key)).toBe(false);
    expect(keptKeys.has(orgEntries[1].key)).toBe(false);
    expect(keptKeys.has(orgEntries[orgEntries.length - 1].key)).toBe(true);

    expect(await automationControlHistoryDb.getEntries('org-b')).toHaveLength(1);
  });
});
