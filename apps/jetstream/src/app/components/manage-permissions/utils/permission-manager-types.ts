import {
  EntityParticlePermissionsRecord,
  FieldPermissionRecord,
  MapOf,
  Maybe,
  ObjectPermissionRecord,
  RecordAttributes,
  RecordResult,
} from '@jetstream/types';

export type PermissionType = 'object' | 'field';
export type ObjectPermissionTypes = 'create' | 'read' | 'edit' | 'delete' | 'viewAll' | 'modifyAll';
export type FieldPermissionTypes = 'read' | 'edit';

export type BulkActionCheckbox = {
  id: ObjectPermissionTypes;
  label: string;
  value: boolean;
  disabled: boolean;
};

export interface ObjectPermissionDefinitionMap {
  apiName: string;
  label: string; // TODO: ;(
  metadata: string; // FIXME: this should probably be Describe metadata
  // used to retain order of permissions
  permissionKeys: string[]; // this is permission set ids, which could apply to profile or perm set
  permissions: MapOf<ObjectPermissionItem>;
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
  permissions: MapOf<FieldPermissionItem>;
}

export interface FieldPermissionItem {
  read: boolean;
  edit: boolean;
  record?: Maybe<FieldPermissionRecord>;
  errorMessage?: Maybe<string>;
}

export interface ObjectPermissionRecordForSave extends Omit<ObjectPermissionRecord, 'Id' | 'Parent'> {
  attributes: Partial<RecordAttributes>;
  Id?: Maybe<string>;
}

export interface FieldPermissionRecordForSave extends Omit<FieldPermissionRecord, 'Id' | 'Parent'> {
  attributes: Partial<RecordAttributes>;
  Id?: string;
}

export interface PermissionSaveResults<RecordType, DirtyPermType> {
  dirtyPermission: DirtyPermType;
  dirtyPermissionIdx: number;
  operation: 'insert' | 'update';
  record: RecordType;
  recordIdx: number;
  response?: Maybe<RecordResult>;
}

export interface PermissionTableCell<T = PermissionTableFieldCellPermission | PermissionTableObjectCellPermission> {
  key: string;
  sobject: string;
  apiName: string;
  label: string;
  tableLabel: string;
  permissions: MapOf<T>;
}

export interface PermissionTableObjectCell extends PermissionTableCell<PermissionTableObjectCellPermission> {
  allowEditPermission: boolean; // TODO: what other permissions may be restricted here??
}

export interface PermissionTableFieldCell extends PermissionTableCell<PermissionTableFieldCellPermission> {
  type: string;
  allowEditPermission: boolean;
}

export interface PermissionTableSummaryRow {
  type: 'HEADING' | 'ACTION';
}

export interface PermissionTableObjectCellPermissionBase<T = ObjectPermissionItem | FieldPermissionItem> {
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

export interface ManagePermissionsEditorTableProps {
  fieldsByObject: MapOf<string[]>;
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
}

export interface PermissionFieldSaveData {
  permissionSaveResults: PermissionSaveResults<FieldPermissionRecordForSave, PermissionTableFieldCellPermission>[];
  recordsToInsert: FieldPermissionRecordForSave[];
  recordsToUpdate: FieldPermissionRecordForSave[];
}

export interface PermissionManagerTableContext {
  type: PermissionType;
  rows: (PermissionTableObjectCell | PermissionTableFieldCell)[];
  totalCount: number;
  onFilterRows: (value: string) => void;
  onRowAction: (action: 'selectAll' | 'unselectAll' | 'reset', columnKey: string) => void;
  onColumnAction: (action: 'selectAll' | 'unselectAll' | 'reset', columnKey: string) => void;
  onBulkAction: (rows: (PermissionTableObjectCell | PermissionTableFieldCell)[]) => void;
}
