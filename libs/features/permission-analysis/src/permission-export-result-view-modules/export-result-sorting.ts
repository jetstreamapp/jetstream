import type { PermissionExportRow, SobjectExportDetail } from './export-result-types-labels';
import { buildPermissionSetIdLabelMap, fieldPermissionQualifiedFieldShortApi } from './export-result-types-labels';

function isProfileOwnedPermissionSetRow(row: PermissionExportRow | undefined): boolean {
  return row?.IsOwnedByProfile === true;
}

/**
 * Sorts `ObjectPermissions` export rows for the analysis tree: profile-owned parents first (label order),
 * then other permission sets (label order), then rows for the same parent by object label (metadata label
 * when {@link sobjectExportDetails} has it, else `SobjectType` API name).
 */
export function sortObjectPermissionExportRowsForAnalysisTree(
  objectPermissionRows: PermissionExportRow[],
  permissionSetRows: PermissionExportRow[],
  sobjectExportDetails?: Readonly<Record<string, SobjectExportDetail>>,
): PermissionExportRow[] {
  const labelByParentId = buildPermissionSetIdLabelMap(permissionSetRows);
  const permissionSetById = new Map<string, PermissionExportRow>();
  for (const row of permissionSetRows) {
    const id = typeof row.Id === 'string' ? row.Id.trim() : '';
    if (id) {
      permissionSetById.set(id, row);
    }
  }

  function parentTier(parentId: string): number {
    if (!parentId) {
      return 2;
    }
    return isProfileOwnedPermissionSetRow(permissionSetById.get(parentId)) ? 0 : 1;
  }

  function parentLabelCompareKey(parentId: string): string {
    return labelByParentId.get(parentId) ?? parentId;
  }

  function objectSortCompareKey(sobjectType: string): string {
    const api = sobjectType.trim();
    if (!api) {
      return '';
    }
    const detail = sobjectExportDetails?.[api];
    const label = detail?.label?.trim() ? detail.label.trim() : api;
    const primary = label.toLocaleLowerCase();
    const secondary = api.toLocaleLowerCase();
    return `${primary}\0${secondary}`;
  }

  return [...objectPermissionRows].sort((rowA, rowB) => {
    const parentA = typeof rowA.ParentId === 'string' ? rowA.ParentId.trim() : '';
    const parentB = typeof rowB.ParentId === 'string' ? rowB.ParentId.trim() : '';
    if (parentA !== parentB) {
      const tierA = parentTier(parentA);
      const tierB = parentTier(parentB);
      if (tierA !== tierB) {
        return tierA - tierB;
      }
      const labelCmp = parentLabelCompareKey(parentA).localeCompare(parentLabelCompareKey(parentB), undefined, {
        sensitivity: 'base',
      });
      if (labelCmp !== 0) {
        return labelCmp;
      }
      return parentA.localeCompare(parentB, undefined, { sensitivity: 'base' });
    }
    const objA = typeof rowA.SobjectType === 'string' ? rowA.SobjectType.trim() : '';
    const objB = typeof rowB.SobjectType === 'string' ? rowB.SobjectType.trim() : '';
    return objectSortCompareKey(objA).localeCompare(objectSortCompareKey(objB), undefined, { sensitivity: 'base' });
  });
}

/**
 * Sorts `FieldPermissions` export rows: profile-owned parents first, then permission sets (by parent label
 * from the export rows themselves), then object by `SobjectType` API name, then field by qualified `Field`.
 *
 * Sort keys are derived from row data only (no metadata) so the resulting order is stable across async
 * label loads — async metadata responses update displayed labels in cells but never trigger a re-sort.
 *
 * Uses a decorate-sort-undecorate (Schwartzian) pattern — sort keys are computed once per row
 * (O(N) trims/lookups/lowercases) and the comparator only compares primitives.
 */
export function sortFieldPermissionExportRowsForAnalysisTree(
  fieldPermissionRows: PermissionExportRow[],
  permissionSetRows: PermissionExportRow[],
): PermissionExportRow[] {
  const labelByParentId = buildPermissionSetIdLabelMap(permissionSetRows);
  const permissionSetById = new Map<string, PermissionExportRow>();
  for (const row of permissionSetRows) {
    const id = typeof row.Id === 'string' ? row.Id : '';
    if (id) {
      permissionSetById.set(id, row);
    }
  }

  const collator = new Intl.Collator(undefined, { sensitivity: 'base' });

  interface DecoratedRow {
    row: PermissionExportRow;
    tier: number;
    parentId: string;
    parentLabel: string;
    objKey: string;
    fieldKey: string;
  }

  const decorated: DecoratedRow[] = new Array(fieldPermissionRows.length);
  for (let i = 0; i < fieldPermissionRows.length; i++) {
    const row = fieldPermissionRows[i];
    const parentId = typeof row.ParentId === 'string' ? row.ParentId : '';
    const tier = !parentId ? 2 : isProfileOwnedPermissionSetRow(permissionSetById.get(parentId)) ? 0 : 1;
    const parentLabel = (labelByParentId.get(parentId) ?? parentId).toLocaleLowerCase();

    const sobjectType = typeof row.SobjectType === 'string' ? row.SobjectType : '';
    const objKey = sobjectType.toLocaleLowerCase();

    const fieldFull = typeof row.Field === 'string' ? row.Field : '';
    const fieldShort = fieldPermissionQualifiedFieldShortApi(row);
    const fieldKey = (fieldShort || fieldFull).toLocaleLowerCase();

    decorated[i] = { row, tier, parentId, parentLabel, objKey, fieldKey };
  }

  decorated.sort((a, b) => {
    if (a.parentId !== b.parentId) {
      if (a.tier !== b.tier) {
        return a.tier - b.tier;
      }
      const labelCmp = collator.compare(a.parentLabel, b.parentLabel);
      if (labelCmp !== 0) {
        return labelCmp;
      }
      return collator.compare(a.parentId, b.parentId);
    }
    const objCmp = collator.compare(a.objKey, b.objKey);
    if (objCmp !== 0) {
      return objCmp;
    }
    return collator.compare(a.fieldKey, b.fieldKey);
  });

  const sorted: PermissionExportRow[] = new Array(decorated.length);
  for (let i = 0; i < decorated.length; i++) {
    sorted[i] = decorated[i].row;
  }
  return sorted;
}

/**
 * User-facing copy for `PermissionSetTabSetting.Visibility` on analysis grids.
 */
export function formatTabSettingVisibilityDisplay(value: unknown): string {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (raw === 'DefaultOn') {
    return 'Visible';
  }
  if (raw === 'DefaultOff') {
    return 'Hidden';
  }
  if (raw.length === 0) {
    return '—';
  }
  return raw;
}

/**
 * Sorts `PermissionSetTabSetting` export rows for the analysis tree: profile-owned parents first (label order),
 * then other permission sets (label order), then by tab display label (or {@link Name}) within the same {@link ParentId}.
 *
 * @param tabLabelBySettingName Optional `TabDefinition.Name` → `Label` map from Tooling (enriches sort when loaded).
 */
export function sortTabSettingExportRowsForAnalysisTree(
  tabSettingRows: PermissionExportRow[],
  permissionSetRows: PermissionExportRow[],
  tabLabelBySettingName?: ReadonlyMap<string, string>,
): PermissionExportRow[] {
  const labelByParentId = buildPermissionSetIdLabelMap(permissionSetRows);
  const permissionSetById = new Map<string, PermissionExportRow>();
  for (const row of permissionSetRows) {
    const id = typeof row.Id === 'string' ? row.Id.trim() : '';
    if (id) {
      permissionSetById.set(id, row);
    }
  }

  function parentTier(parentId: string): number {
    if (!parentId) {
      return 2;
    }
    return isProfileOwnedPermissionSetRow(permissionSetById.get(parentId)) ? 0 : 1;
  }

  function parentLabelCompareKey(parentId: string): string {
    return labelByParentId.get(parentId) ?? parentId;
  }

  function tabSortCompareKey(row: PermissionExportRow): string {
    const name = typeof row.Name === 'string' ? row.Name.trim() : '';
    const label = tabLabelBySettingName?.get(name)?.trim();
    const primary = (label && label.length > 0 ? label : name).toLocaleLowerCase();
    const secondary = name.toLocaleLowerCase();
    return `${primary}\0${secondary}`;
  }

  return [...tabSettingRows].sort((rowA, rowB) => {
    const parentA = typeof rowA.ParentId === 'string' ? rowA.ParentId.trim() : '';
    const parentB = typeof rowB.ParentId === 'string' ? rowB.ParentId.trim() : '';
    if (parentA !== parentB) {
      const tierA = parentTier(parentA);
      const tierB = parentTier(parentB);
      if (tierA !== tierB) {
        return tierA - tierB;
      }
      const labelCmp = parentLabelCompareKey(parentA).localeCompare(parentLabelCompareKey(parentB), undefined, {
        sensitivity: 'base',
      });
      if (labelCmp !== 0) {
        return labelCmp;
      }
      return parentA.localeCompare(parentB, undefined, { sensitivity: 'base' });
    }
    const keyA = tabSortCompareKey(rowA);
    const keyB = tabSortCompareKey(rowB);
    return keyA.localeCompare(keyB, undefined, { sensitivity: 'base' });
  });
}
