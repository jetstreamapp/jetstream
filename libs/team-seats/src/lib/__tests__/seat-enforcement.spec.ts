import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  teamFindUniqueOrThrow: vi.fn(),
  teamMemberCount: vi.fn(),
  invitationCount: vi.fn(),
  queryRaw: vi.fn(async (..._args: unknown[]) => [] as unknown[]),
  transaction: vi.fn(),
}));

vi.mock('@jetstream/api-config', () => {
  const tx = {
    $queryRaw: mocks.queryRaw,
    team: { findUniqueOrThrow: mocks.teamFindUniqueOrThrow },
    teamMember: { count: mocks.teamMemberCount },
    teamMemberInvitation: { count: mocks.invitationCount },
  };
  return {
    prisma: {
      ...tx,
      $transaction: mocks.transaction.mockImplementation(async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx)),
    },
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    ENV: {},
  };
});

import { prisma } from '@jetstream/api-config';
import { assertSeatAvailable, checkSeatAvailability, getTeamSeatSummary, SeatLimitError, withTeamSeatLock } from '../seat-enforcement';

function mockTeam({
  licenseCountLimit = 5,
  pendingSeatQuantity = null as number | null,
  billingStatus = 'ACTIVE',
  manualBilling = false,
} = {}) {
  mocks.teamFindUniqueOrThrow.mockResolvedValue({
    billingStatus,
    billingAccount: { manualBilling, licenseCountLimit, pendingSeatQuantity, pendingSeatEffectiveAt: null },
  });
}

describe('withTeamSeatLock', () => {
  beforeEach(() => vi.clearAllMocks());

  it('locks the team row inside a ReadCommitted transaction before running the callback', async () => {
    const order: string[] = [];
    mocks.queryRaw.mockImplementation(async () => {
      order.push('lock');
      return [];
    });

    const result = await withTeamSeatLock('team-1', async () => {
      order.push('callback');
      return 'done';
    });

    expect(result).toBe('done');
    expect(order).toEqual(['lock', 'callback']);
    expect(mocks.transaction).toHaveBeenCalledWith(expect.any(Function), expect.objectContaining({ isolationLevel: 'ReadCommitted' }));
    const [strings, teamId] = mocks.queryRaw.mock.calls[0] as unknown as [TemplateStringsArray, string];
    expect(strings.join('?')).toContain('FOR UPDATE');
    expect(teamId).toBe('team-1');
  });
});

describe('getTeamSeatSummary', () => {
  beforeEach(() => vi.clearAllMocks());

  it('counts active billable members and unexpired billable invitations, excluding the member being changed', async () => {
    mockTeam({ licenseCountLimit: 5 });
    mocks.teamMemberCount.mockResolvedValue(3);
    mocks.invitationCount.mockResolvedValue(1);

    const now = new Date('2026-09-10T00:00:00Z');
    const { seats } = await getTeamSeatSummary(prisma, { teamId: 'team-1', excludeUserId: 'user-9', now });

    expect(seats).toEqual(expect.objectContaining({ purchased: 5, used: 3, reserved: 1, available: 1 }));
    expect(mocks.teamMemberCount).toHaveBeenCalledWith({
      where: { teamId: 'team-1', status: 'ACTIVE', role: { in: ['ADMIN', 'MEMBER'] }, userId: { not: 'user-9' } },
    });
    expect(mocks.invitationCount).toHaveBeenCalledWith({
      where: { teamId: 'team-1', role: { in: ['ADMIN', 'MEMBER'] }, expiresAt: { gte: now } },
    });
  });

  it('is unlimited when the team has no billing account', async () => {
    mocks.teamFindUniqueOrThrow.mockResolvedValue({ billingStatus: 'ACTIVE', billingAccount: null });
    mocks.teamMemberCount.mockResolvedValue(2);
    mocks.invitationCount.mockResolvedValue(0);

    const { seats, manualBilling } = await getTeamSeatSummary(prisma, { teamId: 'team-1' });
    expect(seats.isUnlimited).toBe(true);
    expect(manualBilling).toBe(false);
  });
});

describe('assertSeatAvailable', () => {
  beforeEach(() => vi.clearAllMocks());

  it('throws PAST_DUE for both kinds regardless of availability', async () => {
    mockTeam({ licenseCountLimit: 10, billingStatus: 'PAST_DUE' });
    mocks.teamMemberCount.mockResolvedValue(0);
    mocks.invitationCount.mockResolvedValue(0);

    await expect(assertSeatAvailable(prisma, { teamId: 'team-1', kind: 'ADD' })).rejects.toMatchObject({ code: 'PAST_DUE', kind: 'ADD' });
    await expect(assertSeatAvailable(prisma, { teamId: 'team-1', kind: 'ACCEPT_INVITATION' })).rejects.toMatchObject({ code: 'PAST_DUE' });
  });

  it('throws NO_SEATS with the seat snapshot attached when the cap is reached', async () => {
    mockTeam({ licenseCountLimit: 3 });
    mocks.teamMemberCount.mockResolvedValue(2);
    mocks.invitationCount.mockResolvedValue(1);

    const error = await assertSeatAvailable(prisma, { teamId: 'team-1', kind: 'ADD' }).catch((ex) => ex);
    expect(error).toBeInstanceOf(SeatLimitError);
    expect(error.code).toBe('NO_SEATS');
    expect(error.seats).toEqual(expect.objectContaining({ purchased: 3, used: 2, reserved: 1, available: 0 }));
  });

  it('passes when a null limit means unlimited', async () => {
    mockTeam({ licenseCountLimit: null as unknown as number });
    mocks.teamMemberCount.mockResolvedValue(50);
    mocks.invitationCount.mockResolvedValue(50);

    await expect(assertSeatAvailable(prisma, { teamId: 'team-1', kind: 'ADD' })).resolves.toEqual(
      expect.objectContaining({ isUnlimited: true }),
    );
  });
});

describe('checkSeatAvailability', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns the limit error instead of throwing', async () => {
    mockTeam({ licenseCountLimit: 1 });
    mocks.teamMemberCount.mockResolvedValue(1);
    mocks.invitationCount.mockResolvedValue(0);

    const result = await checkSeatAvailability(prisma, { teamId: 'team-1', kind: 'ADD' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('NO_SEATS');
    }
  });

  it('rethrows unexpected errors', async () => {
    mocks.teamFindUniqueOrThrow.mockRejectedValue(new Error('db down'));
    await expect(checkSeatAvailability(prisma, { teamId: 'team-1', kind: 'ADD' })).rejects.toThrow('db down');
  });
});
