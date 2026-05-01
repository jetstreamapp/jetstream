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

const OBJECT_API_NAME_PATTERN = /^[a-zA-Z][a-zA-Z0-9_.]*$/;
const MAX_OBJECT_API_NAMES_PER_EXPORT = 500;

/**
 * Normalizes object API names from the permission export job payload for SOQL filters.
 * Drops invalid tokens and caps list length.
 */
export function sanitizePermissionExportObjectApiNames(raw: unknown): string[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const seen = new Set<string>();
  const output: string[] = [];
  for (const item of raw) {
    if (typeof item !== 'string') {
      continue;
    }
    const name = item.trim();
    if (name.length === 0 || name.length > 255 || !OBJECT_API_NAME_PATTERN.test(name) || seen.has(name)) {
      continue;
    }
    seen.add(name);
    output.push(name);
    if (output.length >= MAX_OBJECT_API_NAMES_PER_EXPORT) {
      break;
    }
  }
  return output;
}

/** Formats API names for use inside a SOQL `IN (...)` clause (single-quoted, comma-separated). */
export function formatApiNamesForInClause(names: string[]): string {
  return names.map((name) => `'${name.replace(/'/g, "\\'")}'`).join(',');
}

export function chunkIds(ids: string[], chunkSize: number): string[][] {
  const chunks: string[][] = [];
  for (let index = 0; index < ids.length; index += chunkSize) {
    chunks.push(ids.slice(index, index + chunkSize));
  }
  return chunks;
}
