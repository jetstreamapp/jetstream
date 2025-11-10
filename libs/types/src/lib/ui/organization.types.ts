import { SalesforceOrgUi } from '../types';

// import type { JetstreamOrganization as JetstreamOrg } from '@jetstream/prisma';
interface JetstreamOrg {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export type OrgGroup = Pick<JetstreamOrg, 'id' | 'name' | 'description' | 'createdAt' | 'updatedAt'> & {
  orgs: { uniqueId: string }[];
};

export type OrgGroupWithOrgs = Pick<JetstreamOrg, 'id' | 'name' | 'description' | 'createdAt' | 'updatedAt'> & {
  orgs: SalesforceOrgUi[];
};

export type OrgGroupCreateUpdatePayload = Pick<OrgGroup, 'name' | 'description'>;
