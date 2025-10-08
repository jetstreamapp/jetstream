import { SalesforceOrgUi } from '../types';

// import type { JetstreamOrganization as JetstreamOrg } from '@jetstream/prisma';
interface JetstreamOrg {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export type JetstreamOrganization = Pick<JetstreamOrg, 'id' | 'name' | 'description' | 'createdAt' | 'updatedAt'> & {
  orgs: { uniqueId: string }[];
};

export type JetstreamOrganizationWithOrgs = Pick<JetstreamOrg, 'id' | 'name' | 'description' | 'createdAt' | 'updatedAt'> & {
  orgs: SalesforceOrgUi[];
};

export type JetstreamOrganizationCreateUpdatePayload = Pick<JetstreamOrganization, 'name' | 'description'>;
