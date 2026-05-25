import { z } from 'zod';

/**
 * Schemas + inferred types for client-side analysis jobs (permission_export and field_usage).
 *
 * Jobs run entirely in the browser via the JobWorker pattern and persist their results in Dexie
 * (`analysis_job_history` table) as gzip-compressed blobs. The legacy split between a small
 * `result` JSONB column and a heavy `resultData` JSONB column on the server is gone; everything
 * is stored as a single merged shape per (org, jobType) row.
 */

export const analysisJobTypeSchema = z.enum(['permission_export', 'field_usage']);
export type AnalysisJobType = z.infer<typeof analysisJobTypeSchema>;

export const analysisJobRequestPayloadSchema = z.record(z.string(), z.unknown());
export type AnalysisJobRequestPayload = z.infer<typeof analysisJobRequestPayloadSchema>;

export const analysisJobIssueCodeSummaryEntrySchema = z.object({
  count: z.number(),
  errors: z.number(),
  warnings: z.number(),
});
export type AnalysisJobIssueCodeSummaryEntry = z.infer<typeof analysisJobIssueCodeSummaryEntrySchema>;

export const analysisJobFindingRecordSchema = z.record(z.string(), z.unknown());
export type AnalysisJobFindingRecord = z.infer<typeof analysisJobFindingRecordSchema>;

export const permissionExportJobCountsSchema = z.object({
  permissionSets: z.number(),
  permissionSetAssignments: z.number(),
  permissionSetGroups: z.number(),
  permissionSetGroupComponents: z.number(),
  mutingPermissionSets: z.number(),
  objectPermissions: z.number(),
  fieldPermissions: z.number(),
  permissionSetTabSettings: z.number(),
});
export type PermissionExportJobCounts = z.infer<typeof permissionExportJobCountsSchema>;

/**
 * Small "metadata" portion of a permission_export result — the summary, counts, findings, etc.
 *
 * NOTE: The existing client-side parser `parsePermissionExportResult` reads heavy export rows from
 * `result.export.*`. The Dexie row stores the merged shape (see `permissionExportFullResultSchema`
 * below), and the view code reshapes back to `{ ...summary, export: { permissionSets, ... } }` for
 * the parser. Parser migration is scheduled for Wave 5.
 */
export const permissionExportJobResultSchema = z.object({
  requestPayload: analysisJobRequestPayloadSchema.optional(),
  phase: z.literal('permission_export_v1'),
  summary: z.string(),
  truncated: z.boolean(),
  counts: permissionExportJobCountsSchema,
  findings: z.array(analysisJobFindingRecordSchema),
  issueCodeSummary: z.record(z.string(), analysisJobIssueCodeSummaryEntrySchema),
});
export type PermissionExportJobResult = z.infer<typeof permissionExportJobResultSchema>;

/** Heavy export rows produced by the permission_export job. */
export const permissionExportJobResultDataSchema = z.object({
  permissionSets: z.array(z.record(z.string(), z.unknown())),
  permissionSetAssignments: z.array(z.record(z.string(), z.unknown())),
  permissionSetGroups: z.array(z.record(z.string(), z.unknown())),
  permissionSetGroupComponents: z.array(z.record(z.string(), z.unknown())),
  mutingPermissionSets: z.array(z.record(z.string(), z.unknown())),
  objectPermissions: z.array(z.record(z.string(), z.unknown())),
  fieldPermissions: z.array(z.record(z.string(), z.unknown())),
  permissionSetTabSettings: z.array(z.record(z.string(), z.unknown())),
});
export type PermissionExportJobResultData = z.infer<typeof permissionExportJobResultDataSchema>;

/** Full permission_export result as stored in Dexie — small metadata + heavy export rows in one shape. */
export const permissionExportFullResultSchema = permissionExportJobResultSchema.merge(permissionExportJobResultDataSchema);
export type PermissionExportFullResult = z.infer<typeof permissionExportFullResultSchema>;

export const fieldUsageJobResultSchema = z.object({
  requestPayload: analysisJobRequestPayloadSchema.optional(),
  phase: z.literal('field_usage_v1'),
  summary: z.string(),
  truncated: z.boolean(),
  failedObjects: z.array(z.string()),
});
export type FieldUsageJobResult = z.infer<typeof fieldUsageJobResultSchema>;

export const fieldUsageJobResultDataSchema = z.object({
  /** Keyed by sobject API name. Value shape matches the per-object payload produced by the field-usage runner. */
  objects: z.record(z.string(), z.record(z.string(), z.unknown())),
  /** Tooling dependency rows keyed by `ObjectApi.FieldApi`. */
  whereUsed: z.record(z.string(), z.array(z.record(z.string(), z.unknown()))),
});
export type FieldUsageJobResultData = z.infer<typeof fieldUsageJobResultDataSchema>;

/** Full field_usage result as stored in Dexie — small metadata + heavy object/whereUsed maps in one shape. */
export const fieldUsageFullResultSchema = fieldUsageJobResultSchema.merge(fieldUsageJobResultDataSchema);
export type FieldUsageFullResult = z.infer<typeof fieldUsageFullResultSchema>;

/**
 * Dexie row shape for `analysis_job_history`. Stores the gzip-compressed JSON blob of the full
 * result (decoded lazily when a view loads). `running` is intentionally absent from `status` —
 * in-flight job state lives in jotai, not Dexie.
 */
export const analysisJobHistoryItemSchema = z.object({
  key: z.string(),
  org: z.string(),
  jobType: analysisJobTypeSchema,
  status: z.enum(['completed', 'failed']),
  requestPayload: analysisJobRequestPayloadSchema.optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
  errorMessage: z.string().nullable(),
  pinned: z.boolean().default(false),
  summary: z.string().nullable(),
  resultBlob: z.instanceof(Uint8Array).nullable(),
  resultBlobSize: z.number().default(0),
});
export type AnalysisJobHistoryItem = z.infer<typeof analysisJobHistoryItemSchema>;
