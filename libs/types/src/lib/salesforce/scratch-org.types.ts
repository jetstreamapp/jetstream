import { Maybe } from '../types';

export type ScratchOrgInfoStatus = 'New' | 'Creating' | 'Active' | 'Error' | 'Deleted';

/**
 * A ScratchOrgInfo record from a Dev Hub. One exists for every scratch org that was ever requested, and it is kept
 * (with Status = Deleted) after the scratch org expires or is deleted.
 *
 * Everything other than the id is optional because the queried fields are limited to the ones the running user can
 * see on that Dev Hub.
 */
export interface ScratchOrgInfoRecord {
  Id: string;
  Name?: Maybe<string>;
  OrgName?: Maybe<string>;
  Edition?: Maybe<string>;
  Status?: Maybe<ScratchOrgInfoStatus>;
  ErrorCode?: Maybe<string>;
  ExpirationDate?: Maybe<string>;
  DurationDays?: Maybe<number>;
  /** 15 character organization id of the scratch org, set once it has been created */
  ScratchOrg?: Maybe<string>;
  SignupUsername?: Maybe<string>;
  SignupEmail?: Maybe<string>;
  SignupInstance?: Maybe<string>;
  LoginUrl?: Maybe<string>;
  Namespace?: Maybe<string>;
  Features?: Maybe<string>;
  Description?: Maybe<string>;
  HasSampleData?: Maybe<boolean>;
  Release?: Maybe<string>;
  Snapshot?: Maybe<string>;
  SourceOrg?: Maybe<string>;
  LastLoginDate?: Maybe<string>;
  /** Callback url of the connected app the scratch org was requested with, which identifies the tool that created it */
  ConnectedAppCallbackUrl?: Maybe<string>;
  CreatedDate?: Maybe<string>;
  CreatedById?: Maybe<string>;
  CreatedBy?: Maybe<{ Name?: Maybe<string> }>;
}

export interface ScratchOrgCreateResponse {
  /** Id of the ScratchOrgInfo record, the scratch org itself is created asynchronously by Salesforce */
  id: string;
}
