import { parseISO } from 'date-fns/parseISO';
import { SyncableEntity } from '../ui-db';

/**
 * Records travel to and from the server as JSON, so dates arrive as ISO strings. These are the
 * fields that must be `Date`s locally - several are indexed, and IndexedDB sorts strings and dates
 * as different types.
 */
const DATE_FIELDS: Record<SyncableEntity, string[]> = {
  query_history: ['createdAt', 'updatedAt', 'lastRun'],
  load_saved_mapping: ['createdAt', 'updatedAt'],
  recent_history_item: ['createdAt', 'updatedAt'],
  api_request_history: ['createdAt', 'updatedAt', 'lastRun'],
};

function toDate(value: unknown): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === 'string') {
    const date = parseISO(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
}

/**
 * Turn a record received from the server into the shape the rest of the app stores locally.
 * Always returns a new object.
 */
export function normalizeSyncedRecord(entity: SyncableEntity, key: string, data: Record<string, unknown>): Record<string, unknown> {
  const record: Record<string, unknown> = { ...data, key };

  for (const field of DATE_FIELDS[entity]) {
    const date = toDate(record[field]);
    if (date) {
      record[field] = date;
    }
  }

  if (entity === 'recent_history_item' && Array.isArray(record.items)) {
    record.items = record.items.map((item: Record<string, unknown>) => ({ ...item, lastUsed: toDate(item?.lastUsed) ?? item?.lastUsed }));
  }

  if (entity === 'query_history') {
    // Booleans cannot be indexed, so the app queries this string mirror - it must never be stale
    record.isFavoriteIdx = record.isFavorite ? 'true' : 'false';
  }

  return record;
}

/**
 * When a local record was last edited, by this device's clock. This is what the server compares
 * when two devices changed the same record, so every local write must bump `updatedAt`.
 */
export function getRecordEditTime(record: Record<string, unknown>): Date {
  return toDate(record.updatedAt) ?? toDate(record.lastRun) ?? toDate(record.createdAt) ?? new Date(0);
}

function toComparable(value: unknown): unknown {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (Array.isArray(value)) {
    return value.map(toComparable);
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, propValue]) => propValue !== undefined)
        .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
        .map(([prop, propValue]) => [prop, toComparable(propValue)]),
    );
  }
  return value;
}

/**
 * True when two copies of a record carry the same content, regardless of property order, of whether
 * dates are `Date`s or ISO strings, or of properties that are present but undefined.
 */
export function isSameRecordContent(left: Record<string, unknown>, right: Record<string, unknown>): boolean {
  return JSON.stringify(toComparable(left)) === JSON.stringify(toComparable(right));
}
