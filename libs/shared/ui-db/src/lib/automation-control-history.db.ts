import { AutomationControlHistoryEntry } from '@jetstream/types';
import { LocalOnlyTables, getDexieDb, wrapApiWithReopenOnDatabaseClosed } from './ui-db';

/**
 * Entries are small (activation state only, no metadata bodies), so a fixed per-org cap is enough to
 * keep the table bounded without a time-based expiry — an old entry is still the only record of what
 * was changed if nothing has been deployed since.
 */
export const AUTOMATION_CONTROL_HISTORY_MAX_ENTRIES_PER_ORG = 100;

const MIN_DATE = new Date(0);
const MAX_DATE = new Date(8.64e15);

export const automationControlHistoryDb = {
  // Pure uuid generation, no db access — kept outside the wrapper, which only wraps async fns
  generateKey,
  ...wrapApiWithReopenOnDatabaseClosed({
    saveEntry,
    getEntries,
  }),
};

function generateKey(): AutomationControlHistoryEntry['key'] {
  return `${LocalOnlyTables.automation_control_history.keyPrefix}_${globalThis.crypto.randomUUID()}`;
}

/** Save an entry and drop the org's oldest entries beyond the retention cap */
async function saveEntry(entry: AutomationControlHistoryEntry): Promise<AutomationControlHistoryEntry> {
  const dexieDb = getDexieDb();
  const table = dexieDb.automation_control_history;
  await dexieDb.transaction('rw', table, async () => {
    await table.put(entry);
    const keysNewestFirst = await table
      .where('[org+createdAt]')
      .between([entry.org, MIN_DATE], [entry.org, MAX_DATE], true, true)
      .reverse()
      .primaryKeys();
    const expiredKeys = keysNewestFirst.slice(AUTOMATION_CONTROL_HISTORY_MAX_ENTRIES_PER_ORG);
    if (expiredKeys.length > 0) {
      await table.bulkDelete(expiredKeys);
    }
  });
  return entry;
}

/** Entries for one org, newest first */
async function getEntries(org: string): Promise<AutomationControlHistoryEntry[]> {
  return await getDexieDb()
    .automation_control_history.where('[org+createdAt]')
    .between([org, MIN_DATE], [org, MAX_DATE], true, true)
    .reverse()
    .toArray();
}
