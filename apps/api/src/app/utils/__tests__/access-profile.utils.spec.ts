import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../db/user.db', () => ({ findActiveTeamAccessProfile: vi.fn() }));
vi.mock('../error-handler', () => ({
  NotAllowedError: class NotAllowedError extends Error {},
}));

import * as userDb from '../../db/user.db';
import { assertHistorySyncAllowed, assertOrgConnectAllowed } from '../access-profile.utils';

const mockFindAccessProfile = vi.mocked(userDb.findActiveTeamAccessProfile);

describe('assertHistorySyncAllowed', () => {
  beforeEach(() => {
    mockFindAccessProfile.mockReset();
  });

  it('allows a member without an access profile', async () => {
    mockFindAccessProfile.mockResolvedValue(null);

    await expect(assertHistorySyncAllowed('user-1')).resolves.toBeUndefined();
  });

  it('allows a profile that includes history sync', async () => {
    mockFindAccessProfile.mockResolvedValue({
      id: 'p',
      version: 1,
      policy: { v: 1, tools: [], operations: ['history.sync'], surfaces: [] },
    });

    await expect(assertHistorySyncAllowed('user-1')).resolves.toBeUndefined();
  });

  it('refuses a profile that excludes history sync', async () => {
    mockFindAccessProfile.mockResolvedValue({
      id: 'p',
      version: 1,
      policy: { v: 1, tools: [], operations: ['orgs.connect'], surfaces: [] },
    });

    await expect(assertHistorySyncAllowed('user-1')).rejects.toThrow('syncing history');
  });
});

describe('assertOrgConnectAllowed', () => {
  const withoutConnect = { id: 'p', version: 1, policy: { v: 1, tools: [], operations: [], surfaces: [] } };

  beforeEach(() => {
    mockFindAccessProfile.mockReset();
  });

  it('refuses a new org when the profile excludes orgs.connect', async () => {
    mockFindAccessProfile.mockResolvedValue(withoutConnect);

    await expect(assertOrgConnectAllowed('user-1', { isExistingOrg: false })).rejects.toThrow('connecting Salesforce orgs');
  });

  it('allows re-authorizing an org the member already has', async () => {
    mockFindAccessProfile.mockResolvedValue(withoutConnect);

    await expect(assertOrgConnectAllowed('user-1', { isExistingOrg: true })).resolves.toBeUndefined();
  });

  it('allows a new org for a member without a profile or with orgs.connect', async () => {
    mockFindAccessProfile.mockResolvedValue(null);
    await expect(assertOrgConnectAllowed('user-1', { isExistingOrg: false })).resolves.toBeUndefined();

    mockFindAccessProfile.mockResolvedValue({ ...withoutConnect, policy: { ...withoutConnect.policy, operations: ['orgs.connect'] } });
    await expect(assertOrgConnectAllowed('user-1', { isExistingOrg: false })).resolves.toBeUndefined();
  });
});
