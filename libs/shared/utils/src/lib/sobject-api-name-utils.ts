import { REGEX } from './regex';

export function isValidSalesforceId(id: string): boolean {
  return REGEX.SFDC_ID.test(id.trim());
}

export function uniqueSalesforceIds(ids: string[]): string[] {
  return Array.from(new Set(ids.filter((id) => REGEX.SFDC_ID.test(id))));
}

const OBJECT_API_NAME_PATTERN = /^[a-zA-Z][a-zA-Z0-9_.]*$/;
const MAX_SOBJECT_API_NAMES_PER_REQUEST = 500;

/**
 * Normalizes sobject API names from analysis job payloads for use in SOQL filters.
 * Drops invalid tokens, dedupes, and caps list length to defend against SOQL injection.
 */
export function sanitizeSobjectApiNames(raw: unknown): string[] {
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
    if (output.length >= MAX_SOBJECT_API_NAMES_PER_REQUEST) {
      break;
    }
  }
  return output;
}
