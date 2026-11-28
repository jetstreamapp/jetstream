import { OrgAlignmentSavedComparison } from '@jetstream/types';
import Dexie from 'dexie';
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ORG_ALIGNMENT_MAX_SAVED_COMPARISONS, orgAlignmentDb } from '../org-alignment.db';
import { createDexieInstance, getDexieDb, setDexieDbInstance } from '../ui-db';

function buildComparison(name: string, updatedAt: Date): OrgAlignmentSavedComparison {
  return {
    key: orgAlignmentDb.generateKey(),
    name,
    sourceOrgId: 'org-a',
    sourceOrgLabel: 'UAT',
    targetOrgId: 'org-b',
    targetOrgLabel: 'Production',
    selectionMode: 'common',
    selectedMetadataTypes: [],
    includeManaged: false,
    normalizePermissionXml: true,
    createdAt: updatedAt,
    updatedAt,
    lastRunAt: null,
    lastRunSummary: null,
  };
}

describe('orgAlignmentDb', () => {
  beforeAll(() => {
    Dexie.dependencies.indexedDB = new IDBFactory();
    Dexie.dependencies.IDBKeyRange = IDBKeyRange;
    setDexieDbInstance(createDexieInstance('org-alignment-spec'));
  });

  beforeEach(async () => {
    await getDexieDb().org_alignment_comparisons.clear();
  });

  it('generates prefixed keys', () => {
    expect(orgAlignmentDb.generateKey()).toMatch(/^oac_[0-9a-f-]{36}$/);
  });

  it('saves, lists newest first, updates, and deletes comparisons', async () => {
    const older = buildComparison('Older', new Date('2026-01-01T00:00:00Z'));
    const newer = buildComparison('Newer', new Date('2026-02-01T00:00:00Z'));

    await orgAlignmentDb.save(older);
    await orgAlignmentDb.save(newer);

    const listed = await orgAlignmentDb.getAll();
    expect(listed.map(({ name }) => name)).toEqual(['Newer', 'Older']);

    const fetched = await orgAlignmentDb.getByKey(older.key);
    expect(fetched?.name).toBe('Older');

    await orgAlignmentDb.deleteComparison(newer.key);
    expect((await orgAlignmentDb.getAll()).map(({ key }) => key)).toEqual([older.key]);
  });

  it('records last run summary without overwriting comparison configuration', async () => {
    const saved = buildComparison('Release Check', new Date('2026-01-01T00:00:00Z'));
    await orgAlignmentDb.save(saved);

    const ranAt = new Date('2026-03-01T12:00:00Z');
    const summary = {
      onlyInSource: 4,
      onlyInTarget: 2,
      different: 7,
      same: 50,
      uncomparable: 1,
      managedSkipped: 12,
    };

    const updated = await orgAlignmentDb.recordRunSummary(saved.key, summary, ranAt);
    expect(updated?.lastRunAt).toEqual(ranAt);
    expect(updated?.lastRunSummary).toEqual(summary);
    expect(updated?.name).toBe('Release Check');
  });

  it('enforces the retention cap by evicting the oldest entries', async () => {
    const baseTime = new Date('2026-01-01T00:00:00Z').getTime();
    const entries = Array.from({ length: ORG_ALIGNMENT_MAX_SAVED_COMPARISONS + 2 }, (_, i) =>
      buildComparison(`Comp ${i}`, new Date(baseTime + i * 60_000)),
    );
    for (const entry of entries) {
      await orgAlignmentDb.save(entry);
    }

    const all = await orgAlignmentDb.getAll();
    expect(all).toHaveLength(ORG_ALIGNMENT_MAX_SAVED_COMPARISONS);
    const keptKeys = new Set(all.map(({ key }) => key));
    expect(keptKeys.has(entries[0].key)).toBe(false);
    expect(keptKeys.has(entries[1].key)).toBe(false);
    expect(keptKeys.has(entries[entries.length - 1].key)).toBe(true);
  });
});
