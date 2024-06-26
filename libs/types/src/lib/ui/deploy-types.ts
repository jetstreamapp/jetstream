import { ListMetadataResult } from '../salesforce/metadata.types';
import { SalesforceOrgUi } from '../types';
import { SalesforceDeployHistoryItem } from './types';

export type DeployMetadataStatus = 'idle' | 'submitting' | 'preparing' | 'adding';

type Common = 'common';
type User = 'user';
type All = 'all';
type CurrentUser = 'currentUser';
type Yes = 'Yes';
type No = 'No';

export type SidePanelType = 'type-selection' | 'user-selection' | 'date-range-selection' | 'include-managed-selection';

export type CommonUser = Common | User;
export type AllUser = All | CurrentUser | User;
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
  folder?: string | null;
  lastRefreshed?: string | null;
  lastModifiedByName?: string | null;
  lastModifiedDate?: Date | null;
  createdByName?: string | null;
  createdDate?: Date | null;
  manageableState?: 'beta' | 'deleted' | 'deprecated' | 'deprecatedEditable' | 'installed' | 'installedEditable' | 'released' | 'unmanaged';
  loading: boolean;
  error?: boolean | null;
  metadata?: ListMetadataResult;
}

export interface DeployHistoryTableContext {
  orgsById: Record<string, SalesforceOrgUi>;
  portalRefForFilters: React.RefObject<HTMLDivElement>;
  onView: (item: SalesforceDeployHistoryItem) => void;
  onDownload: (item: SalesforceDeployHistoryItem) => void;
}
