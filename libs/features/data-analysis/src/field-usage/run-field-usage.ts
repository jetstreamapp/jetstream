import { describeSObject, queryWithRecordBudget } from '@jetstream/shared/data';
import type { DescribeSObjectResult, Field, SalesforceOrgUi } from '@jetstream/types';
import { composeQuery, getField } from '@jetstreamapp/soql-parser-js';

/** Aligns with permission export row budget intent — keeps long runs bounded per object. */
export const FIELD_USAGE_MAX_ROWS_PER_OBJECT = 100_000;

/**
 * Hard cap used when {@link RunFieldUsageOptions.loadFullScan} is true. Keeps the worst case
 * bounded even in the browser; the previous server-side `Number.MAX_SAFE_INTEGER` would have
 * permitted billion-row scans which is hostile UX.
 */
export const FIELD_USAGE_FULL_SCAN_ROW_BUDGET = 5_000_000;

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
      autoNumber: boolean;
      calculatedFormula?: string | null;
      externalId: boolean;
      nameField: boolean;
      extraTypeInfo?: string | null;
      length: number;
      precision?: number | null;
      scale: number;
      referenceTo?: string[] | null;
      relationshipName?: string | null;
      digits?: number | null;
      /** Present on some describe payloads for auto-number fields (pattern like `ANN-{0000}`). */
      displayFormat?: string | null;
    }
  >;
  error?: string;
}

export interface FieldUsageProgress {
  current: number;
  total: number;
  percent: number;
  label: string;
}

export interface RunFieldUsageOptions {
  /** When true, lift the per-object row cap to {@link FIELD_USAGE_FULL_SCAN_ROW_BUDGET}. */
  loadFullScan?: boolean;
  onProgress?: (progress: FieldUsageProgress) => void;
  isCanceled?: () => boolean;
}

export interface RunFieldUsageQueryResult {
  objects: Record<string, FieldUsageObjectPayload>;
  failedObjects: string[];
  anyQueryTruncated: boolean;
}

function fieldIsQueryable(field: Field): boolean {
  const queryable = (field as unknown as { queryable?: boolean }).queryable;
  return queryable !== false;
}

function getCountableFields(describe: DescribeSObjectResult): Field[] {
  return describe.fields.filter((field) => {
    if (field.type === 'address') {
      return false;
    }
    if (!field.name || field.name === 'Id' || field.name === 'LastModifiedDate') {
      return false;
    }
    return fieldIsQueryable(field);
  });
}

function buildFieldUsageSoql(objectApiName: string, fieldNames: string[]): string {
  return composeQuery({
    fields: [getField('Id'), getField('LastModifiedDate'), ...fieldNames.map((name) => getField(name))],
    sObject: objectApiName,
    // Deterministic order so that when a wide object is split into multiple field-chunks AND the scan is
    // truncated at the row budget, every chunk scans the SAME first N rows. Without this, each chunk could
    // sample a different (arbitrary) subset, making per-field percentages inconsistent within one object.
    orderBy: { field: 'Id', order: 'ASC' },
  });
}

/**
 * Splits a list of field names into chunks whose composed SELECT clause fits within the SOQL URL limit.
 * Uses a manual character count instead of re-composing the SOQL per candidate field (which made the
 * previous implementation O(N²) in composeQuery calls for wide objects).
 */
function buildFieldChunks(fieldNames: string[], objectApiName: string): string[][] {
  // Mirror composeQuery output: `SELECT Id, LastModifiedDate, <fields> FROM <object>`.
  // Each appended field contributes `, <name>` to the SELECT clause.
  const baselineLength = `SELECT Id, LastModifiedDate FROM ${objectApiName}`.length;
  const chunks: string[][] = [];
  let current: string[] = [];
  let currentLength = baselineLength;

  for (const name of fieldNames) {
    const addedLength = name.length + 2;
    if (current.length > 0 && currentLength + addedLength > TARGET_SELECT_CLAUSE_CHARS) {
      chunks.push(current);
      current = [];
      currentLength = baselineLength;
    }
    current.push(name);
    currentLength += addedLength;
  }
  if (current.length > 0) {
    chunks.push(current);
  }
  return chunks;
}

function mergeSfDatetimeMax(left: string | null, right: string | null): string | null {
  if (!right) {
    return left;
  }
  if (!left) {
    return right;
  }
  return left.localeCompare(right) >= 0 ? left : right;
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

function buildFieldMeta(countable: Field[]): FieldUsageObjectPayload['fieldMeta'] {
  const fieldMeta: FieldUsageObjectPayload['fieldMeta'] = {};
  for (const field of countable) {
    const describeFieldExtras = field as Field & { displayFormat?: string | null };
    fieldMeta[field.name] = {
      label: field.label,
      calculated: field.calculated,
      type: field.type,
      custom: field.custom,
      autoNumber: field.autoNumber,
      calculatedFormula: field.calculatedFormula ?? null,
      externalId: field.externalId,
      nameField: field.nameField,
      extraTypeInfo: field.extraTypeInfo ?? null,
      length: field.length,
      precision: field.precision ?? null,
      scale: field.scale,
      referenceTo: field.referenceTo ?? null,
      relationshipName: field.relationshipName ?? null,
      digits: field.digits ?? null,
      displayFormat: describeFieldExtras.displayFormat ?? null,
    };
  }
  return fieldMeta;
}

function throwIfCanceled(isCanceled?: () => boolean): void {
  if (isCanceled?.()) {
    throw new Error('Job canceled');
  }
}

/**
 * Wide SOQL field usage with streaming aggregation: counts filled values per field without
 * retaining records in memory. Memory stays O(fields × objects) regardless of row volume.
 */
export async function runFieldUsageQueryForObjects(
  org: SalesforceOrgUi,
  objectApiNames: string[],
  options?: RunFieldUsageOptions,
): Promise<RunFieldUsageQueryResult> {
  const objects: Record<string, FieldUsageObjectPayload> = {};
  const failedObjects: string[] = [];
  let anyQueryTruncated = false;
  const rowBudget = options?.loadFullScan === true ? FIELD_USAGE_FULL_SCAN_ROW_BUDGET : FIELD_USAGE_MAX_ROWS_PER_OBJECT;
  const totalObjects = objectApiNames.length;

  for (let objectIndex = 0; objectIndex < totalObjects; objectIndex++) {
    const objectApiName = objectApiNames[objectIndex];
    throwIfCanceled(options?.isCanceled);

    const currentProgress = objectIndex + 1;
    options?.onProgress?.({
      current: currentProgress,
      total: totalObjects,
      percent: totalObjects > 0 ? (currentProgress / totalObjects) * 100 : 0,
      label: `Analyzing ${objectApiName} (${currentProgress} of ${totalObjects})`,
    });

    try {
      const describeResponse = await describeSObject(org, objectApiName);
      const describe = describeResponse.data;

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
      const names = countable.map((field) => field.name);
      const fieldMeta = buildFieldMeta(countable);

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

      const filled: Record<string, number> = Object.fromEntries(names.map((name) => [name, 0]));
      const maxLmdWhenFilled: Record<string, string | null> = Object.fromEntries(names.map((name) => [name, null]));
      let totalRecords = 0;
      let queryTruncated = false;
      const chunks = buildFieldChunks(names, objectApiName);

      for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
        throwIfCanceled(options?.isCanceled);

        const chunkNames = chunks[chunkIndex];
        const soql = buildFieldUsageSoql(objectApiName, chunkNames);
        const budget = { remaining: rowBudget };
        let chunkRecordCount = 0;

        const { truncated } = await queryWithRecordBudget<Record<string, unknown>>(org, soql, false, budget, (records) => {
          for (const record of records) {
            chunkRecordCount += 1;
            const lmdRaw = record.LastModifiedDate;
            const lmd = typeof lmdRaw === 'string' ? lmdRaw : null;
            for (const fieldName of chunkNames) {
              const value = record[fieldName];
              if (isFilledValue(value)) {
                filled[fieldName] += 1;
                if (lmd) {
                  maxLmdWhenFilled[fieldName] = mergeSfDatetimeMax(maxLmdWhenFilled[fieldName], lmd);
                }
              }
            }
          }
        });

        if (truncated) {
          queryTruncated = true;
          anyQueryTruncated = true;
        }

        if (chunkIndex === 0) {
          totalRecords = chunkRecordCount;
        }
      }

      const fieldUsage: Record<string, FieldUsageStat> = {};
      for (const name of names) {
        const filledCount = filled[name] ?? 0;
        fieldUsage[name] = {
          filled: filledCount,
          pct: totalRecords > 0 ? (filledCount / totalRecords) * 100 : 0,
          latestFilledRowModified: maxLmdWhenFilled[name] ?? null,
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
      if (ex instanceof Error && ex.message === 'Job canceled') {
        throw ex;
      }
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
