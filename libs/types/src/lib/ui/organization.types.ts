import type { JetstreamOrganization as JetstreamOrg } from '@prisma/client';
import { SalesforceOrgUi } from '../types';

export type JetstreamOrganization = Pick<JetstreamOrg, 'id' | 'name' | 'description' | 'createdAt' | 'updatedAt'> & {
  orgs: { uniqueId: string }[];
};

export type JetstreamOrganizationWithOrgs = Pick<JetstreamOrg, 'id' | 'name' | 'description' | 'createdAt' | 'updatedAt'> & {
  orgs: SalesforceOrgUi[];
};

export type JetstreamOrganizationCreateUpdatePayload = Pick<JetstreamOrganization, 'name' | 'description'>;
