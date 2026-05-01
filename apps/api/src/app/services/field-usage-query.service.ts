import type { ApiConnection } from '@jetstream/salesforce-api';
import type { DescribeSObjectResult, Field } from '@jetstream/types';
import { queryWithRecordBudget } from '../lib/permission-export/query-with-record-budget';

/** Aligns with permission export row budget intent — keeps long runs bounded per object. */
export const FIELD_USAGE_MAX_ROWS_PER_OBJECT = 100_000;

/** Stay under typical REST SOQL URL limits; split field lists when SELECT grows large. */
const TARGET_SELECT_CLAUSE_CHARS = 9000;

export interface FieldUsageStat {
  filled: number;
  pct: number;
  latestFilledRowModified: string | null;
}

export interface FieldUsageObjectPayload {
  label: string;
  customizable: boolean;
  totalRecords: number;
  queryTruncated: boolean;
  fieldUsage: Record<string, FieldUsageStat>;
  fieldMeta: Record<
    string,
    {
      label: string;
      calculated: boolean;
      type: string;
      custom: boolean;
    }
  >;
  error?: string;
}

export interface FieldUsageQueryResult {
  objects: Record<string, FieldUsageObjectPayload>;
  anyQueryTruncated: boolean;
  failedObjects: string[];
}

function fieldIsQueryable(field: Field): boolean {
  const q = (field as unknown as { queryable?: boolean }).queryable;
  return q !== false;
}

function getCountableFields(describe: DescribeSObjectResult): Field[] {
  return describe.fields.filter((f) => {
    if (f.type === 'address') {
      return false;
    }
    if (!f.name || f.name === 'Id' || f.name === 'LastModifiedDate') {
      return false;
    }
    return fieldIsQueryable(f);
  });
}

function buildFieldChunks(fieldNames: string[], objectApiName: string): string[][] {
  const base = `SELECT Id,LastModifiedDate FROM ${objectApiName}`.length + 32;
  const chunks: string[][] = [];
  let current: string[] = [];
  let currentLen = base;

  for (const name of fieldNames) {
    const add = name.length + 1;
    if (current.length > 0 && currentLen + add > TARGET_SELECT_CLAUSE_CHARS) {
      chunks.push(current);
      current = [];
      currentLen = base;
    }
    current.push(name);
    currentLen += add;
  }
  if (current.length > 0) {
    chunks.push(current);
  }
  return chunks;
}

function mergeSfDatetimeMax(a: string | null, b: string | null): string | null {
  if (!b) {
    return a;
  }
  if (!a) {
    return b;
  }
  return a.localeCompare(b) >= 0 ? a : b;
}

function isFilledValue(value: unknown): boolean {
  if (value === null || value === undefined) {
    return false;
  }
  if (typeof value === 'string') {
    return value.trim() !== '';
  }
  return true;
}

/**
 * Wide SOQL field usage: paginated queries with optional chunked SELECT lists (SOQL length).
 */
export async function runFieldUsageQueryForObjects(
  conn: ApiConnection,
  objectApiNames: string[],
): Promise<FieldUsageQueryResult> {
  const objects: Record<string, FieldUsageObjectPayload> = {};
  const failedObjects: string[] = [];
  let anyQueryTruncated = false;

  for (const objectApiName of objectApiNames) {
    try {
      const describe = await conn.sobject.describeSobject(objectApiName, false);
      if (!describe.queryable) {
        objects[objectApiName] = {
          label: describe.label,
          customizable: describe.custom,
          totalRecords: 0,
          queryTruncated: false,
          fieldUsage: {},
          fieldMeta: {},
          error: 'Object is not queryable',
        };
        continue;
      }

      const countable = getCountableFields(describe);
      const names = countable.map((f) => f.name);
      const fieldMeta: FieldUsageObjectPayload['fieldMeta'] = {};
      for (const f of countable) {
        fieldMeta[f.name] = {
          label: f.label,
          calculated: f.calculated,
          type: f.type,
          custom: f.custom,
        };
      }

      if (names.length === 0) {
        objects[objectApiName] = {
          label: describe.label,
          customizable: describe.custom,
          totalRecords: 0,
          queryTruncated: false,
          fieldUsage: {},
          fieldMeta,
        };
        continue;
      }

      const filled: Record<string, number> = Object.fromEntries(names.map((n) => [n, 0]));
      const maxLmdWhenFilled: Record<string, string | null> = Object.fromEntries(names.map((n) => [n, null]));
      let totalRecords = 0;
      let queryTruncated = false;
      const chunks = buildFieldChunks(names, objectApiName);

      for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
        const chunkNames = chunks[chunkIndex];
        const selectClause = ['Id', 'LastModifiedDate', ...chunkNames].join(',');
        const soql = `SELECT ${selectClause} FROM ${objectApiName}`;
        const sink: Record<string, unknown>[] = [];
        const budget = { remaining: FIELD_USAGE_MAX_ROWS_PER_OBJECT };
        const { truncated } = await queryWithRecordBudget(conn, soql, budget, sink);
        if (truncated) {
          queryTruncated = true;
          anyQueryTruncated = true;
        }

        if (chunkIndex === 0) {
          totalRecords = sink.length;
        }

        for (const rec of sink) {
          const lmdRaw = rec.LastModifiedDate;
          const lmd = typeof lmdRaw === 'string' ? lmdRaw : null;
          for (const fn of chunkNames) {
            const val = rec[fn];
            if (isFilledValue(val)) {
              filled[fn] += 1;
              if (lmd) {
                maxLmdWhenFilled[fn] = mergeSfDatetimeMax(maxLmdWhenFilled[fn], lmd);
              }
            }
          }
        }
      }

      const fieldUsage: Record<string, FieldUsageStat> = {};
      for (const n of names) {
        const fr = filled[n] ?? 0;
        fieldUsage[n] = {
          filled: fr,
          pct: totalRecords > 0 ? (fr / totalRecords) * 100 : 0,
          latestFilledRowModified: maxLmdWhenFilled[n] ?? null,
        };
      }

      objects[objectApiName] = {
        label: describe.label,
        customizable: describe.custom,
        totalRecords,
        queryTruncated,
        fieldUsage,
        fieldMeta,
      };
    } catch (ex) {
      failedObjects.push(objectApiName);
      const message = ex instanceof Error ? ex.message : 'Unknown error';
      objects[objectApiName] = {
        label: objectApiName,
        customizable: false,
        totalRecords: 0,
        queryTruncated: false,
        fieldUsage: {},
        fieldMeta: {},
        error: message.slice(0, 500),
      };
    }
  }

  return { objects, anyQueryTruncated, failedObjects };
}
