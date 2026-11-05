import { parseISO } from 'date-fns/parseISO';
import { z } from 'zod';
import { Maybe } from '../types';
import { SavedFieldMapping } from '../ui/load-records-types';
import { SalesforceApiHistoryRequest, SalesforceApiHistoryResponse } from '../ui/types';

const DateTimeSchema = z.union([z.string(), z.date()]).transform((val) => (val instanceof Date ? val : parseISO(val)));

/**
 * Reserved object keys that can corrupt prototype-based lookups (prototype pollution).
 * The sync `key` is attacker-controlled and is used to build plain-object lookup maps on the
 * server, while the `data` payload is persisted to JSONB and re-broadcast to other clients.
 * Legit client keys are prefixed (qh_/lsm_/ri_/api_), so none of these are valid sync keys.
 */
const RESERVED_OBJECT_KEYS = ['__proto__', 'constructor', 'prototype'];

/**
 * Maximum nesting depth allowed in a sync `data` payload. Legit sync records are shallow; this cap
 * prevents a maliciously deep object from exhausting the stack while walking it.
 */
const MAX_SYNC_DATA_DEPTH = 100;

/**
 * Size caps for a single sync record and for one push request. These are shared by the web, desktop
 * and browser-extension sync routes and by the local (desktop/extension/canvas) sync controllers.
 *
 * - key: query-history keys embed the (lower-cased, stripped) SOQL, which Salesforce caps at 100,000
 *   characters, so 128 KiB leaves room for the org/object prefix.
 * - data: the largest real payload is a query-history item (SOQL plus label/metadata, ~110 KB worst
 *   case) or a saved load mapping with a few hundred fields, so 512 KiB is roughly 4x headroom.
 * - records per push: clients push in batches of 50 (MAX_PUSH_SIZE in @jetstream/shared/ui-db).
 * - push total: 5 MiB bounds a single request well below the global 20 MB JSON body limit while still
 *   allowing a full batch of unusually large records.
 *
 * Sizes are measured as JSON.stringify length (UTF-16 code units), which is at or below the UTF-8 byte
 * length, so the caps are a predictable "characters" bound rather than an exact byte count.
 */
export const MAX_SYNC_KEY_LENGTH = 128 * 1024;
export const MAX_SYNC_RECORD_DATA_LENGTH = 512 * 1024;
export const MAX_SYNC_RECORDS_PER_PUSH = 50;
export const MAX_SYNC_PUSH_LENGTH = 5 * 1024 * 1024;

/**
 * Recursively strip dangerous own keys (__proto__/constructor/prototype) from an object/array
 * at any depth so a nested `__proto__` cannot survive into persisted JSONB or be re-broadcast.
 * A single in-place walk that deletes the dangerous own keys; no deep clone is performed.
 * Throws if the payload nests deeper than MAX_SYNC_DATA_DEPTH.
 */
const stripReservedKeys = (value: unknown, seen = new WeakSet<object>(), depth = 0): void => {
  if (value === null || typeof value !== 'object') {
    return;
  }
  if (depth > MAX_SYNC_DATA_DEPTH) {
    throw new Error('Sync record data exceeds the maximum allowed nesting depth');
  }
  if (seen.has(value)) {
    return;
  }
  seen.add(value);

  if (Array.isArray(value)) {
    for (const item of value) {
      stripReservedKeys(item, seen, depth + 1);
    }
    return;
  }

  for (const reservedKey of RESERVED_OBJECT_KEYS) {
    if (Object.prototype.hasOwnProperty.call(value, reservedKey)) {
      delete (value as Record<string, unknown>)[reservedKey];
    }
  }
  for (const nestedValue of Object.values(value)) {
    stripReservedKeys(nestedValue, seen, depth + 1);
  }
};

const SyncRecordKeySchema = z
  .string()
  .max(MAX_SYNC_KEY_LENGTH, { message: `Sync record key exceeds the maximum length of ${MAX_SYNC_KEY_LENGTH}` })
  .refine((key) => !RESERVED_OBJECT_KEYS.includes(key), { message: 'Sync record key uses a reserved name' });

const SyncRecordDataSchema = z.record(z.string(), z.unknown()).transform((data, ctx) => {
  try {
    stripReservedKeys(data);
  } catch {
    // Surface the depth-cap breach as a normal Zod validation issue (clean 400) rather than a
    // raw thrown Error that would bubble out of the transform as an unhandled 500.
    ctx.addIssue('Sync record data exceeds the maximum allowed nesting depth');
    return z.NEVER;
  }
  if (JSON.stringify(data).length > MAX_SYNC_RECORD_DATA_LENGTH) {
    ctx.addIssue(`Sync record data exceeds the maximum serialized size of ${MAX_SYNC_RECORD_DATA_LENGTH}`);
    return z.NEVER;
  }
  return data;
});

/**
 * Adds the per-request caps to an array schema of sync records: the record count and the total
 * serialized size of the request. Applied to the raw array before the per-record schema runs so an
 * oversized request is rejected without validating every element first.
 */
export const withSyncPushLimits = <TSchema extends z.ZodType>(recordsSchema: TSchema) =>
  z
    .array(recordsSchema)
    .max(MAX_SYNC_RECORDS_PER_PUSH, { message: `Cannot sync more than ${MAX_SYNC_RECORDS_PER_PUSH} records at a time` })
    .refine((records) => JSON.stringify(records).length <= MAX_SYNC_PUSH_LENGTH, {
      message: `Sync push exceeds the maximum serialized size of ${MAX_SYNC_PUSH_LENGTH}`,
    });

export const SyncTypeSchema = z.enum(['query_history', 'load_saved_mapping', 'recent_history_item', 'api_request_history']);
export type SyncType = z.infer<typeof SyncTypeSchema>;

export const EntitySyncStatusSchema = z.object({
  entity: SyncTypeSchema,
  updatedAt: DateTimeSchema,
  enabled: z.boolean(),
  error: z.string().nullish(),
});
export type EntitySyncStatus = z.infer<typeof EntitySyncStatusSchema>;

export const SyncRecordOperationBaseSchema = z.object({
  key: SyncRecordKeySchema,
  // hashedKey is a SHA-1 hex digest of the key; the DB column is char(40). Validate the shape so an
  // over-long or malformed value is rejected with a clean validation error instead of aborting the
  // insert transaction.
  hashedKey: z.string().regex(/^[0-9a-f]{40}$/, { message: 'hashedKey must be a 40 character lowercase hex string' }),
  entity: SyncTypeSchema,
  data: SyncRecordDataSchema,
});

export const SyncRecordOperationCreateUpdateSchema = SyncRecordOperationBaseSchema.extend({
  type: z.enum(['create', 'update']),
  orgId: z.string().max(255).nullish(),
  createdAt: DateTimeSchema,
  updatedAt: DateTimeSchema,
});
export type SyncRecordOperationCreateUpdate = z.infer<typeof SyncRecordOperationCreateUpdateSchema>;

export const SyncRecordOperationDeleteSchema = SyncRecordOperationBaseSchema.extend({
  type: z.literal('delete'),
  deletedAt: DateTimeSchema,
});
export type SyncRecordOperationDelete = z.infer<typeof SyncRecordOperationDeleteSchema>;

export const SyncRecordOperationSchema = z.discriminatedUnion('type', [
  SyncRecordOperationCreateUpdateSchema,
  SyncRecordOperationDeleteSchema,
]);
export type SyncRecordOperation = z.infer<typeof SyncRecordOperationSchema>;

// TODO: discriminated union on entity for data
// TODO: have a browser and server version - createdAt is a server managed prop
export const SyncRecordSchema = z.object({
  key: z.string(),
  hashedKey: z.string(),
  // We are a little loose here to allow for future expansion and not break backwards compatibility
  // since browser extensions can become out-dated, we need to account for that
  entity: z.union([SyncTypeSchema, z.string()]),
  orgId: z.string().nullish(),
  data: z.record(z.string(), z.unknown()),
  createdAt: DateTimeSchema,
  updatedAt: DateTimeSchema,
  deletedAt: DateTimeSchema.nullish(),
});
export type SyncRecord = z.infer<typeof SyncRecordSchema>;

export const PullResponseSchema = z.object({
  records: SyncRecordSchema.array(),
  hasMore: z.boolean(),
  updatedAt: DateTimeSchema,
  lastKey: z.string().nullish(),
});
export type PullResponse = z.infer<typeof PullResponseSchema>;

export type SyncableRecord = QueryHistoryItem | LoadSavedMappingItem | RecentHistoryItem;

export interface QueryHistoryItem {
  key: `qh_${string}`; // org:object:(lowercase/removespaces(soql))
  hashedKey: string;
  org: string;
  sObject: string;
  label: string;
  customLabel?: Maybe<string>;
  soql: string;
  lastRun: Date;
  createdAt: Date;
  updatedAt: Date;
  runCount: number;
  isTooling: boolean;
  isFavorite: boolean;
  /** Set in a hook, no need to set */
  isFavoriteIdx?: 'true' | 'false';
}

export interface QueryHistoryObject {
  key: string; // org:object:isTooling
  org: string;
  sObject: string;
  sObjectLabel: string;
  isTooling: string;
}

export interface LoadSavedMappingItem {
  key: `lsm_${string}`; // object:csvFieldLength:createdAt
  hashedKey: string;
  name: string;
  sobject: string;
  csvFields: string[];
  sobjectFields: string[];
  mapping: SavedFieldMapping;
  createdAt: Date;
  updatedAt: Date;
}

export type RecentHistoryItemType = 'sobject';

export interface RecentHistoryItem {
  key: `ri_${string}:${RecentHistoryItemType}`;
  hashedKey: string;
  org: string;
  items: { name: string; lastUsed: Date }[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * NOTE: this could contain sensitive information, so we do not want to sync to server
 */
export interface ApiHistoryItem {
  key: `api_${string}`; // org:method:url
  hashedKey: string;
  org: string;
  label: string;
  lastRun: Date;
  isFavorite: 'true' | 'false';
  request: SalesforceApiHistoryRequest;
  response: SalesforceApiHistoryResponse;
  createdAt: Date;
  updatedAt: Date;
}
export type ApiHistoryBodyType = 'JSON' | 'TEXT';
