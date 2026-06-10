/**
 * Regression coverage for the isBillableAction transition matrix in updateTeamMemberRole
 * and updateTeamMemberStatusAndRole. Earlier these used only one end of the transition
 * (previous role for one, new role for the other), which meant BILLING→MEMBER/ADMIN or
 * MEMBER/ADMIN→BILLING would skip the Stripe sync — leaving the billable-seat count in
 * Stripe out of sync with actual team composition. Fix looks at both ends of the transition.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as teamDb from '../team.db';

const prismaMock = vi.hoisted(() => {
  const mock: any = {
    teamMember: {
      findUniqueOrThrow: vi.fn(),
      // The last-admin guard re-reads the target's current role/status transactionally via findUnique.
      findUnique: vi.fn(),
      update: vi.fn(),
      findFirst: vi.fn(),
      // The last-admin invariant counts OTHER active admins; default to 1 so a demotion/deactivation
      // is allowed and the existing isBillableAction tests are unaffected.
      count: vi.fn().mockResolvedValue(1),
    },
    team: {
      // canAddBillableMember (called internally by updateTeamMemberRole/StatusAndRole when
      // transitioning TO a billable role) fetches the team; return an unconstrained billing
      // account so the quota check always passes and we can focus on the isBillableAction result.
      findFirstOrThrow: vi.fn().mockResolvedValue({
        id: 'team-id',
        billingStatus: 'ACTIVE',
        billingAccount: null,
        members: [],
      }),
    },
  };
  // updateTeamMember* run the last-admin check + update inside a Serializable transaction; invoke
  // the callback with the same mock so tx.teamMember.* resolve to the mocks configured per test.
  mock.$transaction = vi.fn(async (fn: any) => fn(mock));
  return mock;
});

vi.mock('@jetstream/api-config', () => ({
  ENV: {},
  getExceptionLog: (error: unknown) => ({ error: error instanceof Error ? error.message : error }),
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  prisma: prismaMock,
  DbCacheProvider: vi.fn().mockImplementation(function () {
    this.saveAsync = vi.fn().mockResolvedValue(null);
    this.getAsync = vi.fn().mockResolvedValue(null);
    this.removeAsync = vi.fn().mockResolvedValue(null);
    this.consumeOnceAsync = vi.fn().mockResolvedValue(true);
  }),
  rollbarServer: { error: vi.fn(), warn: vi.fn() },
}));

vi.mock('@jetstream/prisma', () => ({
  Prisma: {
    PrismaClientKnownRequestError: class extends Error {},
    TransactionIsolationLevel: { Serializable: 'Serializable' },
  },
}));

function makeFullTeamMember(role: string, status = 'ACTIVE') {
  const now = new Date();
  return {
    teamId: 'team-id',
    userId: 'user-id',
    role,
    status,
    features: ['ALL'],
    createdAt: now,
    updatedAt: now,
    user: {
      id: 'user-id',
      email: 'user@example.com',
      name: 'Test User',
      lastLoggedIn: null,
      emailVerified: true,
      passwordUpdatedAt: null,
      hasPasswordSet: false,
      authFactors: [],
      identities: [],
    },
  };
}

function makePreReadMember(role: string, status = 'ACTIVE') {
  return { role, status, features: ['ALL'], user: { email: 'user@example.com' } };
}

describe('updateTeamMemberRole — isBillableAction transition matrix', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Restore the default "team with no billing quota" mock that clearAllMocks wiped above.
    prismaMock.team.findFirstOrThrow.mockResolvedValue({
      id: 'team-id',
      billingStatus: 'ACTIVE',
      billingAccount: null,
      members: [],
    });
    // Default: at least one OTHER active admin exists, and the update transaction runs inline.
    prismaMock.teamMember.count.mockResolvedValue(1);
    prismaMock.$transaction.mockImplementation(async (fn: any) => fn(prismaMock));
  });

  async function run(previousRole: string, newRole: string) {
    prismaMock.teamMember.findUniqueOrThrow.mockResolvedValueOnce(makePreReadMember(previousRole));
    prismaMock.teamMember.update.mockResolvedValueOnce(makeFullTeamMember(newRole));
    return teamDb.updateTeamMemberRole({
      teamId: 'team-id',
      userId: 'user-id',
      runningUserId: 'admin-id',
      data: { role: newRole as any, features: ['ALL'] },
    });
  }

  it('BILLING → MEMBER fires isBillableAction (new seat becomes billable)', async () => {
    const { isBillableAction } = await run('BILLING', 'MEMBER');
    expect(isBillableAction).toBe(true);
  });

  it('BILLING → ADMIN fires isBillableAction', async () => {
    const { isBillableAction } = await run('BILLING', 'ADMIN');
    expect(isBillableAction).toBe(true);
  });

  it('MEMBER → BILLING fires isBillableAction (seat leaves billable set, Stripe needs decrement)', async () => {
    const { isBillableAction } = await run('MEMBER', 'BILLING');
    expect(isBillableAction).toBe(true);
  });

  it('ADMIN → BILLING fires isBillableAction', async () => {
    const { isBillableAction } = await run('ADMIN', 'BILLING');
    expect(isBillableAction).toBe(true);
  });

  it('MEMBER → ADMIN fires isBillableAction (both billable, over-sync is acceptable)', async () => {
    const { isBillableAction } = await run('MEMBER', 'ADMIN');
    expect(isBillableAction).toBe(true);
  });

  it('BILLING → BILLING does NOT fire isBillableAction (both non-billable)', async () => {
    const { isBillableAction } = await run('BILLING', 'BILLING');
    expect(isBillableAction).toBe(false);
  });
});

describe('updateTeamMemberStatusAndRole — isBillableAction transition matrix', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.team.findFirstOrThrow.mockResolvedValue({
      id: 'team-id',
      billingStatus: 'ACTIVE',
      billingAccount: null,
      members: [],
    });
    // Default: at least one OTHER active admin exists, and the update transaction runs inline.
    prismaMock.teamMember.count.mockResolvedValue(1);
    prismaMock.$transaction.mockImplementation(async (fn: any) => fn(prismaMock));
  });

  async function run({
    previousRole,
    previousStatus = 'ACTIVE',
    newRole,
    newStatus,
  }: {
    previousRole: string;
    previousStatus?: string;
    newRole?: string;
    newStatus: string;
  }) {
    prismaMock.teamMember.findUniqueOrThrow.mockResolvedValueOnce(makePreReadMember(previousRole, previousStatus));
    prismaMock.teamMember.update.mockResolvedValueOnce(makeFullTeamMember(newRole ?? previousRole, newStatus));
    return teamDb.updateTeamMemberStatusAndRole({
      teamId: 'team-id',
      userId: 'user-id',
      runningUserId: 'admin-id',
      status: newStatus as any,
      role: (newRole ?? undefined) as any,
    });
  }

  it('MEMBER → BILLING (status unchanged) fires isBillableAction', async () => {
    const { isBillableAction } = await run({ previousRole: 'MEMBER', newRole: 'BILLING', newStatus: 'ACTIVE' });
    expect(isBillableAction).toBe(true);
  });

  it('BILLING → MEMBER (status unchanged) fires isBillableAction', async () => {
    const { isBillableAction } = await run({ previousRole: 'BILLING', newRole: 'MEMBER', newStatus: 'ACTIVE' });
    expect(isBillableAction).toBe(true);
  });

  it('MEMBER ACTIVE → INACTIVE (role unchanged) fires isBillableAction', async () => {
    const { isBillableAction } = await run({ previousRole: 'MEMBER', previousStatus: 'ACTIVE', newStatus: 'INACTIVE' });
    expect(isBillableAction).toBe(true);
  });

  it('BILLING ACTIVE → INACTIVE (role unchanged) does NOT fire isBillableAction', async () => {
    const { isBillableAction } = await run({ previousRole: 'BILLING', previousStatus: 'ACTIVE', newStatus: 'INACTIVE' });
    expect(isBillableAction).toBe(false);
  });

  it('NOOP (same status, same role) returns isBillableAction=false without a DB update', async () => {
    prismaMock.teamMember.findUniqueOrThrow
      .mockResolvedValueOnce(makePreReadMember('ADMIN', 'ACTIVE'))
      .mockResolvedValueOnce(makeFullTeamMember('ADMIN', 'ACTIVE'));

    const { isBillableAction } = await teamDb.updateTeamMemberStatusAndRole({
      teamId: 'team-id',
      userId: 'user-id',
      runningUserId: 'admin-id',
      status: 'ACTIVE' as any,
      role: 'ADMIN' as any,
    });

    expect(isBillableAction).toBe(false);
    expect(prismaMock.teamMember.update).not.toHaveBeenCalled();
  });
});

describe('last-admin invariant', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.team.findFirstOrThrow.mockResolvedValue({
      id: 'team-id',
      billingStatus: 'ACTIVE',
      billingAccount: null,
      members: [],
    });
    prismaMock.teamMember.count.mockResolvedValue(1);
    prismaMock.$transaction.mockImplementation(async (fn: any) => fn(prismaMock));
    // The guard re-reads the target's current role/status transactionally; default to active admin.
    prismaMock.teamMember.findUnique.mockResolvedValue({ role: 'ADMIN', status: 'ACTIVE' });
  });

  it('rejects deactivating the last active admin', async () => {
    prismaMock.teamMember.findUniqueOrThrow.mockResolvedValueOnce(makePreReadMember('ADMIN', 'ACTIVE'));
    prismaMock.teamMember.findUnique.mockResolvedValueOnce({ role: 'ADMIN', status: 'ACTIVE' });
    prismaMock.teamMember.count.mockResolvedValueOnce(0); // no OTHER active admins remain

    await expect(
      teamDb.updateTeamMemberStatusAndRole({
        teamId: 'team-id',
        userId: 'user-id',
        runningUserId: 'admin-id',
        status: 'INACTIVE' as any,
      }),
    ).rejects.toThrow(/at least one active administrator/i);
    expect(prismaMock.teamMember.update).not.toHaveBeenCalled();
  });

  it('rejects demoting the last active admin to MEMBER', async () => {
    prismaMock.teamMember.findUniqueOrThrow.mockResolvedValueOnce(makePreReadMember('ADMIN', 'ACTIVE'));
    prismaMock.teamMember.findUnique.mockResolvedValueOnce({ role: 'ADMIN', status: 'ACTIVE' });
    prismaMock.teamMember.count.mockResolvedValueOnce(0);

    await expect(
      teamDb.updateTeamMemberRole({
        teamId: 'team-id',
        userId: 'user-id',
        runningUserId: 'admin-id',
        data: { role: 'MEMBER' as any, features: ['ALL'] },
      }),
    ).rejects.toThrow(/at least one active administrator/i);
    expect(prismaMock.teamMember.update).not.toHaveBeenCalled();
  });

  it('allows deactivating an admin when another active admin remains', async () => {
    prismaMock.teamMember.findUniqueOrThrow.mockResolvedValueOnce(makePreReadMember('ADMIN', 'ACTIVE'));
    prismaMock.teamMember.findUnique.mockResolvedValueOnce({ role: 'ADMIN', status: 'ACTIVE' });
    prismaMock.teamMember.count.mockResolvedValueOnce(1); // one OTHER active admin remains
    prismaMock.teamMember.update.mockResolvedValueOnce(makeFullTeamMember('ADMIN', 'INACTIVE'));

    const result = await teamDb.updateTeamMemberStatusAndRole({
      teamId: 'team-id',
      userId: 'user-id',
      runningUserId: 'admin-id',
      status: 'INACTIVE' as any,
    });

    expect(result.teamMember.status).toBe('INACTIVE');
    expect(prismaMock.teamMember.update).toHaveBeenCalledTimes(1);
  });

  it('allows demoting an already-INACTIVE admin even when no other active admins exist', async () => {
    // Demoting a member who is not currently an active admin cannot reduce the active-admin count,
    // so the invariant must not block it (guards against a false positive).
    prismaMock.teamMember.findUniqueOrThrow.mockResolvedValueOnce(makePreReadMember('ADMIN', 'INACTIVE'));
    prismaMock.teamMember.findUnique.mockResolvedValueOnce({ role: 'ADMIN', status: 'INACTIVE' });
    prismaMock.teamMember.count.mockResolvedValueOnce(0); // would wrongly reject if current state were ignored
    prismaMock.teamMember.update.mockResolvedValueOnce(makeFullTeamMember('MEMBER', 'INACTIVE'));

    const result = await teamDb.updateTeamMemberRole({
      teamId: 'team-id',
      userId: 'user-id',
      runningUserId: 'admin-id',
      data: { role: 'MEMBER' as any, features: ['ALL'] },
    });

    expect(result.teamMember.role).toBe('MEMBER');
    expect(prismaMock.teamMember.update).toHaveBeenCalledTimes(1);
  });
});
