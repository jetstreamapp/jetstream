import { parseISO } from 'date-fns/parseISO';
import { z } from 'zod';
import { Maybe } from '../types';
import { SavedFieldMapping } from '../ui/load-records-types';
import { SalesforceApiHistoryRequest, SalesforceApiHistoryResponse } from '../ui/types';

const DateTimeSchema = z.union([z.string(), z.date()]).transform((val) => (val instanceof Date ? val : parseISO(val)));

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
  key: z.string(),
  hashedKey: z.string(),
  entity: SyncTypeSchema,
  data: z.record(z.unknown()),
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
  data: z.record(z.unknown()),
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
