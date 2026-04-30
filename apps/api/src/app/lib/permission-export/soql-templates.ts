/**
 * SOQL templates for permission export (Data API).
 * Keep in sync with `libs/features/manage-permissions/src/permission-export/soql/*.soql` for reviewers.
 */

export function buildPermissionSetByIdSoql(formattedIds: string): string {
  return `
SELECT Id, Name, Label, IsOwnedByProfile, ProfileId, NamespacePrefix
FROM PermissionSet
WHERE Id IN (${formattedIds})
`.trim();
}

export function buildObjectPermissionsByParentSoql(formattedParentIds: string): string {
  return `
SELECT Id, ParentId, SobjectType,
  PermissionsRead, PermissionsCreate, PermissionsEdit, PermissionsDelete,
  PermissionsViewAllRecords, PermissionsModifyAllRecords, PermissionsViewAllFields
FROM ObjectPermissions
WHERE ParentId IN (${formattedParentIds})
`.trim();
}

export function buildFieldPermissionsByParentSoql(formattedParentIds: string): string {
  return `
SELECT Id, ParentId, SobjectType, Field,
  PermissionsRead, PermissionsEdit
FROM FieldPermissions
WHERE ParentId IN (${formattedParentIds})
`.trim();
}

export function buildTabSettingsByParentSoql(formattedParentIds: string): string {
  return `
SELECT Id, ParentId, Name, Visibility
FROM PermissionSetTabSetting
WHERE ParentId IN (${formattedParentIds})
`.trim();
}
