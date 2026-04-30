import type { ApiConnection } from '@jetstream/salesforce-api';

/**
 * Runs a SOQL query and follows `nextRecordsUrl` until done or the shared row budget is exhausted.
 *
 * @param budget.remaining Decremented per record appended to `sink`.
 * @returns `truncated` true when the budget ran out before all Salesforce rows were read.
 */
export async function queryWithRecordBudget<T extends Record<string, unknown>>(
  conn: ApiConnection,
  soql: string,
  budget: { remaining: number },
  sink: T[],
): Promise<{ truncated: boolean }> {
  let response = await conn.query.query<T>(soql);

  while (true) {
    for (const record of response.queryResults.records) {
      if (budget.remaining <= 0) {
        return { truncated: true };
      }
      sink.push(record);
      budget.remaining--;
    }

    if (response.queryResults.done) {
      break;
    }

    const nextUrl = response.queryResults.nextRecordsUrl;
    if (!nextUrl) {
      break;
    }

    response = await conn.query.queryMore<T>(nextUrl);
  }

  return { truncated: false };
}
