import { logger } from '@jetstream/shared/client-logger';
import { describeSObject, query, queryWithRecordBudget } from '@jetstream/shared/data';
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
  /**
   * Records scanned for THIS field's chunk. Equals the object's `totalRecords` for non-truncated
   * scans, but is tracked per-chunk so `pct = filled / scanned` is always internally consistent
   * (avoids `filled > totalRecords` when row counts drift between sequential chunk queries).
   */
  scanned: number;
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
      /** Describe `aggregatable` — whether the field supports SOQL aggregate functions (COUNT, etc.). */
      aggregatable?: boolean;
      /**
       * Describe `defaultedOnCreate` — the field is populated by Salesforce on every insert. A high fill
       * rate may be default-driven rather than real usage; surfaced so admins don't read it as "used".
       */
      defaultedOnCreate?: boolean;
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

/**
 * Compound and blob types excluded from the scan:
 * - `address` / `location` are compound fields; SELECTing them is awkward and their components are
 *   separate fields, so the compound itself yields no useful fill signal.
 * - `base64` (blob, e.g. `Attachment.Body`) returns large payloads — selecting it across up to millions
 *   of rows is a serious payload/performance hazard and has no cleanup value.
 */
const UNCOUNTABLE_FIELD_TYPES = new Set(['address', 'location', 'base64']);

function getCountableFields(describe: DescribeSObjectResult): Field[] {
  return describe.fields.filter((field) => {
    if (UNCOUNTABLE_FIELD_TYPES.has(field.type)) {
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

/**
 * Whether a value counts as "filled" for usage purposes, given the field's describe type.
 *
 * Boolean (checkbox) fields are never null in SOQL results — they are always `true` or `false` — so
 * counting any non-null value would make every checkbox read ~100% filled and hide genuinely-unused
 * (all-`false`) checkboxes. For booleans we therefore count only `true` ("how often is it checked").
 */
function isFilledValue(value: unknown, fieldType: string): boolean {
  if (value === null || value === undefined) {
    return false;
  }
  if (fieldType === 'boolean') {
    return value === true || value === 'true';
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
      aggregatable: field.aggregatable,
      defaultedOnCreate: field.defaultedOnCreate,
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
 * Fields counted with a server-side SOQL aggregate (`COUNT(field)`): exact, full-object, no row transfer.
 * Booleans are excluded — `COUNT(checkbox)` counts both true and false (always ~100%), so they go through
 * the row scan where we count only `true`. Non-aggregatable types (long text, rich text, encrypted,
 * base64, compound) cannot be aggregated and also fall back to the scan.
 */
function fieldSupportsCountAggregate(field: Field): boolean {
  return field.aggregatable === true && field.type !== 'boolean';
}

/** Splits COUNT fields into chunks whose composed SELECT clause stays under {@link TARGET_SELECT_CLAUSE_CHARS}. */
function buildCountFieldChunks(fieldNames: string[], objectApiName: string): string[][] {
  const baselineLength = `SELECT COUNT(Id) total FROM ${objectApiName}`.length;
  const chunks: string[][] = [];
  let current: string[] = [];
  let currentLength = baselineLength;
  for (let index = 0; index < fieldNames.length; index++) {
    const name = fieldNames[index];
    // `, COUNT(<name>) c<index>` — pad the alias allowance generously so we never overshoot the URL limit.
    const addedLength = name.length + 16;
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

interface CountFieldUsageResult {
  filled: Record<string, number>;
  total: number;
  /** Fields whose aggregate query failed (timeout/limit) and must fall back to a row scan. */
  failedFields: string[];
}

/**
 * Exact per-field filled counts via `SELECT COUNT(Id) total, COUNT(f0) c0, … FROM Object`. Each chunk
 * returns a single aggregate row across the ENTIRE object — no truncation, no record transfer. A chunk
 * that errors (e.g. query timeout on a very large object) has its fields returned in {@link failedFields}
 * so the caller can fall back to the bounded row scan.
 */
async function runCountForObject(
  org: SalesforceOrgUi,
  objectApiName: string,
  fieldNames: string[],
  isCanceled?: () => boolean,
): Promise<CountFieldUsageResult> {
  const filled: Record<string, number> = {};
  const failedFields: string[] = [];
  let total = 0;
  for (const chunk of buildCountFieldChunks(fieldNames, objectApiName)) {
    throwIfCanceled(isCanceled);
    const aliasPairs = chunk.map((name, index) => ({ name, alias: `c${index}` }));
    const soql = `SELECT COUNT(Id) total, ${aliasPairs.map(({ name, alias }) => `COUNT(${name}) ${alias}`).join(', ')} FROM ${objectApiName}`;
    try {
      const response = await query<Record<string, unknown>>(org, soql, false);
      const row = response.queryResults.records[0] ?? {};
      const rowTotal = Number(row.total);
      if (Number.isFinite(rowTotal)) {
        total = Math.max(total, rowTotal);
      }
      for (const { name, alias } of aliasPairs) {
        const count = Number(row[alias]);
        filled[name] = Number.isFinite(count) ? count : 0;
      }
    } catch (err) {
      logger.warn('field usage COUNT aggregate failed; falling back to row scan for these fields', { err, objectApiName });
      failedFields.push(...chunk);
    }
  }
  return { filled, total, failedFields };
}

interface ScanFieldUsageResult {
  filled: Record<string, number>;
  scannedByField: Record<string, number>;
  maxLmd: Record<string, string | null>;
  truncated: boolean;
  /** Rows scanned by the first chunk — the object-level "records scanned" when no COUNT total is available. */
  scanTotal: number;
}

/**
 * Streaming row scan for fields that cannot use COUNT (booleans, long text, encrypted, …). Counts filled
 * values per field without retaining records; bounded by {@link rowBudget}. Reused by the full-scan path.
 */
async function scanFieldUsage(
  org: SalesforceOrgUi,
  objectApiName: string,
  fieldNames: string[],
  typeByField: Record<string, string>,
  rowBudget: number,
  isCanceled?: () => boolean,
): Promise<ScanFieldUsageResult> {
  const filled: Record<string, number> = Object.fromEntries(fieldNames.map((name) => [name, 0]));
  const maxLmd: Record<string, string | null> = Object.fromEntries(fieldNames.map((name) => [name, null]));
  const scannedByField: Record<string, number> = Object.fromEntries(fieldNames.map((name) => [name, 0]));
  let truncated = false;
  let scanTotal = 0;
  const chunks = buildFieldChunks(fieldNames, objectApiName);

  for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
    throwIfCanceled(isCanceled);
    const chunkNames = chunks[chunkIndex];
    const soql = buildFieldUsageSoql(objectApiName, chunkNames);
    const budget = { remaining: rowBudget };
    let chunkRecordCount = 0;

    const result = await queryWithRecordBudget<Record<string, unknown>>(org, soql, false, budget, (records) => {
      for (const record of records) {
        chunkRecordCount += 1;
        const lmdRaw = record.LastModifiedDate;
        const lmd = typeof lmdRaw === 'string' ? lmdRaw : null;
        for (const fieldName of chunkNames) {
          if (isFilledValue(record[fieldName], typeByField[fieldName] ?? '')) {
            filled[fieldName] += 1;
            if (lmd) {
              maxLmd[fieldName] = mergeSfDatetimeMax(maxLmd[fieldName], lmd);
            }
          }
        }
      }
    });

    for (const fieldName of chunkNames) {
      scannedByField[fieldName] = chunkRecordCount;
    }
    if (result.truncated) {
      truncated = true;
    }
    if (chunkIndex === 0) {
      scanTotal = chunkRecordCount;
    }
  }

  return { filled, scannedByField, maxLmd, truncated, scanTotal };
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

      const typeByField: Record<string, string> = Object.fromEntries(countable.map((field) => [field.name, field.type]));
      const filled: Record<string, number> = {};
      const maxLmdWhenFilled: Record<string, string | null> = {};
      const scannedByField: Record<string, number> = {};
      let queryTruncated = false;
      let countTotal: number | null = null;

      // Fields that support an exact server-side COUNT aggregate vs those that need a bounded row scan.
      const countFieldNames = countable.filter(fieldSupportsCountAggregate).map((field) => field.name);
      const countFieldNameSet = new Set(countFieldNames);
      const scanFieldNames = names.filter((name) => !countFieldNameSet.has(name));
      const fallbackScanFieldNames: string[] = [];

      if (countFieldNames.length > 0) {
        const countResult = await runCountForObject(org, objectApiName, countFieldNames, options?.isCanceled);
        countTotal = countResult.total;
        const failed = new Set(countResult.failedFields);
        for (const name of countFieldNames) {
          if (failed.has(name)) {
            fallbackScanFieldNames.push(name);
            continue;
          }
          filled[name] = countResult.filled[name] ?? 0;
          // COUNT is computed across the whole object, so the denominator is the full record count and
          // there is no truncation. COUNT cannot report a per-field "latest modified", so it stays null.
          scannedByField[name] = countResult.total;
          maxLmdWhenFilled[name] = null;
        }
      }

      const allScanFieldNames = [...scanFieldNames, ...fallbackScanFieldNames];
      let scanTotal = 0;
      if (allScanFieldNames.length > 0) {
        const scanResult = await scanFieldUsage(org, objectApiName, allScanFieldNames, typeByField, rowBudget, options?.isCanceled);
        scanTotal = scanResult.scanTotal;
        for (const name of allScanFieldNames) {
          filled[name] = scanResult.filled[name] ?? 0;
          scannedByField[name] = scanResult.scannedByField[name] ?? 0;
          maxLmdWhenFilled[name] = scanResult.maxLmd[name] ?? null;
        }
        if (scanResult.truncated) {
          queryTruncated = true;
          anyQueryTruncated = true;
        }
      }

      // Object-level record count: prefer the exact COUNT total; otherwise the scanned count.
      const totalRecords = countTotal != null ? countTotal : scanTotal;

      const fieldUsage: Record<string, FieldUsageStat> = {};
      for (const name of names) {
        const filledCount = filled[name] ?? 0;
        const scanned = scannedByField[name] ?? 0;
        const rawPct = scanned > 0 ? (filledCount / scanned) * 100 : 0;
        fieldUsage[name] = {
          filled: filledCount,
          scanned,
          // Clamp defensively so display never shows >100% / <0% from any count drift.
          pct: Math.max(0, Math.min(100, rawPct)),
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
