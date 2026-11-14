import { ALL_FEATURE_FLAG_KEYS } from '@jetstream/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = vi.hoisted(() => {
  const mock = {
    featureFlagOverride: { findMany: vi.fn(), groupBy: vi.fn(), deleteMany: vi.fn(), createMany: vi.fn(), updateMany: vi.fn() },
    teamMember: { findUnique: vi.fn() },
    user: { count: vi.fn() },
    team: { count: vi.fn() },
    $transaction: vi.fn(),
  };
  mock.$transaction.mockImplementation((callback: (tx: typeof mock) => unknown) => callback(mock));
  return mock;
});
const createAuditLogMock = vi.hoisted(() => vi.fn());

vi.mock('@jetstream/api-config', () => ({ prisma: prismaMock }));
vi.mock('@jetstream/audit-logs', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@jetstream/audit-logs')>()),
  createAuditLog: createAuditLogMock,
}));

const FLAG = ALL_FEATURE_FLAG_KEYS[0];
const ADMIN = { email: 'admin@example.com', name: null, picture: null };
const REQUEST_METADATA = { ipAddress: '127.0.0.1', userAgent: 'test' };
const USER_ID = '11111111-1111-4111-8111-111111111111';
const TEAM_ID = '22222222-2222-4222-8222-222222222222';

describe('feature flag admin service', () => {
  let service: typeof import('../feature-flags.service');

  beforeEach(async () => {
    vi.clearAllMocks();
    prismaMock.$transaction.mockImplementation((callback: (tx: typeof prismaMock) => unknown) => callback(prismaMock));
    service = await import('../feature-flags.service');
  });

  describe('getUserFeatureFlagStatuses', () => {
    it('reports the team override separately and counts it toward the effective value', async () => {
      prismaMock.teamMember.findUnique.mockResolvedValue({ status: 'ACTIVE', team: { id: TEAM_ID, name: 'Acme', status: 'ACTIVE' } });
      prismaMock.featureFlagOverride.findMany.mockResolvedValue([{ key: FLAG, enabled: true, userId: null }]);

      const statuses = await service.getUserFeatureFlagStatuses(USER_ID);
      const status = statuses.find(({ key }) => key === FLAG);

      expect(statuses).toHaveLength(ALL_FEATURE_FLAG_KEYS.length);
      expect(status).toMatchObject({ override: null, teamOverride: true, effective: true });
    });

    it('ignores the team when the membership is not active', async () => {
      prismaMock.teamMember.findUnique.mockResolvedValue({ status: 'INACTIVE', team: { id: TEAM_ID, name: 'Acme', status: 'ACTIVE' } });
      prismaMock.featureFlagOverride.findMany.mockResolvedValue([]);

      await service.getUserFeatureFlagStatuses(USER_ID);

      expect(prismaMock.featureFlagOverride.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { OR: [{ userId: USER_ID }] } }),
      );
    });
  });

  describe('updateFeatureFlagOverrides', () => {
    it('rejects unknown flag keys', async () => {
      await expect(
        service.updateFeatureFlagOverrides('not-a-flag', { scope: 'user', ids: [USER_ID], action: 'enable' }, ADMIN, REQUEST_METADATA),
      ).rejects.toThrow('not found');
    });

    it('rejects ids that no longer exist', async () => {
      prismaMock.user.count.mockResolvedValue(0);
      await expect(
        service.updateFeatureFlagOverrides(FLAG, { scope: 'user', ids: [USER_ID], action: 'enable' }, ADMIN, REQUEST_METADATA),
      ).rejects.toThrow('no longer exist');
      expect(prismaMock.featureFlagOverride.createMany).not.toHaveBeenCalled();
    });

    it('creates new overrides, re-enables stale disabled rows and writes one audit log', async () => {
      prismaMock.user.count.mockResolvedValue(1);
      prismaMock.featureFlagOverride.createMany.mockResolvedValue({ count: 1 });
      prismaMock.featureFlagOverride.updateMany.mockResolvedValue({ count: 2 });

      const result = await service.updateFeatureFlagOverrides(
        FLAG,
        { scope: 'user', ids: [USER_ID, USER_ID], action: 'enable' },
        ADMIN,
        REQUEST_METADATA,
      );

      expect(result).toEqual({ affected: 3 });
      expect(prismaMock.user.count).toHaveBeenCalledWith({ where: { id: { in: [USER_ID] } } });
      expect(prismaMock.featureFlagOverride.createMany).toHaveBeenCalledWith({
        data: [{ key: FLAG, userId: USER_ID, enabled: true }],
        skipDuplicates: true,
      });
      expect(createAuditLogMock).toHaveBeenCalledTimes(1);
      expect(createAuditLogMock).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'ADMIN_FEATURE_FLAG_OVERRIDES_ENABLED',
          resourceId: FLAG,
          metadata: expect.objectContaining({ scope: 'user', affected: 3 }),
        }),
      );
    });

    it('removes team overrides by team id', async () => {
      prismaMock.team.count.mockResolvedValue(1);
      prismaMock.featureFlagOverride.deleteMany.mockResolvedValue({ count: 1 });

      const result = await service.updateFeatureFlagOverrides(
        FLAG,
        { scope: 'team', ids: [TEAM_ID], action: 'remove' },
        ADMIN,
        REQUEST_METADATA,
      );

      expect(result).toEqual({ affected: 1 });
      expect(prismaMock.featureFlagOverride.deleteMany).toHaveBeenCalledWith({ where: { key: FLAG, teamId: { in: [TEAM_ID] } } });
    });
  });

  describe('getFeatureFlagOverrides', () => {
    it("shows each user's team override for context", async () => {
      prismaMock.featureFlagOverride.findMany.mockImplementation(({ where }: { where: { userId?: unknown } }) =>
        where.userId
          ? Promise.resolve([
              {
                enabled: true,
                updatedAt: new Date(0),
                user: {
                  id: USER_ID,
                  email: 'a@example.com',
                  name: 'A',
                  teamMembership: { status: 'ACTIVE', team: { id: TEAM_ID, name: 'Acme', status: 'ACTIVE' } },
                },
              },
            ])
          : Promise.resolve([{ enabled: true, updatedAt: new Date(0), team: { id: TEAM_ID, name: 'Acme' } }]),
      );

      const { flag, users, teams } = await service.getFeatureFlagOverrides(FLAG);

      expect(flag).toMatchObject({ key: FLAG });
      expect(users[0]).toMatchObject({ userId: USER_ID, teamId: TEAM_ID, teamOverride: true });
      expect(teams).toHaveLength(1);
    });
  });
});
