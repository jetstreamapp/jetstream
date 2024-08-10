export type PermissionScope = 'ALL' | 'GRANULAR';

export interface ObjectPermissionAllState {
  scope: 'ALL';
  permissions: CreateObjectPermissions;
}

export interface ObjectPermissionGranularState {
  scope: 'GRANULAR';
  permissions: Record<string, CreateObjectPermissions>;
}

export type ObjectPermissionState = ObjectPermissionAllState | ObjectPermissionGranularState;

export interface CreateFieldParams {
  apiName: string;
  createTab: boolean;
  tabMotif: string;
  payload: CreateObjectPayload;
  objectPermissions: ObjectPermissionState;
  permissionSets: string[];
  profiles: string[];
}

export interface CreateObjectPayload {
  allowInChatterGroups: boolean;
  compactLayoutAssignment: 'SYSTEM';
  deploymentStatus: 'Deployed';
  description?: string;
  enableActivities: boolean;
  enableBulkApi: boolean;
  enableEnhancedLookup: false;
  enableFeeds: boolean;
  enableHistory: boolean;
  enableLicensing: false;
  enableReports: boolean;
  enableSearch: boolean;
  enableSharing: boolean;
  enableStreamingApi: boolean;
  externalSharingModel: 'Private';
  label: string;
  nameField: {
    label: string;
    trackHistory?: boolean;
    type: 'AutoNumber' | 'Text';
    displayFormat?: string;
    startingNumber?: string;
  };
  pluralLabel: string;
  recordTypeTrackHistory: boolean;
  sharingModel: 'ReadWrite';
  startsWith: 'Consonant' | 'Vowel' | 'Special';
  visibility: 'Public';
}

export interface CreateObjectPermissions {
  allowCreate: boolean;
  allowDelete: boolean;
  allowEdit: boolean;
  allowRead: boolean;
  modifyAllRecords: boolean;
  viewAllRecords: boolean;
}
