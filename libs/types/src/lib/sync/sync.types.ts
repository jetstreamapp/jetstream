import { parseISO } from 'date-fns/parseISO';
import { z } from 'zod';
import { Maybe } from '../types';
import { SavedFieldMapping } from '../ui/load-records-types';
import {
  ApexHistoryItem,
  SalesforceApiHistoryItem,
  SalesforceApiHistoryRequest,
  SalesforceApiHistoryResponse,
  SalesforceDeployHistoryItem,
} from '../ui/types';

const DateTimeSchema = z.union([z.string(), z.date()]).transform((val) => (val instanceof Date ? val : parseISO(val)));

/**
 * Reserved object keys that can corrupt prototype-based lookups (prototype pollution).
 * The sync `key` is attacker-controlled and is used to build plain-object lookup maps on the
 * server, while the `data` payload is persisted to JSONB and re-broadcast to other clients.
 * Legit client keys are prefixed (qh_/lsm_/ri_/api_), so none of these are valid sync keys.
 */
const RESERVED_OBJECT_KEYS = ['__proto__', 'constructor', 'prototype'];

/**
 * Recursively strip dangerous own keys (__proto__/constructor/prototype) from an object/array
 * at any depth so a nested `__proto__` cannot survive into persisted JSONB or be re-broadcast.
 * A single in-place walk that deletes the dangerous own keys; no deep clone is performed.
 */
const stripReservedKeys = (value: unknown, seen = new WeakSet<object>()): void => {
  if (value === null || typeof value !== 'object') {
    return;
  }
  if (seen.has(value)) {
    return;
  }
  seen.add(value);

  if (Array.isArray(value)) {
    for (const item of value) {
      stripReservedKeys(item, seen);
    }
    return;
  }

  for (const reservedKey of RESERVED_OBJECT_KEYS) {
    if (Object.prototype.hasOwnProperty.call(value, reservedKey)) {
      delete (value as Record<string, unknown>)[reservedKey];
    }
  }
  for (const nestedValue of Object.values(value)) {
    stripReservedKeys(nestedValue, seen);
  }
};

const SyncRecordKeySchema = z
  .string()
  .refine((key) => !RESERVED_OBJECT_KEYS.includes(key), { message: 'Sync record key uses a reserved name' });

const SyncRecordDataSchema = z.record(z.string(), z.unknown()).transform((data) => {
  stripReservedKeys(data);
  return data;
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
  hashedKey: z.string(),
  entity: SyncTypeSchema,
  data: SyncRecordDataSchema,
});

export const SyncRecordOperationCreateUpdateSchema = SyncRecordOperationBaseSchema.extend({
  type: z.enum(['create', 'update']),
  orgId: z.string().nullish(),
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

/**
 * CLIENT DATA EXPORT / IMPORT
 *
 * Envelope used by the Settings "Export / Import History" feature so users can back up and restore
 * their browser-stored history. Covers both the Dexie synced tables and the localforage local-only
 * datasets. Deploy history is included as metadata only (the binary package files are intentionally
 * excluded to keep the file small).
 */
export const CLIENT_DATA_EXPORT_VERSION = 1;
export const CLIENT_DATA_EXPORT_APP = 'jetstream';

/**
 * Minimal recent-record shape. The source type lives in ui-core; it is redeclared here to keep the
 * types lib (and ui-db) decoupled from feature libraries.
 */
export interface ClientDataExportRecentRecord {
  recordId: string;
  sobject: string;
  name?: Maybe<string>;
}

export interface ClientDataExportData {
  query_history: QueryHistoryItem[];
  load_saved_mapping: LoadSavedMappingItem[];
  recent_history_item: RecentHistoryItem[];
  api_request_history: ApiHistoryItem[];
  apex_history: Record<string, ApexHistoryItem>;
  salesforce_api_history: Record<string, SalesforceApiHistoryItem>;
  deploy_history: SalesforceDeployHistoryItem[];
  recent_records: Record<string, ClientDataExportRecentRecord[]>;
}

export interface ClientDataExportEnvelope {
  version: number;
  app: typeof CLIENT_DATA_EXPORT_APP;
  exportedAt: string;
  data: ClientDataExportData;
}

/**
 * Permissive item schemas: revive known `Date` fields and pass the rest through (`catchall`) so adding
 * fields later does not break importing older/newer files. Indexed/derived fields (`hashedKey`,
 * `isFavoriteIdx`) are recomputed on import and are intentionally NOT trusted from the file.
 */
const QueryHistoryItemImportSchema = z
  .object({ key: z.string(), lastRun: DateTimeSchema, createdAt: DateTimeSchema, updatedAt: DateTimeSchema })
  .catchall(z.unknown());

const LoadSavedMappingItemImportSchema = z
  .object({ key: z.string(), createdAt: DateTimeSchema, updatedAt: DateTimeSchema })
  .catchall(z.unknown());

const RecentHistoryItemImportSchema = z
  .object({
    key: z.string(),
    items: z.array(z.object({ name: z.string(), lastUsed: DateTimeSchema }).catchall(z.unknown())).default([]),
    createdAt: DateTimeSchema,
    updatedAt: DateTimeSchema,
  })
  .catchall(z.unknown());

const ApiHistoryItemImportSchema = z
  .object({ key: z.string(), lastRun: DateTimeSchema, createdAt: DateTimeSchema, updatedAt: DateTimeSchema })
  .catchall(z.unknown());

const ApexHistoryItemImportSchema = z.object({ key: z.string(), lastRun: DateTimeSchema }).catchall(z.unknown());

const SalesforceApiHistoryItemImportSchema = z.object({ key: z.string(), lastRun: DateTimeSchema }).catchall(z.unknown());

const DeployHistoryItemImportSchema = z.object({ key: z.string(), start: DateTimeSchema, finish: DateTimeSchema }).catchall(z.unknown());

const RecentRecordImportSchema = z.object({ recordId: z.string(), sobject: z.string(), name: z.string().nullish() }).catchall(z.unknown());

export const ClientDataExportEnvelopeSchema = z
  .object({
    version: z.number(),
    app: z.literal(CLIENT_DATA_EXPORT_APP),
    exportedAt: z.string(),
    // Each section defaults to empty, so a file missing a section still imports; `data` itself is required.
    data: z.object({
      query_history: z.array(QueryHistoryItemImportSchema).default([]),
      load_saved_mapping: z.array(LoadSavedMappingItemImportSchema).default([]),
      recent_history_item: z.array(RecentHistoryItemImportSchema).default([]),
      api_request_history: z.array(ApiHistoryItemImportSchema).default([]),
      apex_history: z.record(z.string(), ApexHistoryItemImportSchema).default({}),
      salesforce_api_history: z.record(z.string(), SalesforceApiHistoryItemImportSchema).default({}),
      deploy_history: z.array(DeployHistoryItemImportSchema).default([]),
      recent_records: z.record(z.string(), z.array(RecentRecordImportSchema)).default({}),
    }),
  })
  .transform((envelope) => {
    // Defense-in-depth: drop dangerous own keys (__proto__/constructor/prototype) anywhere in the
    // imported payload before it is merged into the prototype-based localforage lookup maps.
    stripReservedKeys(envelope.data);
    return envelope;
  });
