import {
  EntityParticlePermissionsRecord,
  FieldPermissionRecord,
  ObjectPermissionRecord,
  RecordAttributes,
  RecordResult,
  SetupEntityAccessRecord,
  TabVisibilityPermissionRecord,
} from '../salesforce/record.types';
import { Maybe } from '../types';

export type PermissionType = 'object' | 'field' | 'tabVisibility' | 'systemPermission' | 'setupEntityAccess';
export type ObjectPermissionTypes = 'create' | 'read' | 'edit' | 'delete' | 'viewAll' | 'modifyAll' | 'viewAllFields';
export type FieldPermissionTypes = 'read' | 'edit';
export type TabVisibilityPermissionTypes = 'available' | 'visible';
export type SystemPermissionTypes = 'enabled';
export type SetupEntityAccessPermissionTypes = 'enabled';

export type PermissionTypes =
  | ObjectPermissionTypes
  | FieldPermissionTypes
  | TabVisibilityPermissionTypes
  | SystemPermissionTypes
  | SetupEntityAccessPermissionTypes;

/**
 * Setup entities whose access is granted to a profile or permission set through a `SetupEntityAccess` row.
 * Salesforce uses the same row shape for every type (`SetupEntityType` picklist on the object), so one tab
 * implementation covers all of them - each type only needs its own catalog query. Only custom permissions are
 * wired up today; Apex classes, Visualforce pages, apps, flows and custom metadata types are the natural next ones.
 */
export type SetupEntityAccessType = 'CustomPermission';

export type BulkActionCheckbox = {
  id: PermissionTypes;
  label: string;
  value: boolean;
  disabled: boolean;
};

export type PermissionDefinitionMap =
  | ObjectPermissionDefinitionMap
  | FieldPermissionDefinitionMap
  | TabVisibilityPermissionDefinitionMap
  | SystemPermissionDefinitionMap
  | SetupEntityAccessDefinitionMap;

export interface ObjectPermissionDefinitionMap {
  apiName: string;
  label: string;
  metadata: string; // FIXME: this should probably be Describe metadata
  /** False for objects that only support field-level security (PricebookEntry, Task, ...) */
  supportsObjectPermissions: boolean;
  // used to retain order of permissions
  permissionKeys: string[]; // this is permission set ids, which could apply to profile or perm set
  permissions: Record<string, ObjectPermissionItem>;
}

export interface ObjectPermissionItem {
  create: boolean;
  read: boolean;
  edit: boolean;
  delete: boolean;
  viewAll: boolean;
  modifyAll: boolean;
  viewAllFields: boolean;
  record?: Maybe<ObjectPermissionRecord>;
  errorMessage?: string;
  /**
   * True for permission sets installed from a managed package. Salesforce rejects any change to them, so
   * every edit path treats these as read-only and they are never included in a save.
   */
  isReadOnly: boolean;
}

/**
 * Field-metadata audit info sourced from the Tooling `CustomField` object.
 * Absent for standard fields - Salesforce does not track audit data for them.
 */
export interface FieldAuditMetadata {
  /** Raw ISO string - the column formats it for display */
  createdDate: string;
  createdBy: Maybe<string>;
  /** Raw ISO string - the column formats it for display */
  lastModifiedDate: string;
  lastModifiedBy: Maybe<string>;
}

export interface FieldPermissionDefinitionMap {
  apiName: string;
  label: string;
  metadata: EntityParticlePermissionsRecord;
  /** Undefined for standard fields, and for every field if the audit query failed */
  auditMetadata?: Maybe<FieldAuditMetadata>;
  // used to retain order of permissions
  permissionKeys: string[]; // this is permission set ids, which could apply to profile or perm set
  permissions: Record<string, FieldPermissionItem>;
}

export interface FieldPermissionItem {
  read: boolean;
  edit: boolean;
  record?: Maybe<FieldPermissionRecord>;
  errorMessage?: Maybe<string>;
  /**
   * True for permission sets installed from a managed package. Salesforce rejects any change to them, so
   * every edit path treats these as read-only and they are never included in a save.
   */
  isReadOnly: boolean;
}

export interface TabVisibilityPermissionDefinitionMap {
  apiName: string;
  label: string;
  metadata: string;
  /**
   * False if a tab does not exist for this object
   */
  canSetPermission: boolean;
  // used to retain order of permissions
  permissionKeys: string[]; // this is permission set ids, which could apply to profile or perm set
  permissions: Record<string, TabVisibilityPermissionItem>;
}

export interface TabVisibilityPermissionItem {
  available: boolean;
  visible: boolean;
  record?: Maybe<TabVisibilityPermissionRecord>;
  /**
   * False if a tab does not exist for this object
   * In which case, permissions cannot be set
   */
  canSetPermission: boolean;
  errorMessage?: string;
  /**
   * True for permission sets installed from a managed package. Salesforce rejects any change to them, so
   * every edit path treats these as read-only and they are never included in a save.
   */
  isReadOnly: boolean;
}

export interface SystemPermissionDefinitionMap {
  /** The `Permissions*` field API name on the PermissionSet object, e.x. `PermissionsApiEnabled` */
  apiName: string;
  /** Friendly label from the PermissionSet describe, e.x. `API Enabled` */
  label: string;
  // used to retain order of permissions
  permissionKeys: string[]; // this is permission set ids, which could apply to profile or perm set
  permissions: Record<string, SystemPermissionItem>;
}

export interface SystemPermissionItem {
  enabled: boolean;
  errorMessage?: Maybe<string>;
  /**
   * True for permission sets installed from a managed package. Salesforce rejects any change to them, so
   * every edit path treats these as read-only and they are never included in a save.
   */
  isReadOnly: boolean;
}

/**
 * One row per setup entity (e.g. one custom permission), with the access state for every selected
 * profile and permission set. Keyed in the map by `setupEntityId`.
 */
export interface SetupEntityAccessDefinitionMap {
  setupEntityType: SetupEntityAccessType;
  /** Id of the setup entity record, e.g. the `CustomPermission.Id`. This is `SetupEntityAccess.SetupEntityId`. */
  setupEntityId: string;
  /** Fully qualified API name, including the namespace prefix when the entity comes from a package */
  apiName: string;
  label: string;
  namespacePrefix?: Maybe<string>;
  description?: Maybe<string>;
  // used to retain order of permissions
  permissionKeys: string[]; // this is permission set ids, which could apply to profile or perm set
  permissions: Record<string, SetupEntityAccessItem>;
}

export interface SetupEntityAccessItem {
  /** True when a `SetupEntityAccess` row exists for this parent */
  enabled: boolean;
  record?: Maybe<SetupEntityAccessRecord>;
  errorMessage?: Maybe<string>;
  /**
   * True for permission sets installed from a managed package. Salesforce rejects any change to them, so
   * every edit path treats these as read-only and they are never included in a save.
   */
  isReadOnly: boolean;
}

export interface ObjectPermissionRecordForSave extends Omit<ObjectPermissionRecord, 'Id' | 'Parent'> {
  attributes: Partial<RecordAttributes>;
  Id?: Maybe<string>;
}

export interface FieldPermissionRecordForSave extends Omit<FieldPermissionRecord, 'Id' | 'Parent'> {
  attributes: Partial<RecordAttributes>;
  Id?: string;
}

export interface TabVisibilityPermissionRecordForSave extends Pick<TabVisibilityPermissionRecord, 'Visibility'> {
  attributes: Partial<RecordAttributes>;
  Id?: string;
  Name?: string;
  ParentId?: string;
}

/**
 * `SetupEntityAccess` has no updateable fields: access is granted by inserting a row and revoked by deleting it.
 */
export interface SetupEntityAccessRecordForSave {
  attributes: Partial<RecordAttributes>;
  ParentId: string;
  SetupEntityId: string;
}

/**
 * A single PermissionSet record update carrying the changed `Permissions*` boolean fields.
 * System permissions live directly on the PermissionSet record, so we only ever `update` (never
 * insert/delete) and many changed permissions collapse into one record per parent (permission set id).
 */
export interface SystemPermissionRecordForSave {
  attributes: Partial<RecordAttributes>;
  Id: string;
  [permissionField: string]: boolean | string | Partial<RecordAttributes>;
}

export interface PermissionSaveResults<RecordType, DirtyPermType> {
  dirtyPermission: DirtyPermType;
  dirtyPermissionIdx: number;
  operation: 'insert' | 'update' | 'delete';
  record?: RecordType;
  recordIdx: number;
  response?: Maybe<RecordResult>;
}

export interface PermissionTableCell<T = PermissionTableFieldCellPermission | PermissionTableObjectCellPermission> {
  key: string;
  sobject: string;
  apiName: string;
  label: string;
  tableLabel: string;
  permissions: Record<string, T>;
}

export type PermissionTableCellExtended =
  | PermissionTableObjectCell
  | PermissionTableFieldCell
  | PermissionTableTabVisibilityCell
  | PermissionTableSystemPermissionCell
  | PermissionTableSetupEntityAccessCell;

export interface PermissionTableObjectCell extends PermissionTableCell<PermissionTableObjectCellPermission> {
  allowEditPermission: boolean; // TODO: what other permissions may be restricted here??
  /** False for objects where Salesforce silently drops View All / Modify All (Idea, Product2, ...) */
  allowViewAllModifyAllPermission: boolean;
  /** False for objects that accept field permissions but have no ObjectPermissions record (PricebookEntry, Task, ...) */
  allowObjectPermission: boolean;
}

/**
 * Audit values are flattened onto the row (rather than nested) because the audit columns are built with
 * `setColumnFromType`, which reads `row[column.key]`. They are absent for standard fields.
 */
export interface PermissionTableFieldCell extends PermissionTableCell<PermissionTableFieldCellPermission>, Partial<FieldAuditMetadata> {
  type: string;
  allowEditPermission: boolean;
}

export interface PermissionTableTabVisibilityCell extends PermissionTableCell<PermissionTableTabVisibilityCellPermission> {
  canSetPermission: boolean;
}

export interface PermissionTableSystemPermissionCell extends PermissionTableCell<PermissionTableSystemPermissionCellPermission> {}

export interface PermissionTableSetupEntityAccessCell extends PermissionTableCell<PermissionTableSetupEntityAccessCellPermission> {
  setupEntityType: SetupEntityAccessType;
  setupEntityId: string;
  namespacePrefix?: Maybe<string>;
  description?: Maybe<string>;
}

export interface PermissionTableSummaryRow {
  type: 'HEADING' | 'ACTION';
}

export interface PermissionTableObjectCellPermissionBase<
  T = ObjectPermissionItem | FieldPermissionItem | TabVisibilityPermissionItem | SystemPermissionItem | SetupEntityAccessItem,
> {
  rowKey: string;
  parentId: string; // permissions set (placeholder profile or permission set Id)
  sobject: string;
  errorMessage?: Maybe<string>;
  record: T;
  /**
   * True for permission sets installed from a managed package. Salesforce rejects any change to them, so
   * every edit path treats these as read-only and they are never included in a save.
   */
  isReadOnly: boolean;
}

export interface PermissionTableObjectCellPermission extends PermissionTableObjectCellPermissionBase<ObjectPermissionItem> {
  create: boolean;
  read: boolean;
  edit: boolean;
  delete: boolean;
  viewAll: boolean;
  modifyAll: boolean;
  viewAllFields: boolean;
  createIsDirty: boolean;
  readIsDirty: boolean;
  editIsDirty: boolean;
  deleteIsDirty: boolean;
  viewAllIsDirty: boolean;
  modifyAllIsDirty: boolean;
  viewAllFieldsIsDirty: boolean;
}
export interface PermissionTableFieldCellPermission extends PermissionTableObjectCellPermissionBase<FieldPermissionItem> {
  field: string;
  read: boolean;
  edit: boolean;
  readIsDirty: boolean;
  editIsDirty: boolean;
}

export interface PermissionTableTabVisibilityCellPermission extends PermissionTableObjectCellPermissionBase<TabVisibilityPermissionItem> {
  available: boolean;
  availableIsDirty: boolean;
  visible: boolean;
  visibleIsDirty: boolean;
}

export interface PermissionTableSystemPermissionCellPermission extends PermissionTableObjectCellPermissionBase<SystemPermissionItem> {
  /** The `Permissions*` field API name on the PermissionSet record, e.x. `PermissionsApiEnabled` */
  field: string;
  enabled: boolean;
  enabledIsDirty: boolean;
}

export interface PermissionTableSetupEntityAccessCellPermission extends PermissionTableObjectCellPermissionBase<SetupEntityAccessItem> {
  setupEntityType: SetupEntityAccessType;
  setupEntityId: string;
  enabled: boolean;
  enabledIsDirty: boolean;
}

export type PermissionTableCellPermission =
  | PermissionTableObjectCellPermission
  | PermissionTableFieldCellPermission
  | PermissionTableTabVisibilityCellPermission
  | PermissionTableSystemPermissionCellPermission
  | PermissionTableSetupEntityAccessCellPermission;

export interface ManagePermissionsEditorTableProps {
  fieldsByObject: Record<string, string[]>;
}

export interface DirtyRow<T> {
  rowKey: string;
  dirtyCount: number;
  row: T;
}

export interface ManagePermissionsEditorTableRef {
  resetChanges: () => void;
}

export interface PermissionObjectSaveData {
  permissionSaveResults: PermissionSaveResults<ObjectPermissionRecordForSave, PermissionTableObjectCellPermission>[];
  recordsToInsert: ObjectPermissionRecordForSave[];
  recordsToUpdate: ObjectPermissionRecordForSave[];
  recordsToDelete: string[];
}

export interface PermissionFieldSaveData {
  permissionSaveResults: PermissionSaveResults<FieldPermissionRecordForSave, PermissionTableFieldCellPermission>[];
  recordsToInsert: FieldPermissionRecordForSave[];
  recordsToUpdate: FieldPermissionRecordForSave[];
  recordsToDelete: string[];
}

export interface PermissionTabVisibilitySaveData {
  permissionSaveResults: PermissionSaveResults<TabVisibilityPermissionRecordForSave, PermissionTableTabVisibilityCellPermission>[];
  recordsToInsert: TabVisibilityPermissionRecordForSave[];
  recordsToUpdate: TabVisibilityPermissionRecordForSave[];
  recordsToDelete: string[];
}

export interface PermissionSetupEntityAccessSaveData {
  permissionSaveResults: PermissionSaveResults<SetupEntityAccessRecordForSave, PermissionTableSetupEntityAccessCellPermission>[];
  recordsToInsert: SetupEntityAccessRecordForSave[];
  /** Never populated - `SetupEntityAccess` cannot be updated - but kept so `savePermissionRecords` can stay generic */
  recordsToUpdate: SetupEntityAccessRecordForSave[];
  recordsToDelete: string[];
}

/**
 * One PermissionSet update per parent (permission set id) carrying every changed `Permissions*` field,
 * plus the dirty cells that produced it so save errors/results can be attributed back to each cell.
 */
export interface SystemPermissionSaveRecord {
  parentId: string;
  /**
   * Where the `Permissions*` fields are written. Profile-owned permission sets cannot be updated
   * directly (Salesforce rejects with INVALID_CROSS_REFERENCE_KEY), so those are written to the
   * `Profile` record; standalone permission sets are written to the `PermissionSet` record.
   */
  sobjectType: 'Profile' | 'PermissionSet';
  record: SystemPermissionRecordForSave;
  dirtyPermissions: PermissionTableSystemPermissionCellPermission[];
  response?: Maybe<RecordResult>;
}

export interface PermissionSystemSaveData {
  recordsToUpdate: SystemPermissionSaveRecord[];
}

export interface PermissionManagerTableContext {
  type: PermissionType;
  /**
   * What a row is called in the "Showing n of m ..." summary and the bulk edit modal. Falls back to a label derived
   * from `type` when omitted; the setup entity access table sets it because one `type` covers many entity kinds.
   */
  rowLabel?: { singular: string; plural: string };
  rows: PermissionTableCellExtended[];
  totalCount: number;
  filterValue?: string;
  /** True when any row in the table (not just the visible ones) has a save error */
  hasErrors?: boolean;
  errorsOnly?: boolean;
  onFilterRows: (value: string) => void;
  onToggleErrorsOnly?: (value: boolean) => void;
  onRowAction: (action: 'selectAll' | 'unselectAll' | 'reset', columnKey: string) => void;
  onColumnAction: (action: 'selectAll' | 'unselectAll' | 'reset', columnKey: string) => void;
  onBulkAction: (rows: PermissionTableCellExtended[]) => void;
}
