import type {
  ParsedPermissionExportResult,
  PermissionAnalysisFinding,
  PermissionExportBundle,
  PermissionExportRequestScope,
  PermissionExportRow,
} from './export-result-types-labels';

export function collectSobjectApiNamesFromPermissionExport(exportBundle: PermissionExportBundle): string[] {
  const names = new Set<string>();
  for (const row of exportBundle.objectPermissions) {
    const value = row.SobjectType;
    if (typeof value === 'string' && value.trim().length > 0) {
      names.add(value.trim());
    }
  }
  for (const row of exportBundle.fieldPermissions) {
    const value = row.SobjectType;
    if (typeof value === 'string' && value.trim().length > 0) {
      names.add(value.trim());
    }
  }
  return [...names].sort((a, b) => a.localeCompare(b));
}

/**
 * Unique tab API names from `PermissionSetTabSetting` rows (for Tooling `TabDefinition` enrichment).
 */
export function collectTabSettingNamesFromPermissionExport(exportBundle: PermissionExportBundle): string[] {
  const names = new Set<string>();
  for (const row of exportBundle.permissionSetTabSettings) {
    const value = row.Name;
    if (typeof value === 'string' && value.trim().length > 0) {
      names.add(value.trim());
    }
  }
  return [...names].sort((a, b) => a.localeCompare(b));
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function stringIdArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((id): id is string => typeof id === 'string');
}

export function parsePermissionExportRequestScope(jobResult: unknown): PermissionExportRequestScope {
  const root = asRecord(jobResult);
  if (!root) {
    return { profilePermissionSetIds: [], permissionSetIds: [], objectApiNames: [] };
  }
  const payload = asRecord(root.requestPayload);
  if (!payload) {
    return { profilePermissionSetIds: [], permissionSetIds: [], objectApiNames: [] };
  }
  return {
    profilePermissionSetIds: stringIdArray(payload.profileIds),
    permissionSetIds: stringIdArray(payload.permissionSetIds),
    objectApiNames: stringIdArray(payload.objectApiNames),
  };
}

export function filterPermissionSetExportRowsById(
  rows: PermissionExportRow[],
  permissionSetIds: ReadonlySet<string>,
): PermissionExportRow[] {
  if (permissionSetIds.size === 0) {
    return [];
  }
  return rows.filter((row) => typeof row.Id === 'string' && permissionSetIds.has(row.Id));
}

function asRowArray(value: unknown): PermissionExportRow[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((row): row is PermissionExportRow => row !== null && typeof row === 'object' && !Array.isArray(row));
}

/**
 * Normalizes `analysis_job.result` JSON for permission export jobs.
 */
export function parsePermissionExportResult(jobResult: unknown): ParsedPermissionExportResult | null {
  const root = asRecord(jobResult);
  if (!root) {
    return null;
  }

  const exportBlock = asRecord(root.export);
  if (!exportBlock) {
    return null;
  }

  const countsRaw = asRecord(root.counts);
  const counts: Record<string, number> = {};
  if (countsRaw) {
    for (const [key, value] of Object.entries(countsRaw)) {
      if (typeof value === 'number' && Number.isFinite(value)) {
        counts[key] = value;
      }
    }
  }

  const findingsRaw = root.findings;
  const findings: PermissionAnalysisFinding[] = Array.isArray(findingsRaw)
    ? findingsRaw.filter((item): item is PermissionAnalysisFinding => item !== null && typeof item === 'object')
    : [];

  return {
    phase: root.phase != null ? String(root.phase) : null,
    summary: root.summary != null ? String(root.summary) : null,
    truncated: Boolean(root.truncated),
    counts,
    export: {
      permissionSets: asRowArray(exportBlock.permissionSets),
      permissionSetAssignments: asRowArray(exportBlock.permissionSetAssignments),
      permissionSetGroups: asRowArray(exportBlock.permissionSetGroups),
      permissionSetGroupComponents: asRowArray(exportBlock.permissionSetGroupComponents),
      mutingPermissionSets: asRowArray(exportBlock.mutingPermissionSets),
      objectPermissions: asRowArray(exportBlock.objectPermissions),
      fieldPermissions: asRowArray(exportBlock.fieldPermissions),
      permissionSetTabSettings: asRowArray(exportBlock.permissionSetTabSettings),
    },
    findings,
    issueCodeSummary:
      root.issueCodeSummary != null && typeof root.issueCodeSummary === 'object' && !Array.isArray(root.issueCodeSummary)
        ? (root.issueCodeSummary as Record<string, unknown>)
        : null,
  };
}
