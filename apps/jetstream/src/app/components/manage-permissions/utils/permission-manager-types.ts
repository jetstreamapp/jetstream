import {
  EntityParticlePermissionsRecord,
  FieldPermissionRecord,
  MapOf,
  ObjectPermissionRecord,
  RecordAttributes,
  RecordResult,
} from '@jetstream/types';
import { PermissionTableFieldCellPermission } from './permission-manager-table-utils';

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
  viewAllRecords: boolean;
  modifyAllRecords: boolean;
  record?: ObjectPermissionRecord;
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
  record?: FieldPermissionRecord;
}

export interface FieldPermissionRecordForSave extends Omit<FieldPermissionRecord, 'Id' | 'parent'> {
  attributes: Partial<RecordAttributes>;
  Id?: string;
}

export interface PermissionSaveResults {
  dirtyPermission: PermissionTableFieldCellPermission;
  dirtyPermissionIdx: number;
  operation: 'insert' | 'update';
  record: FieldPermissionRecordForSave;
  recordIdx: number;
  response?: RecordResult;
}
