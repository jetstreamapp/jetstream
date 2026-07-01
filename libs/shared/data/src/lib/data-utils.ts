import type { SalesforceOrgUi } from '@jetstream/types';
import { query, queryMore } from './client-data';

/**
 * Runs a SOQL query and follows `nextRecordsUrl` until done or the shared row budget is exhausted.
 * Each page of records is passed to `onPage` and then discarded — callers that need to retain
 * records should accumulate them inside the callback.
 *
 * @param budget.remaining Decremented per record passed to `onPage`.
 * @returns `truncated` true when the budget ran out before all Salesforce rows were read.
 */
export async function queryWithRecordBudget<T extends Record<string, unknown>>(
  org: SalesforceOrgUi,
  soql: string,
  isTooling: boolean,
  budget: { remaining: number },
  onPage: (records: T[]) => void,
): Promise<{ truncated: boolean }> {
  let response = await query<T>(org, soql, isTooling);

  while (true) {
    const records = response.queryResults.records;
    if (budget.remaining <= 0) {
      return { truncated: true };
    }
    if (records.length > budget.remaining) {
      const allowed = records.slice(0, budget.remaining);
      onPage(allowed);
      budget.remaining = 0;
      return { truncated: true };
    }
    onPage(records);
    budget.remaining -= records.length;

    if (response.queryResults.done) {
      break;
    }
    const nextUrl = response.queryResults.nextRecordsUrl;
    if (!nextUrl) {
      break;
    }
    response = await queryMore<T>(org, nextUrl, isTooling);
  }

  return { truncated: false };
}
