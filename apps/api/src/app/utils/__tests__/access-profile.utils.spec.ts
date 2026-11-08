import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../db/user.db', () => ({ findActiveTeamAccessProfile: vi.fn() }));
vi.mock('../error-handler', () => ({
  NotAllowedError: class NotAllowedError extends Error {},
}));

import * as userDb from '../../db/user.db';
import { assertHistorySyncAllowed } from '../access-profile.utils';

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
