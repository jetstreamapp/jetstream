import {
  EntityParticlePermissionsRecord,
  FieldPermissionRecord,
  ObjectPermissionRecord,
  RecordAttributes,
  RecordResult,
  TabVisibilityPermissionRecord,
} from '../salesforce/record.types';
import { Maybe } from '../types';

export type PermissionType = 'object' | 'field' | 'tabVisibility';
export type ObjectPermissionTypes = 'create' | 'read' | 'edit' | 'delete' | 'viewAll' | 'modifyAll';
export type FieldPermissionTypes = 'read' | 'edit';
export type TabVisibilityPermissionTypes = 'available' | 'visible';

export type PermissionTypes = ObjectPermissionTypes | FieldPermissionTypes | TabVisibilityPermissionTypes;

export type BulkActionCheckbox = {
  id: PermissionTypes;
  label: string;
  value: boolean;
  disabled: boolean;
};

export type PermissionDefinitionMap = ObjectPermissionDefinitionMap | FieldPermissionDefinitionMap | TabVisibilityPermissionDefinitionMap;

export interface ObjectPermissionDefinitionMap {
  apiName: string;
  label: string;
  metadata: string; // FIXME: this should probably be Describe metadata
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
  record?: Maybe<ObjectPermissionRecord>;
  errorMessage?: string;
}

export interface FieldPermissionDefinitionMap {
  apiName: string;
  label: string;
  metadata: EntityParticlePermissionsRecord;
  // used to retain order of permissions
  permissionKeys: string[]; // this is permission set ids, which could apply to profile or perm set
  permissions: Record<string, FieldPermissionItem>;
}

export interface FieldPermissionItem {
  read: boolean;
  edit: boolean;
  record?: Maybe<FieldPermissionRecord>;
  errorMessage?: Maybe<string>;
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

export type PermissionTableCellExtended = PermissionTableObjectCell | PermissionTableFieldCell | PermissionTableTabVisibilityCell;

export interface PermissionTableObjectCell extends PermissionTableCell<PermissionTableObjectCellPermission> {
  allowEditPermission: boolean; // TODO: what other permissions may be restricted here??
}

export interface PermissionTableFieldCell extends PermissionTableCell<PermissionTableFieldCellPermission> {
  type: string;
  allowEditPermission: boolean;
}

export interface PermissionTableTabVisibilityCell extends PermissionTableCell<PermissionTableTabVisibilityCellPermission> {
  canSetPermission: boolean;
}

export interface PermissionTableSummaryRow {
  type: 'HEADING' | 'ACTION';
}

export interface PermissionTableObjectCellPermissionBase<T = ObjectPermissionItem | FieldPermissionItem | TabVisibilityPermissionItem> {
  rowKey: string;
  parentId: string; // permissions set (placeholder profile or permission set Id)
  sobject: string;
  errorMessage?: Maybe<string>;
  record: T;
}

export interface PermissionTableObjectCellPermission extends PermissionTableObjectCellPermissionBase<ObjectPermissionItem> {
  create: boolean;
  read: boolean;
  edit: boolean;
  delete: boolean;
  viewAll: boolean;
  modifyAll: boolean;
  createIsDirty: boolean;
  readIsDirty: boolean;
  editIsDirty: boolean;
  deleteIsDirty: boolean;
  viewAllIsDirty: boolean;
  modifyAllIsDirty: boolean;
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

export type PermissionTableCellPermission =
  | PermissionTableObjectCellPermission
  | PermissionTableFieldCellPermission
  | PermissionTableTabVisibilityCellPermission;

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

export interface PermissionManagerTableContext {
  type: PermissionType;
  rows: PermissionTableCellExtended[];
  totalCount: number;
  onFilterRows: (value: string) => void;
  onRowAction: (action: 'selectAll' | 'unselectAll' | 'reset', columnKey: string) => void;
  onColumnAction: (action: 'selectAll' | 'unselectAll' | 'reset', columnKey: string) => void;
  onBulkAction: (rows: PermissionTableCellExtended[]) => void;
}
