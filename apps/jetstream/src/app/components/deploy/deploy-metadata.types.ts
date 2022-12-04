import { ListMetadataResult, MapOf, SalesforceDeployHistoryItem, SalesforceOrgUi } from '@jetstream/types';

export type DeployMetadataStatus = 'idle' | 'submitting' | 'preparing' | 'adding';

type Common = 'common';
type User = 'user';
type All = 'all';
type Yes = 'Yes';
type No = 'No';

export type SidePanelType = 'type-selection' | 'user-selection' | 'date-range-selection' | 'include-managed-selection';

export type CommonUser = Common | User;
export type AllUser = All | User;
export type YesNo = Yes | No;

export interface SalesforceUser {
  Id: string;
  Name: string;
  FirstName: string;
  LastName: string;
  Username: string;
  IsActive: boolean;
}

export interface DeployMetadataTableRow {
  key: string;
  type: string;
  typeLabel: string;
  fullName?: string;
  folder: string;
  lastRefreshed: string;
  lastModifiedByName?: string;
  lastModifiedDate?: Date;
  createdByName?: string;
  createdDate?: Date;
  manageableState?: 'beta' | 'deleted' | 'deprecated' | 'deprecatedEditable' | 'installed' | 'installedEditable' | 'released' | 'unmanaged';
  loading: boolean;
  error: boolean;
  metadata?: ListMetadataResult;
}

export interface DeployHistoryTableContext {
  orgsById: MapOf<SalesforceOrgUi>;
  portalRefForFilters: React.RefObject<HTMLDivElement>;
  onView: (item: SalesforceDeployHistoryItem) => void;
  onDownload: (item: SalesforceDeployHistoryItem) => void;
}
