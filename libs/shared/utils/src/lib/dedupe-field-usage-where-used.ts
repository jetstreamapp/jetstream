/**
 * Tooling `MetadataComponentDependency` often returns multiple rows for the same logical Flow
 * (e.g. FlowDefinition plus Flow, or several Flow rows with version suffixes).
 * We collapse those to one row per automation for counts and drill-down.
 */

const FLOW_DEDUPE_METADATA_TYPES = new Set(['Flow', 'FlowDefinition']);

export interface FieldUsageWhereUsedRowKind {
  type: string;
  name: string;
  kind: 'automation' | 'apex' | 'layout' | 'other';
}

function kindSortOrder(kind: FieldUsageWhereUsedRowKind['kind']): number {
  if (kind === 'automation') {
    return 0;
  }
  if (kind === 'apex') {
    return 1;
  }
  if (kind === 'layout') {
    return 2;
  }
  return 3;
}

/**
 * Normalizes Flow metadata names so `My_Flow` and `My_Flow-3` share one key.
 * Heuristic: trailing `-\d+` is treated as a version suffix (common in Tooling names).
 */
export function flowLikeAutomationDedupeKey(metadataComponentName: string): string {
  return metadataComponentName.trim().replace(/-\d+$/, '');
}

function flowNameLooksVersioned(metadataComponentName: string): boolean {
  return /-\d+$/.test(metadataComponentName.trim());
}

function preferFlowLikeRow<T extends FieldUsageWhereUsedRowKind>(a: T, b: T): T {
  const at = a.type.trim();
  const bt = b.type.trim();
  if (at === 'FlowDefinition' && bt !== 'FlowDefinition') {
    return a;
  }
  if (bt === 'FlowDefinition' && at !== 'FlowDefinition') {
    return b;
  }
  const aVersioned = flowNameLooksVersioned(a.name);
  const bVersioned = flowNameLooksVersioned(b.name);
  if (aVersioned !== bVersioned) {
    return aVersioned ? b : a;
  }
  const an = (a.name || '').trim();
  const bn = (b.name || '').trim();
  return an.toLowerCase().localeCompare(bn.toLowerCase()) <= 0 ? a : b;
}

/**
 * Drops duplicate Flow / FlowDefinition rows that refer to the same logical flow.
 * Other automation types (triggers, workflow, process) are left as returned by Tooling.
 */
export function dedupeFieldUsageWhereUsedRows<T extends FieldUsageWhereUsedRowKind>(rows: T[]): T[] {
  const flowLike = new Map<string, T>();
  const rest: T[] = [];

  for (const row of rows) {
    if (row.kind !== 'automation') {
      rest.push(row);
      continue;
    }
    const t = row.type.trim();
    if (!FLOW_DEDUPE_METADATA_TYPES.has(t)) {
      rest.push(row);
      continue;
    }
    const key = flowLikeAutomationDedupeKey(row.name);
    const existing = flowLike.get(key);
    if (!existing) {
      flowLike.set(key, row);
    } else {
      flowLike.set(key, preferFlowLikeRow(row, existing));
    }
  }

  return [...rest, ...flowLike.values()];
}

/**
 * Same ordering as field-usage Tooling dependency lists (kind, then type, then name).
 */
export function sortFieldUsageWhereUsedRows<T extends FieldUsageWhereUsedRowKind>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const ka = kindSortOrder(a.kind);
    const kb = kindSortOrder(b.kind);
    if (ka !== kb) {
      return ka - kb;
    }
    return (
      (a.type || '').toLowerCase().localeCompare((b.type || '').toLowerCase()) ||
      (a.name || '').toLowerCase().localeCompare((b.name || '').toLowerCase())
    );
  });
}
