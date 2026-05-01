import type { Field, FieldType } from '@jetstream/types';
import { polyfillFieldDefinition } from '@jetstream/shared/ui-utils';

export interface FieldUsageStatParsed {
  filled: number;
  pct: number;
  latestFilledRowModified: string | null;
}

export interface FieldUsageFieldMetaParsed {
  label: string;
  calculated: boolean;
  /** Salesforce describe API `type` (e.g. `string`, `reference`). */
  type: string;
  custom: boolean;
  /** Present on newer job results; used with {@link getFieldUsageTypeLabel}. */
  autoNumber?: boolean;
  calculatedFormula?: string | null;
  externalId?: boolean;
  nameField?: boolean;
  extraTypeInfo?: string | null;
  length?: number;
  precision?: number | null;
  scale?: number;
  referenceTo?: string[] | null;
  relationshipName?: string | null;
  digits?: number | null;
  /** Auto-number display pattern when describe provides it. */
  displayFormat?: string | null;
}

export interface FieldUsageObjectPayloadParsed {
  label: string;
  customizable: boolean;
  totalRecords: number;
  queryTruncated: boolean;
  fieldUsage: Record<string, FieldUsageStatParsed>;
  fieldMeta: Record<string, FieldUsageFieldMetaParsed>;
  error?: string;
}

export interface WhereUsedDependencyRowParsed {
  type: string;
  name: string;
  kind: 'automation' | 'other';
}

export type WhereUsedMapParsed = Record<string, WhereUsedDependencyRowParsed[]>;

export interface FieldUsageJobResultParsed {
  phase: 'field_usage_v1';
  summary: string;
  truncated: boolean;
  objects: Record<string, FieldUsageObjectPayloadParsed>;
  whereUsed: WhereUsedMapParsed;
  failedObjects: string[];
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function parseFieldUsageStat(value: unknown): FieldUsageStatParsed | null {
  const rec = asRecord(value);
  if (!rec) {
    return null;
  }
  const filled = rec.filled;
  const pct = rec.pct;
  const latest = rec.latestFilledRowModified;
  if (typeof filled !== 'number' || typeof pct !== 'number') {
    return null;
  }
  return {
    filled,
    pct,
    latestFilledRowModified: latest == null || latest === '' ? null : String(latest),
  };
}

function parseOptionalNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && !Number.isNaN(value)) {
    return value;
  }
  return undefined;
}

function parseOptionalNumberOrNull(value: unknown): number | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  if (typeof value === 'number' && !Number.isNaN(value)) {
    return value;
  }
  return undefined;
}

function parseReferenceTo(value: unknown): string[] | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  if (!Array.isArray(value)) {
    return undefined;
  }
  return value.filter((entry): entry is string => typeof entry === 'string');
}

function parseFieldMetaEntry(value: unknown): FieldUsageFieldMetaParsed | null {
  const rec = asRecord(value);
  if (!rec) {
    return null;
  }
  const label = rec.label != null ? String(rec.label) : '';
  const type = rec.type != null ? String(rec.type) : '';
  return {
    label,
    calculated: rec.calculated === true,
    type,
    custom: rec.custom === true,
    ...(rec.autoNumber === true || rec.autoNumber === false ? { autoNumber: rec.autoNumber === true } : {}),
    ...(rec.calculatedFormula !== undefined
      ? { calculatedFormula: rec.calculatedFormula == null ? null : String(rec.calculatedFormula) }
      : {}),
    ...(rec.externalId === true || rec.externalId === false ? { externalId: rec.externalId === true } : {}),
    ...(rec.nameField === true || rec.nameField === false ? { nameField: rec.nameField === true } : {}),
    ...(rec.extraTypeInfo !== undefined ? { extraTypeInfo: rec.extraTypeInfo == null ? null : String(rec.extraTypeInfo) } : {}),
    ...(parseOptionalNumber(rec.length) !== undefined ? { length: parseOptionalNumber(rec.length) } : {}),
    ...(parseOptionalNumberOrNull(rec.precision) !== undefined ? { precision: parseOptionalNumberOrNull(rec.precision) } : {}),
    ...(parseOptionalNumber(rec.scale) !== undefined ? { scale: parseOptionalNumber(rec.scale) } : {}),
    ...(parseReferenceTo(rec.referenceTo) !== undefined ? { referenceTo: parseReferenceTo(rec.referenceTo) } : {}),
    ...(rec.relationshipName !== undefined ? { relationshipName: rec.relationshipName == null ? null : String(rec.relationshipName) } : {}),
    ...(parseOptionalNumberOrNull(rec.digits) !== undefined ? { digits: parseOptionalNumberOrNull(rec.digits) } : {}),
    ...(rec.displayFormat !== undefined ? { displayFormat: rec.displayFormat == null ? null : String(rec.displayFormat) } : {}),
  };
}

function parseObjectPayload(value: unknown): FieldUsageObjectPayloadParsed | null {
  const rec = asRecord(value);
  if (!rec) {
    return null;
  }
  const fieldUsageRaw = asRecord(rec.fieldUsage);
  const fieldMetaRaw = asRecord(rec.fieldMeta);
  if (!fieldUsageRaw || !fieldMetaRaw) {
    return null;
  }
  const fieldUsage: Record<string, FieldUsageStatParsed> = {};
  for (const [fieldName, stat] of Object.entries(fieldUsageRaw)) {
    const parsed = parseFieldUsageStat(stat);
    if (parsed) {
      fieldUsage[fieldName] = parsed;
    }
  }
  const fieldMeta: Record<string, FieldUsageFieldMetaParsed> = {};
  for (const [fieldName, meta] of Object.entries(fieldMetaRaw)) {
    const parsed = parseFieldMetaEntry(meta);
    if (parsed) {
      fieldMeta[fieldName] = parsed;
    }
  }
  const totalRecords = rec.totalRecords;
  return {
    label: rec.label != null ? String(rec.label) : '',
    customizable: rec.customizable === true,
    totalRecords: typeof totalRecords === 'number' ? totalRecords : 0,
    queryTruncated: rec.queryTruncated === true,
    fieldUsage,
    fieldMeta,
    ...(typeof rec.error === 'string' && rec.error.trim() ? { error: rec.error } : {}),
  };
}

function parseWhereUsedMap(value: unknown): WhereUsedMapParsed {
  const rec = asRecord(value);
  if (!rec) {
    return {};
  }
  const out: WhereUsedMapParsed = {};
  for (const [fieldKey, rowsUnknown] of Object.entries(rec)) {
    if (!Array.isArray(rowsUnknown)) {
      continue;
    }
    const rows: WhereUsedDependencyRowParsed[] = [];
    for (const rowUnknown of rowsUnknown) {
      const row = asRecord(rowUnknown);
      if (!row) {
        continue;
      }
      const kind = row.kind === 'automation' || row.kind === 'other' ? row.kind : 'other';
      rows.push({
        type: row.type != null ? String(row.type) : '',
        name: row.name != null ? String(row.name) : '',
        kind,
      });
    }
    out[fieldKey] = rows;
  }
  return out;
}

function hasExtendedDescribeMeta(meta: FieldUsageFieldMetaParsed): boolean {
  return (
    meta.autoNumber !== undefined ||
    meta.calculatedFormula !== undefined ||
    meta.externalId !== undefined ||
    meta.nameField !== undefined ||
    meta.extraTypeInfo !== undefined ||
    meta.length !== undefined ||
    meta.precision !== undefined ||
    meta.scale !== undefined ||
    meta.referenceTo !== undefined ||
    meta.relationshipName !== undefined ||
    meta.digits !== undefined ||
    meta.displayFormat !== undefined
  );
}

function legacyApiTypeLabel(apiType: string): string {
  const normalized = apiType.toLowerCase();
  if (normalized === 'int' || normalized === 'double') {
    return 'Number';
  }
  if (!apiType) {
    return '';
  }
  return `${apiType[0].toUpperCase()}${apiType.slice(1)}`;
}

function isUsageReferenceLike(meta: FieldUsageFieldMetaParsed): boolean {
  const refs = meta.referenceTo?.filter((target) => target.trim().length > 0) ?? [];
  return (meta.type === 'reference' || meta.type === 'string') && !!meta.relationshipName && refs.length > 0;
}

function rewriteLookupLabelToReference(label: string): string {
  const lookupMatch = /^Lookup\s*\((.*)\)$/.exec(label.trim());
  if (lookupMatch) {
    return `Reference (${lookupMatch[1]})`;
  }
  return label;
}

/**
 * Human-readable field type for the field usage grid (based on {@link polyfillFieldDefinition}, with usage-specific wording).
 * References show as `Reference (Account, …)`; integers read as Number; auto-number includes format when available.
 */
export function getFieldUsageTypeLabel(meta: FieldUsageFieldMetaParsed | undefined): string {
  if (!meta?.type) {
    return '';
  }
  if (!hasExtendedDescribeMeta(meta)) {
    return legacyApiTypeLabel(meta.type);
  }

  if (meta.autoNumber) {
    const formatPattern = meta.displayFormat?.trim();
    if (formatPattern) {
      return `Auto Number (${formatPattern})`;
    }
    if (meta.digits != null && meta.digits > 0) {
      return `Auto Number (${meta.digits} digit${meta.digits === 1 ? '' : 's'} max)`;
    }
    return 'Auto Number';
  }

  if (isUsageReferenceLike(meta)) {
    const targets = (meta.referenceTo ?? []).join(', ');
    return `Reference (${targets})`;
  }

  const textareaDefaultPlain =
    meta.type === 'textarea' && (meta.extraTypeInfo == null || meta.extraTypeInfo === '') ? ('plaintextarea' as const) : meta.extraTypeInfo;

  const partial = {
    autoNumber: false,
    type: meta.type as FieldType,
    calculated: meta.calculated,
    calculatedFormula: meta.calculatedFormula ?? null,
    externalId: meta.externalId ?? false,
    nameField: meta.nameField ?? false,
    extraTypeInfo: textareaDefaultPlain ?? null,
    length: meta.length ?? 0,
    precision: meta.precision ?? null,
    scale: meta.scale ?? 0,
    referenceTo: meta.referenceTo ?? null,
    relationshipName: meta.relationshipName ?? null,
  } as Field;

  return rewriteLookupLabelToReference(polyfillFieldDefinition(partial));
}

/**
 * Parses `analysis_job.result` for completed **field_usage** jobs (`phase: field_usage_v1`).
 *
 * @param result JSON value stored on the analysis job row.
 * @returns Parsed envelope or `null` when shape does not match.
 */
export function parseFieldUsageJobResult(result: unknown): FieldUsageJobResultParsed | null {
  const rec = asRecord(result);
  if (!rec || rec.phase !== 'field_usage_v1') {
    return null;
  }
  const objectsRaw = asRecord(rec.objects);
  if (!objectsRaw) {
    return null;
  }
  const objects: Record<string, FieldUsageObjectPayloadParsed> = {};
  for (const [apiName, payloadUnknown] of Object.entries(objectsRaw)) {
    const parsed = parseObjectPayload(payloadUnknown);
    if (parsed) {
      objects[apiName] = parsed;
    }
  }
  const failedRaw = rec.failedObjects;
  const failedObjects = Array.isArray(failedRaw) ? failedRaw.filter((entry): entry is string => typeof entry === 'string') : [];

  return {
    phase: 'field_usage_v1',
    summary: rec.summary != null ? String(rec.summary) : '',
    truncated: rec.truncated === true,
    objects,
    whereUsed: parseWhereUsedMap(rec.whereUsed),
    failedObjects,
  };
}
