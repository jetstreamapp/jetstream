import {
  DirtyRow,
  PermissionSetNoProfileRecord,
  PermissionSetWithProfileRecord,
  PermissionTableFieldCell,
  PermissionTableFieldCellPermission,
  PermissionTableObjectCell,
  PermissionTableObjectCellPermission,
  PermissionTableSetupEntityAccessCell,
  PermissionTableSetupEntityAccessCellPermission,
  PermissionTableSystemPermissionCell,
  PermissionTableSystemPermissionCellPermission,
  PermissionTableTabVisibilityCell,
  PermissionTableTabVisibilityCellPermission,
} from '@jetstream/types';

/** One permission flag that is about to change, e.g. "Read" turning on */
export interface PermissionChangeFlag {
  label: string;
  /** The value that will be saved */
  enabled: boolean;
}

/** Every flag changing for one item on one profile or permission set */
export interface PermissionChange {
  key: string;
  itemLabel: string;
  /** Secondary text for the item, e.g. the API name */
  itemDetail?: string;
  parentId: string;
  parentLabel: string;
  parentType: 'Profile' | 'Permission Set';
  flags: PermissionChangeFlag[];
}

export interface PermissionChangeSection {
  key: string;
  /** Section heading, e.g. "Field Permissions" */
  title: string;
  /** Header for the item column, e.g. "Field" */
  itemHeader: string;
  changes: PermissionChange[];
}

export interface PermissionChangeSummaryInput {
  dirtyObjectRows: Record<string, DirtyRow<PermissionTableObjectCell>>;
  dirtyFieldRows: Record<string, DirtyRow<PermissionTableFieldCell>>;
  dirtyTabVisibilityRows: Record<string, DirtyRow<PermissionTableTabVisibilityCell>>;
  dirtySystemPermissionRows: Record<string, DirtyRow<PermissionTableSystemPermissionCell>>;
  /** One entry per setup entity access tab (custom permissions, ...) */
  dirtySetupEntityAccessRows: {
    title: string;
    itemHeader: string;
    dirtyRows: Record<string, DirtyRow<PermissionTableSetupEntityAccessCell>>;
  }[];
  profilesById: Record<string, PermissionSetWithProfileRecord>;
  permissionSetsById: Record<string, PermissionSetNoProfileRecord>;
}

const OBJECT_FLAGS: { key: 'create' | 'read' | 'edit' | 'delete' | 'viewAll' | 'modifyAll' | 'viewAllFields'; label: string }[] = [
  { key: 'create', label: 'Create' },
  { key: 'read', label: 'Read' },
  { key: 'edit', label: 'Edit' },
  { key: 'delete', label: 'Delete' },
  { key: 'viewAll', label: 'View All' },
  { key: 'modifyAll', label: 'Modify All' },
  { key: 'viewAllFields', label: 'View All Fields' },
];

/**
 * Turn the dirty rows of every tab into a readable list of what will be saved, grouped by tab. Only cells that
 * are actually dirty (and not read-only) are included, with just the flags that changed, so the user confirms
 * exactly what is sent to Salesforce.
 */
export function getPermissionChangeSections({
  dirtyObjectRows,
  dirtyFieldRows,
  dirtyTabVisibilityRows,
  dirtySystemPermissionRows,
  dirtySetupEntityAccessRows,
  profilesById,
  permissionSetsById,
}: PermissionChangeSummaryInput): PermissionChangeSection[] {
  function getParent(parentId: string): Pick<PermissionChange, 'parentId' | 'parentLabel' | 'parentType'> {
    const profile = profilesById[parentId];
    if (profile) {
      return { parentId, parentLabel: profile.Profile?.Name || parentId, parentType: 'Profile' };
    }
    return { parentId, parentLabel: permissionSetsById[parentId]?.Name || parentId, parentType: 'Permission Set' };
  }

  /** Walks every dirty cell of a tab and lets the caller describe the changed flags of each one */
  function collect<TPermission extends { isReadOnly: boolean }, TRow extends { key: string; permissions: Record<string, TPermission> }>(
    dirtyRows: Record<string, DirtyRow<TRow>>,
    describe: (row: TRow, permission: TPermission) => Pick<PermissionChange, 'itemLabel' | 'itemDetail' | 'flags'> | null,
  ): PermissionChange[] {
    return Object.values(dirtyRows).flatMap(({ row }) =>
      Object.entries(row.permissions).flatMap(([parentId, permission]) => {
        if (permission.isReadOnly) {
          return [];
        }
        const described = describe(row, permission);
        if (!described || !described.flags.length) {
          return [];
        }
        return [{ key: `${row.key}-${parentId}`, ...described, ...getParent(parentId) }];
      }),
    );
  }

  const sections: PermissionChangeSection[] = [
    {
      key: 'object',
      title: 'Object Permissions',
      itemHeader: 'Object',
      changes: collect<PermissionTableObjectCellPermission, PermissionTableObjectCell>(dirtyObjectRows, (row, permission) => ({
        itemLabel: row.sobject,
        flags: OBJECT_FLAGS.filter(({ key }) => permission[`${key}IsDirty`]).map(({ key, label }) => ({ label, enabled: permission[key] })),
      })),
    },
    {
      key: 'tabVisibility',
      title: 'Tab Visibility',
      itemHeader: 'Tab',
      changes: collect<PermissionTableTabVisibilityCellPermission, PermissionTableTabVisibilityCell>(
        dirtyTabVisibilityRows,
        (row, permission) => ({
          itemLabel: row.sobject,
          flags: [
            ...(permission.availableIsDirty ? [{ label: 'Available', enabled: permission.available }] : []),
            ...(permission.visibleIsDirty ? [{ label: 'Visible', enabled: permission.visible }] : []),
          ],
        }),
      ),
    },
    {
      key: 'field',
      title: 'Field Permissions',
      itemHeader: 'Field',
      changes: collect<PermissionTableFieldCellPermission, PermissionTableFieldCell>(dirtyFieldRows, (row, permission) => ({
        itemLabel: row.label,
        itemDetail: `${row.sobject}.${row.apiName}`,
        flags: [
          ...(permission.readIsDirty ? [{ label: 'Read', enabled: permission.read }] : []),
          ...(permission.editIsDirty ? [{ label: 'Edit', enabled: permission.edit }] : []),
        ],
      })),
    },
    {
      key: 'systemPermission',
      title: 'System Permissions',
      itemHeader: 'System Permission',
      changes: collect<PermissionTableSystemPermissionCellPermission, PermissionTableSystemPermissionCell>(
        dirtySystemPermissionRows,
        (row, permission) => ({
          itemLabel: row.label,
          itemDetail: row.apiName,
          flags: permission.enabledIsDirty ? [{ label: 'Enabled', enabled: permission.enabled }] : [],
        }),
      ),
    },
    ...dirtySetupEntityAccessRows.map(({ title, itemHeader, dirtyRows }, index) => ({
      key: `setupEntityAccess-${index}`,
      title,
      itemHeader,
      changes: collect<PermissionTableSetupEntityAccessCellPermission, PermissionTableSetupEntityAccessCell>(
        dirtyRows,
        (row, permission) => ({
          itemLabel: row.label,
          itemDetail: row.apiName,
          flags: permission.enabledIsDirty ? [{ label: 'Granted', enabled: permission.enabled }] : [],
        }),
      ),
    })),
  ];

  return sections.filter(({ changes }) => changes.length > 0);
}

/** Totals for the summary heading */
export function getPermissionChangeTotals(sections: PermissionChangeSection[]) {
  const profileIds = new Set<string>();
  const permissionSetIds = new Set<string>();
  let changeCount = 0;
  sections.forEach(({ changes }) => {
    changes.forEach(({ parentId, parentType }) => {
      changeCount++;
      if (parentType === 'Profile') {
        profileIds.add(parentId);
      } else {
        permissionSetIds.add(parentId);
      }
    });
  });
  return { changeCount, profileCount: profileIds.size, permissionSetCount: permissionSetIds.size };
}
