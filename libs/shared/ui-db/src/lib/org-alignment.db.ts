import { OrgAlignmentRunSummaryCounts, OrgAlignmentSavedComparison } from '@jetstream/types';
import { LocalOnlyTables, getDexieDb, wrapApiWithReopenOnDatabaseClosed } from './ui-db';

/** Soft cap on locally stored Org Alignment comparison definitions per user */
export const ORG_ALIGNMENT_MAX_SAVED_COMPARISONS = 100;

export const orgAlignmentDb = {
  // Pure uuid generation, no db access — kept outside the wrapper, which only wraps async fns
  generateKey,
  ...wrapApiWithReopenOnDatabaseClosed({
    getAll,
    getByKey,
    save,
    deleteComparison,
    recordRunSummary,
  }),
};

function generateKey(): OrgAlignmentSavedComparison['key'] {
  return `${LocalOnlyTables.org_alignment_comparisons.keyPrefix}_${globalThis.crypto.randomUUID()}`;
}

/** All saved Org Alignment comparisons, most recently updated first */
async function getAll(): Promise<OrgAlignmentSavedComparison[]> {
  return await getDexieDb().org_alignment_comparisons.orderBy('updatedAt').reverse().toArray();
}

async function getByKey(key: string): Promise<OrgAlignmentSavedComparison | undefined> {
  return await getDexieDb().org_alignment_comparisons.get(key);
}

/** Save or update a comparison definition and prune the oldest entries if over the cap */
async function save(comparison: OrgAlignmentSavedComparison): Promise<OrgAlignmentSavedComparison> {
  const dexieDb = getDexieDb();
  const table = dexieDb.org_alignment_comparisons;
  await dexieDb.transaction('rw', table, async () => {
    await table.put(comparison);
    const keysNewestFirst = await table.orderBy('updatedAt').reverse().primaryKeys();
    const expiredKeys = keysNewestFirst.slice(ORG_ALIGNMENT_MAX_SAVED_COMPARISONS);
    if (expiredKeys.length > 0) {
      await table.bulkDelete(expiredKeys);
    }
  });
  return comparison;
}

async function deleteComparison(key: string): Promise<void> {
  await getDexieDb().org_alignment_comparisons.delete(key);
}

/** Update the last-run timestamp and drift counts on a saved comparison without overwriting its config */
async function recordRunSummary(
  key: string,
  summary: OrgAlignmentRunSummaryCounts,
  ranAt: Date = new Date(),
): Promise<OrgAlignmentSavedComparison | undefined> {
  const dexieDb = getDexieDb();
  const table = dexieDb.org_alignment_comparisons;
  let updated: OrgAlignmentSavedComparison | undefined;
  await dexieDb.transaction('rw', table, async () => {
    const existing = await table.get(key);
    if (!existing) {
      return;
    }
    updated = {
      ...existing,
      lastRunAt: ranAt,
      lastRunSummary: summary,
      updatedAt: ranAt,
    };
    await table.put(updated);
  });
  return updated;
}
