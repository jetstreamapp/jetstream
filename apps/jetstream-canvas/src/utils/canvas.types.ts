import { ApiConnection } from '@jetstream/salesforce-api';
import type { SalesforceOrgUi } from '@jetstream/types';

export interface OrgAndApiConnection {
  org: SalesforceOrgUi;
  apiConnection: ApiConnection;
}
