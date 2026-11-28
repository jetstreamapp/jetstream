import type { ApiConnection } from '@jetstream/salesforce-api';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createOrUpdateSalesforceOrg, getOrgGroups } from '../persistence.service';
import { initConnectionFromOAuthResponse } from '../sfdc-oauth.service';

vi.mock('electron-log', () => ({ default: { warn: vi.fn(), info: vi.fn(), error: vi.fn() } }));
vi.mock('../persistence.service', () => ({
  createOrUpdateSalesforceOrg: vi.fn((org) => org),
  encryptTokenPortable: vi.fn((value: string) => `encrypted:${value}`),
  getOrgGroups: vi.fn(),
}));

const ORG_GROUP_ID = '0a0f0e0d-1111-4222-8333-444455556666';

const jetstreamConn = {
  sessionInfo: {
    organizationId: '00D000000000001AAA',
    userId: '005000000000001AAA',
    accessToken: 'access',
    refreshToken: 'refresh',
    instanceUrl: 'https://acme.scratch.my.salesforce.com',
  },
  org: {
    identity: vi.fn().mockResolvedValue({
      user_id: '005000000000001AAA',
      organization_id: '00D000000000001AAA',
      username: 'test-abc@example.com',
    }),
  },
  query: { query: vi.fn().mockResolvedValue({ queryResults: { totalSize: 1, records: [{ Name: 'Acme' }] } }) },
} as unknown as ApiConnection;

describe('initConnectionFromOAuthResponse', () => {
  beforeEach(() => {
    vi.mocked(createOrUpdateSalesforceOrg).mockClear();
    vi.mocked(getOrgGroups).mockReturnValue([{ id: ORG_GROUP_ID }] as ReturnType<typeof getOrgGroups>);
  });

  it('places the org in the group it was connected from', async () => {
    await initConnectionFromOAuthResponse({ jetstreamConn, orgGroupId: ORG_GROUP_ID });

    expect(createOrUpdateSalesforceOrg).toHaveBeenCalledWith(
      expect.objectContaining({ uniqueId: '00D000000000001AAA-005000000000001AAA', jetstreamOrganizationId: ORG_GROUP_ID }),
    );
  });

  it('ignores a group that no longer exists', async () => {
    await initConnectionFromOAuthResponse({ jetstreamConn, orgGroupId: 'f9f9f9f9-1111-4222-8333-444455556666' });

    expect(vi.mocked(createOrUpdateSalesforceOrg).mock.calls[0][0]).not.toHaveProperty('jetstreamOrganizationId');
  });

  it('leaves the group for the stored org to decide when none was asked for', async () => {
    await initConnectionFromOAuthResponse({ jetstreamConn });

    expect(vi.mocked(createOrUpdateSalesforceOrg).mock.calls[0][0]).not.toHaveProperty('jetstreamOrganizationId');
  });
});
