const SALESFORCE_ID = /^[a-zA-Z0-9]{15}([a-zA-Z0-9]{3})?$/;

export function isValidSalesforceId(id: string): boolean {
  return SALESFORCE_ID.test(id.trim());
}

export function uniqueSalesforceIds(ids: string[]): string[] {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const raw of ids) {
    const id = raw?.trim();
    if (!id || !isValidSalesforceId(id) || seen.has(id)) {
      continue;
    }
    seen.add(id);
    output.push(id);
  }
  return output;
}

/**
 * Formats ids for use inside a SOQL `IN (...)` clause (single-quoted, comma-separated).
 */
export function formatIdsForInClause(ids: string[]): string {
  return ids.map((id) => `'${id.replace(/'/g, "\\'")}'`).join(',');
}

export function chunkIds(ids: string[], chunkSize: number): string[][] {
  const chunks: string[][] = [];
  for (let index = 0; index < ids.length; index += chunkSize) {
    chunks.push(ids.slice(index, index + chunkSize));
  }
  return chunks;
}
