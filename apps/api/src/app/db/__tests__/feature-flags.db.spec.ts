import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  featureFlagOverride: {
    findMany: vi.fn(),
  },
  teamMember: {
    findFirst: vi.fn(),
  },
}));

vi.mock('@jetstream/api-config', () => ({
  logger: { error: vi.fn(), warn: vi.fn() },
  prisma: prismaMock,
}));

import { ALL_FEATURE_FLAG_KEYS, DEFAULT_FEATURE_FLAGS } from '@jetstream/types';

// Drive fixtures off the real registry so renaming/retiring the example flag never breaks these tests.
const FLAG = ALL_FEATURE_FLAG_KEYS[0];

describe('resolveFeatureFlagsForUser', () => {
  let resolveFeatureFlagsForUser: typeof import('../feature-flags.db').resolveFeatureFlagsForUser;

  beforeEach(async () => {
    vi.clearAllMocks();
    ({ resolveFeatureFlagsForUser } = await import('../feature-flags.db'));
  });

  it('requires at least one flag in the registry to exercise these tests', () => {
    expect(ALL_FEATURE_FLAG_KEYS.length).toBeGreaterThan(0);
  });

  it('returns code defaults when there are no overrides', async () => {
    prismaMock.featureFlagOverride.findMany.mockResolvedValue([]);
    const flags = await resolveFeatureFlagsForUser({ userId: 'user-1', teamId: null });
    expect(flags[FLAG]).toBe(DEFAULT_FEATURE_FLAGS[FLAG]);
  });

  it('enables a flag from a user override', async () => {
    prismaMock.featureFlagOverride.findMany.mockResolvedValue([{ key: FLAG, enabled: true }]);
    const flags = await resolveFeatureFlagsForUser({ userId: 'user-1', teamId: null });
    expect(flags[FLAG]).toBe(true);
  });

  it('enables a flag from a team override', async () => {
    prismaMock.featureFlagOverride.findMany.mockResolvedValue([{ key: FLAG, enabled: true }]);
    const flags = await resolveFeatureFlagsForUser({ userId: 'user-1', teamId: 'team-1' });
    expect(flags[FLAG]).toBe(true);
  });

  it('is most-permissive when user and team overrides conflict (any true wins)', async () => {
    prismaMock.featureFlagOverride.findMany.mockResolvedValue([
      { key: FLAG, enabled: false },
      { key: FLAG, enabled: true },
    ]);
    const flags = await resolveFeatureFlagsForUser({ userId: 'user-1', teamId: 'team-1' });
    expect(flags[FLAG]).toBe(true);
  });

  it('ignores override rows for unknown/removed flag keys', async () => {
    prismaMock.featureFlagOverride.findMany.mockResolvedValue([{ key: 'flag-removed-from-code', enabled: true }]);
    const flags = await resolveFeatureFlagsForUser({ userId: 'user-1', teamId: null });
    expect(flags).not.toHaveProperty('flag-removed-from-code');
    expect(flags[FLAG]).toBe(DEFAULT_FEATURE_FLAGS[FLAG]);
  });

  it('only filters by userId when the user has no team', async () => {
    prismaMock.featureFlagOverride.findMany.mockResolvedValue([]);
    await resolveFeatureFlagsForUser({ userId: 'user-1', teamId: null });
    expect(prismaMock.featureFlagOverride.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { OR: [{ userId: 'user-1' }] } }),
    );
  });

  it('filters by userId and teamId when the user has a team', async () => {
    prismaMock.featureFlagOverride.findMany.mockResolvedValue([]);
    await resolveFeatureFlagsForUser({ userId: 'user-1', teamId: 'team-1' });
    expect(prismaMock.featureFlagOverride.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { OR: [{ userId: 'user-1' }, { teamId: 'team-1' }] } }),
    );
  });
});

describe('resolveActiveTeamIdForUser', () => {
  let resolveActiveTeamIdForUser: typeof import('../feature-flags.db').resolveActiveTeamIdForUser;

  beforeEach(async () => {
    vi.clearAllMocks();
    ({ resolveActiveTeamIdForUser } = await import('../feature-flags.db'));
  });

  it('resolves the team only for an ACTIVE membership in an ACTIVE team', async () => {
    prismaMock.teamMember.findFirst.mockResolvedValue({ teamId: 'team-1' });
    const teamId = await resolveActiveTeamIdForUser('user-1');
    expect(teamId).toBe('team-1');
    expect(prismaMock.teamMember.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'user-1', status: 'ACTIVE', team: { status: 'ACTIVE' } } }),
    );
  });

  it('returns null when there is no active membership/team', async () => {
    prismaMock.teamMember.findFirst.mockResolvedValue(null);
    const teamId = await resolveActiveTeamIdForUser('user-1');
    expect(teamId).toBeNull();
  });
});

describe('checkFeatureFlag', () => {
  let checkFeatureFlag: typeof import('../feature-flags.db').checkFeatureFlag;

  beforeEach(async () => {
    vi.clearAllMocks();
    ({ checkFeatureFlag } = await import('../feature-flags.db'));
  });

  it('scopes to the active team and returns the flag value', async () => {
    prismaMock.teamMember.findFirst.mockResolvedValue({ teamId: 'team-1' });
    prismaMock.featureFlagOverride.findMany.mockResolvedValue([{ key: FLAG, enabled: true }]);
    const enabled = await checkFeatureFlag({ userId: 'user-1', key: FLAG });
    expect(enabled).toBe(true);
    expect(prismaMock.featureFlagOverride.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { OR: [{ userId: 'user-1' }, { teamId: 'team-1' }] } }),
    );
  });

  it('falls back to user-only scope when the membership/team is not active', async () => {
    prismaMock.teamMember.findFirst.mockResolvedValue(null);
    prismaMock.featureFlagOverride.findMany.mockResolvedValue([]);
    await checkFeatureFlag({ userId: 'user-1', key: FLAG });
    expect(prismaMock.featureFlagOverride.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { OR: [{ userId: 'user-1' }] } }),
    );
  });
});
