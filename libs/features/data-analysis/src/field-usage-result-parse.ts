export interface FieldUsageStatParsed {
  filled: number;
  pct: number;
  latestFilledRowModified: string | null;
}

export interface FieldUsageFieldMetaParsed {
  label: string;
  calculated: boolean;
  type: string;
  custom: boolean;
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
