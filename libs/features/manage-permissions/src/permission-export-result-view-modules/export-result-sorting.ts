import type { FieldExportDetail, PermissionExportRow, SobjectExportDetail } from './export-result-types-labels';
import {
  buildPermissionSetIdLabelMap,
  fieldExportDetailLookupKey,
  fieldPermissionQualifiedFieldShortApi,
} from './export-result-types-labels';

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
 * Sorts `FieldPermissions` export rows: profile-owned parents first, then permission sets, then object (label),
 * then field (label when {@link fieldExportDetails} has it, else qualified `Field`).
 */
export function sortFieldPermissionExportRowsForAnalysisTree(
  fieldPermissionRows: PermissionExportRow[],
  permissionSetRows: PermissionExportRow[],
  sobjectExportDetails?: Readonly<Record<string, SobjectExportDetail>>,
  fieldExportDetails?: Readonly<Record<string, FieldExportDetail>>,
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

  function fieldSortCompareKey(row: PermissionExportRow): string {
    const obj = typeof row.SobjectType === 'string' ? row.SobjectType.trim() : '';
    const full = typeof row.Field === 'string' ? row.Field.trim() : '';
    const short = fieldPermissionQualifiedFieldShortApi(row);
    const lookupKey = obj && short ? fieldExportDetailLookupKey(obj, short) : '';
    const detail = lookupKey ? fieldExportDetails?.[lookupKey] : undefined;
    const label = detail?.label?.trim() ? detail.label.trim() : short || full;
    const primary = label.toLocaleLowerCase();
    const secondary = full.toLocaleLowerCase();
    return `${primary}\0${secondary}`;
  }

  return [...fieldPermissionRows].sort((rowA, rowB) => {
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
    const objCmp = objectSortCompareKey(objA).localeCompare(objectSortCompareKey(objB), undefined, { sensitivity: 'base' });
    if (objCmp !== 0) {
      return objCmp;
    }
    return fieldSortCompareKey(rowA).localeCompare(fieldSortCompareKey(rowB), undefined, { sensitivity: 'base' });
  });
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
