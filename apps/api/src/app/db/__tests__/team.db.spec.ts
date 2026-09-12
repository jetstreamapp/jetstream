/**
 * Seat enforcement in the membership paths. A seat is checked only when a change makes a member (or
 * invitation) start consuming one, every check runs inside the team seat lock, and a rejected check
 * aborts before anything is written. The last-admin invariant shares the same lock.
 */
import { SeatLimitError } from '@jetstream/team-seats';
import { TeamSeatSummary } from '@jetstream/types';
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
      count: vi.fn(),
    },
    teamMemberInvitation: {
      count: vi.fn(),
      deleteMany: vi.fn(),
      create: vi.fn(),
      findFirst: vi.fn(),
      updateMany: vi.fn(),
    },
    user: {
      findUniqueOrThrow: vi.fn(),
    },
  };
  return mock;
});

const teamSeatsMock = vi.hoisted(() => ({
  withTeamSeatLock: vi.fn(),
  assertSeatAvailable: vi.fn(),
  addMemberFromInvitation: vi.fn(),
}));

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
    TransactionIsolationLevel: { ReadCommitted: 'ReadCommitted', Serializable: 'Serializable' },
  },
}));

// The lock runs the callback against the same prisma mock so tx.* calls resolve to the per-test
// mocks; the seat math helpers (isBillableRole, isSeatConsumingMember, ...) stay real.
vi.mock('@jetstream/team-seats', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@jetstream/team-seats')>();
  return { ...actual, ...teamSeatsMock };
});

const TEAM_ID = 'team-id';
const USER_ID = 'user-id';

function makeSeatSummary(overrides: Partial<TeamSeatSummary> = {}): TeamSeatSummary {
  return {
    purchased: 5,
    pending: null,
    pendingEffectiveAt: null,
    effective: 5,
    used: 2,
    reserved: 1,
    available: 2,
    includedSeats: 0,
    isUnlimited: false,
    isOverAllocated: false,
    ...overrides,
  };
}

function makeSeatLimitError(kind: 'ADD' | 'ACCEPT_INVITATION' = 'ADD') {
  return new SeatLimitError({ code: 'NO_SEATS', teamId: TEAM_ID, kind, seats: makeSeatSummary({ available: 0 }) });
}

function makeFullTeamMember(role: string, status = 'ACTIVE') {
  const now = new Date();
  return {
    teamId: TEAM_ID,
    userId: USER_ID,
    role,
    status,
    features: ['ALL'],
    createdAt: now,
    updatedAt: now,
    user: {
      id: USER_ID,
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

function makeInvitation(overrides: Record<string, unknown> = {}) {
  const now = new Date();
  return {
    id: 'invite-id',
    email: 'invitee@example.com',
    expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
    features: ['ALL'],
    lastSentAt: now,
    role: 'MEMBER',
    team: { name: 'Test Team' },
    token: 'token',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

beforeEach(() => {
  // resetAllMocks (not clearAllMocks) also drains mockResolvedValueOnce queues: the "aborts before the
  // write" tests queue an update result that is never consumed and would leak into the next test.
  vi.resetAllMocks();
  teamSeatsMock.withTeamSeatLock.mockImplementation(async (_teamId: string, fn: (tx: unknown) => Promise<unknown>) => fn(prismaMock));
  teamSeatsMock.assertSeatAvailable.mockResolvedValue(makeSeatSummary());
  teamSeatsMock.addMemberFromInvitation.mockResolvedValue({ role: 'MEMBER', status: 'ACTIVE' });
  // Default: at least one OTHER active admin exists so demotion/deactivation is allowed.
  prismaMock.teamMember.count.mockResolvedValue(1);
  prismaMock.teamMember.findUnique.mockResolvedValue({ role: 'ADMIN', status: 'ACTIVE' });
});

describe('updateTeamMemberRole — seat check transitions', () => {
  async function run(previousRole: string, data: { role?: string; features?: string[] }, previousStatus = 'ACTIVE') {
    prismaMock.teamMember.findUniqueOrThrow.mockResolvedValue(makePreReadMember(previousRole, previousStatus));
    prismaMock.teamMember.update.mockResolvedValueOnce(makeFullTeamMember(data.role ?? previousRole, previousStatus));
    return teamDb.updateTeamMemberRole({
      teamId: TEAM_ID,
      userId: USER_ID,
      runningUserId: 'admin-id',
      data: data as any,
    });
  }

  it('features-only update never checks seats', async () => {
    await run('MEMBER', { features: ['QUERY'] });

    expect(teamSeatsMock.assertSeatAvailable).not.toHaveBeenCalled();
    expect(prismaMock.teamMember.update).toHaveBeenCalledTimes(1);
  });

  it('MEMBER → ADMIN is seat-neutral and never checks', async () => {
    await run('MEMBER', { role: 'ADMIN' });

    expect(teamSeatsMock.assertSeatAvailable).not.toHaveBeenCalled();
    expect(prismaMock.teamMember.update).toHaveBeenCalledTimes(1);
  });

  it('BILLING → MEMBER takes a seat, checked with the member excluded from the count', async () => {
    await run('BILLING', { role: 'MEMBER' });

    expect(teamSeatsMock.withTeamSeatLock).toHaveBeenCalledWith(TEAM_ID, expect.any(Function));
    expect(teamSeatsMock.assertSeatAvailable).toHaveBeenCalledWith(prismaMock, { teamId: TEAM_ID, kind: 'ADD', excludeUserId: USER_ID });
    expect(prismaMock.teamMember.update).toHaveBeenCalledTimes(1);
  });

  it('BILLING → ADMIN takes a seat', async () => {
    await run('BILLING', { role: 'ADMIN' });

    expect(teamSeatsMock.assertSeatAvailable).toHaveBeenCalledWith(prismaMock, { teamId: TEAM_ID, kind: 'ADD', excludeUserId: USER_ID });
  });

  it('MEMBER → BILLING releases a seat and never checks', async () => {
    await run('MEMBER', { role: 'BILLING' });

    expect(teamSeatsMock.assertSeatAvailable).not.toHaveBeenCalled();
  });

  it('BILLING → MEMBER on an INACTIVE member never checks (an inactive member consumes nothing)', async () => {
    await run('BILLING', { role: 'MEMBER' }, 'INACTIVE');

    expect(teamSeatsMock.assertSeatAvailable).not.toHaveBeenCalled();
  });

  it('a rejected seat check aborts before the update is written', async () => {
    teamSeatsMock.assertSeatAvailable.mockRejectedValueOnce(makeSeatLimitError());

    await expect(run('BILLING', { role: 'MEMBER' })).rejects.toBeInstanceOf(SeatLimitError);
    expect(prismaMock.teamMember.update).not.toHaveBeenCalled();
  });
});

describe('updateTeamMemberStatusAndRole — seat check transitions', () => {
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
    prismaMock.teamMember.findUniqueOrThrow.mockResolvedValue(makePreReadMember(previousRole, previousStatus));
    prismaMock.teamMember.update.mockResolvedValueOnce(makeFullTeamMember(newRole ?? previousRole, newStatus));
    return teamDb.updateTeamMemberStatusAndRole({
      teamId: TEAM_ID,
      userId: USER_ID,
      runningUserId: 'admin-id',
      status: newStatus as any,
      role: (newRole ?? undefined) as any,
    });
  }

  it('INACTIVE → ACTIVE MEMBER takes a seat, checked with the member excluded', async () => {
    await run({ previousRole: 'MEMBER', previousStatus: 'INACTIVE', newStatus: 'ACTIVE' });

    expect(teamSeatsMock.withTeamSeatLock).toHaveBeenCalledWith(TEAM_ID, expect.any(Function));
    expect(teamSeatsMock.assertSeatAvailable).toHaveBeenCalledWith(prismaMock, { teamId: TEAM_ID, kind: 'ADD', excludeUserId: USER_ID });
    expect(prismaMock.teamMember.update).toHaveBeenCalledTimes(1);
  });

  it('INACTIVE → ACTIVE as BILLING never checks', async () => {
    await run({ previousRole: 'MEMBER', previousStatus: 'INACTIVE', newRole: 'BILLING', newStatus: 'ACTIVE' });

    expect(teamSeatsMock.assertSeatAvailable).not.toHaveBeenCalled();
    expect(prismaMock.teamMember.update).toHaveBeenCalledTimes(1);
  });

  it('INACTIVE MEMBER → ACTIVE ADMIN takes a seat', async () => {
    await run({ previousRole: 'MEMBER', previousStatus: 'INACTIVE', newRole: 'ADMIN', newStatus: 'ACTIVE' });

    expect(teamSeatsMock.assertSeatAvailable).toHaveBeenCalledWith(prismaMock, { teamId: TEAM_ID, kind: 'ADD', excludeUserId: USER_ID });
  });

  it('ACTIVE → INACTIVE never checks', async () => {
    await run({ previousRole: 'MEMBER', previousStatus: 'ACTIVE', newStatus: 'INACTIVE' });

    expect(teamSeatsMock.assertSeatAvailable).not.toHaveBeenCalled();
    expect(prismaMock.teamMember.update).toHaveBeenCalledTimes(1);
  });

  it('ACTIVE MEMBER → ACTIVE ADMIN keeps the seat it already holds and never checks', async () => {
    await run({ previousRole: 'MEMBER', previousStatus: 'ACTIVE', newRole: 'ADMIN', newStatus: 'ACTIVE' });

    expect(teamSeatsMock.assertSeatAvailable).not.toHaveBeenCalled();
  });

  it('NOOP (same status, same role) neither checks seats nor writes', async () => {
    prismaMock.teamMember.findUniqueOrThrow
      .mockResolvedValueOnce(makePreReadMember('ADMIN', 'ACTIVE'))
      .mockResolvedValueOnce(makeFullTeamMember('ADMIN', 'ACTIVE'));

    await teamDb.updateTeamMemberStatusAndRole({
      teamId: TEAM_ID,
      userId: USER_ID,
      runningUserId: 'admin-id',
      status: 'ACTIVE' as any,
      role: 'ADMIN' as any,
    });

    expect(teamSeatsMock.assertSeatAvailable).not.toHaveBeenCalled();
    expect(teamSeatsMock.withTeamSeatLock).not.toHaveBeenCalled();
    expect(prismaMock.teamMember.update).not.toHaveBeenCalled();
  });

  it('a rejected seat check aborts before the update is written', async () => {
    teamSeatsMock.assertSeatAvailable.mockRejectedValueOnce(makeSeatLimitError());

    await expect(run({ previousRole: 'MEMBER', previousStatus: 'INACTIVE', newStatus: 'ACTIVE' })).rejects.toBeInstanceOf(SeatLimitError);
    expect(prismaMock.teamMember.update).not.toHaveBeenCalled();
  });
});

describe('createTeamInvitation', () => {
  function run(role: string) {
    return teamDb.createTeamInvitation({
      teamId: TEAM_ID,
      runningUserId: 'admin-id',
      request: { email: 'invitee@example.com', role: role as any, features: ['ALL'] },
    });
  }

  beforeEach(() => {
    // No existing member or unexpired invitation for the email
    prismaMock.teamMember.count.mockResolvedValue(0);
    prismaMock.teamMemberInvitation.count.mockResolvedValue(0);
    prismaMock.teamMemberInvitation.deleteMany.mockResolvedValue({ count: 0 });
    prismaMock.teamMemberInvitation.create.mockResolvedValue(makeInvitation());
  });

  it('a MEMBER invitation reserves a seat inside the team lock', async () => {
    await run('MEMBER');

    expect(teamSeatsMock.withTeamSeatLock).toHaveBeenCalledWith(TEAM_ID, expect.any(Function));
    expect(teamSeatsMock.assertSeatAvailable).toHaveBeenCalledWith(prismaMock, { teamId: TEAM_ID, kind: 'ADD' });
    expect(prismaMock.teamMemberInvitation.create).toHaveBeenCalledTimes(1);
  });

  it('a BILLING invitation never checks seats', async () => {
    await run('BILLING');

    expect(teamSeatsMock.assertSeatAvailable).not.toHaveBeenCalled();
    expect(prismaMock.teamMemberInvitation.create).toHaveBeenCalledTimes(1);
  });

  it('a rejected seat check aborts before the invitation is written', async () => {
    teamSeatsMock.assertSeatAvailable.mockRejectedValueOnce(makeSeatLimitError());

    await expect(run('MEMBER')).rejects.toBeInstanceOf(SeatLimitError);
    expect(prismaMock.teamMemberInvitation.create).not.toHaveBeenCalled();
  });

  it('an email that already belongs to a team member is rejected before any seat check', async () => {
    prismaMock.teamMember.count.mockResolvedValueOnce(1);

    await expect(run('MEMBER')).rejects.toThrow(/already a member/i);
    expect(teamSeatsMock.assertSeatAvailable).not.toHaveBeenCalled();
    expect(prismaMock.teamMemberInvitation.create).not.toHaveBeenCalled();
  });
});

describe('updateTeamInvitation (resend)', () => {
  const YESTERDAY = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const TOMORROW = new Date(Date.now() + 24 * 60 * 60 * 1000);

  function run({ currentRole, expiresAt, requestRole }: { currentRole: string; expiresAt: Date; requestRole?: string }) {
    prismaMock.teamMemberInvitation.findFirst
      .mockResolvedValueOnce({ role: currentRole, expiresAt })
      .mockResolvedValueOnce(makeInvitation({ role: requestRole ?? currentRole }));
    prismaMock.teamMemberInvitation.updateMany.mockResolvedValueOnce({ count: 1 });
    return teamDb.updateTeamInvitation({
      id: 'invite-id',
      teamId: TEAM_ID,
      expectedRole: currentRole,
      runningUserId: 'admin-id',
      request: { role: requestRole as any },
    });
  }

  it('resending an expired billable invitation re-reserves a seat', async () => {
    await run({ currentRole: 'MEMBER', expiresAt: YESTERDAY });

    expect(teamSeatsMock.withTeamSeatLock).toHaveBeenCalledWith(TEAM_ID, expect.any(Function));
    expect(teamSeatsMock.assertSeatAvailable).toHaveBeenCalledWith(prismaMock, { teamId: TEAM_ID, kind: 'ADD' });
    expect(prismaMock.teamMemberInvitation.updateMany).toHaveBeenCalledTimes(1);
  });

  it('resending an unexpired billable invitation keeps its seat and never checks', async () => {
    await run({ currentRole: 'MEMBER', expiresAt: TOMORROW });

    expect(teamSeatsMock.assertSeatAvailable).not.toHaveBeenCalled();
    expect(prismaMock.teamMemberInvitation.updateMany).toHaveBeenCalledTimes(1);
  });

  it('moving an unexpired BILLING invitation to MEMBER reserves a seat', async () => {
    await run({ currentRole: 'BILLING', expiresAt: TOMORROW, requestRole: 'MEMBER' });

    expect(teamSeatsMock.assertSeatAvailable).toHaveBeenCalledWith(prismaMock, { teamId: TEAM_ID, kind: 'ADD' });
  });

  it('resending an expired BILLING invitation never checks', async () => {
    await run({ currentRole: 'BILLING', expiresAt: YESTERDAY });

    expect(teamSeatsMock.assertSeatAvailable).not.toHaveBeenCalled();
  });

  it('a rejected seat check aborts before the invitation is updated', async () => {
    teamSeatsMock.assertSeatAvailable.mockRejectedValueOnce(makeSeatLimitError());

    await expect(run({ currentRole: 'MEMBER', expiresAt: YESTERDAY })).rejects.toBeInstanceOf(SeatLimitError);
    expect(prismaMock.teamMemberInvitation.updateMany).not.toHaveBeenCalled();
  });
});

describe('acceptTeamInvitation', () => {
  const user = { id: USER_ID, email: 'invitee@example.com', name: 'Invitee', emailVerified: true } as any;

  beforeEach(() => {
    prismaMock.user.findUniqueOrThrow.mockResolvedValue({
      id: USER_ID,
      email: 'invitee@example.com',
      hasPasswordSet: true,
      authFactors: [],
      identities: [],
    });
    prismaMock.teamMemberInvitation.findFirst.mockResolvedValue(
      makeInvitation({ team: { id: TEAM_ID, name: 'Test Team', loginConfig: null } }),
    );
  });

  it('delegates to addMemberFromInvitation inside the team seat lock', async () => {
    const result = await teamDb.acceptTeamInvitation({ user, teamId: TEAM_ID, token: 'token' });

    expect(teamSeatsMock.withTeamSeatLock).toHaveBeenCalledWith(TEAM_ID, expect.any(Function));
    expect(teamSeatsMock.addMemberFromInvitation).toHaveBeenCalledWith(prismaMock, {
      teamId: TEAM_ID,
      userId: USER_ID,
      invitation: expect.objectContaining({ id: 'invite-id', role: 'MEMBER', features: ['ALL'] }),
    });
    expect(result).toEqual({ email: 'invitee@example.com', role: 'MEMBER', features: ['ALL'] });
  });

  it('propagates a seat rejection from addMemberFromInvitation', async () => {
    teamSeatsMock.addMemberFromInvitation.mockRejectedValueOnce(makeSeatLimitError('ACCEPT_INVITATION'));

    await expect(teamDb.acceptTeamInvitation({ user, teamId: TEAM_ID, token: 'token' })).rejects.toBeInstanceOf(SeatLimitError);
  });
});

describe('last-admin invariant', () => {
  it('rejects deactivating the last active admin', async () => {
    prismaMock.teamMember.findUniqueOrThrow.mockResolvedValue(makePreReadMember('ADMIN', 'ACTIVE'));
    prismaMock.teamMember.findUnique.mockResolvedValueOnce({ role: 'ADMIN', status: 'ACTIVE' });
    prismaMock.teamMember.count.mockResolvedValueOnce(0); // no OTHER active admins remain

    await expect(
      teamDb.updateTeamMemberStatusAndRole({
        teamId: TEAM_ID,
        userId: USER_ID,
        runningUserId: 'admin-id',
        status: 'INACTIVE' as any,
      }),
    ).rejects.toThrow(/at least one active administrator/i);
    expect(prismaMock.teamMember.update).not.toHaveBeenCalled();
  });

  it('rejects demoting the last active admin to MEMBER', async () => {
    prismaMock.teamMember.findUniqueOrThrow.mockResolvedValue(makePreReadMember('ADMIN', 'ACTIVE'));
    prismaMock.teamMember.findUnique.mockResolvedValueOnce({ role: 'ADMIN', status: 'ACTIVE' });
    prismaMock.teamMember.count.mockResolvedValueOnce(0);

    await expect(
      teamDb.updateTeamMemberRole({
        teamId: TEAM_ID,
        userId: USER_ID,
        runningUserId: 'admin-id',
        data: { role: 'MEMBER' as any, features: ['ALL'] },
      }),
    ).rejects.toThrow(/at least one active administrator/i);
    expect(prismaMock.teamMember.update).not.toHaveBeenCalled();
  });

  it('allows deactivating an admin when another active admin remains', async () => {
    prismaMock.teamMember.findUniqueOrThrow.mockResolvedValue(makePreReadMember('ADMIN', 'ACTIVE'));
    prismaMock.teamMember.findUnique.mockResolvedValueOnce({ role: 'ADMIN', status: 'ACTIVE' });
    prismaMock.teamMember.count.mockResolvedValueOnce(1); // one OTHER active admin remains
    prismaMock.teamMember.update.mockResolvedValueOnce(makeFullTeamMember('ADMIN', 'INACTIVE'));

    const result = await teamDb.updateTeamMemberStatusAndRole({
      teamId: TEAM_ID,
      userId: USER_ID,
      runningUserId: 'admin-id',
      status: 'INACTIVE' as any,
    });

    expect(result.teamMember.status).toBe('INACTIVE');
    expect(prismaMock.teamMember.update).toHaveBeenCalledTimes(1);
  });

  it('allows demoting an already-INACTIVE admin even when no other active admins exist', async () => {
    // Demoting a member who is not currently an active admin cannot reduce the active-admin count,
    // so the invariant must not block it (guards against a false positive).
    prismaMock.teamMember.findUniqueOrThrow.mockResolvedValue(makePreReadMember('ADMIN', 'INACTIVE'));
    prismaMock.teamMember.findUnique.mockResolvedValueOnce({ role: 'ADMIN', status: 'INACTIVE' });
    prismaMock.teamMember.count.mockResolvedValueOnce(0); // would wrongly reject if current state were ignored
    prismaMock.teamMember.update.mockResolvedValueOnce(makeFullTeamMember('MEMBER', 'INACTIVE'));

    const result = await teamDb.updateTeamMemberRole({
      teamId: TEAM_ID,
      userId: USER_ID,
      runningUserId: 'admin-id',
      data: { role: 'MEMBER' as any, features: ['ALL'] },
    });

    expect(result.teamMember.role).toBe('MEMBER');
    expect(prismaMock.teamMember.update).toHaveBeenCalledTimes(1);
  });
});
