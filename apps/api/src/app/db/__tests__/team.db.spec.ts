/**
 * Seat enforcement in the membership paths. A seat is checked only when a change makes a member (or
 * invitation) start consuming one, every check runs inside the team seat lock, and a rejected check
 * aborts before anything is written. The last-admin invariant shares the same lock.
 */
import { Prisma } from '@jetstream/prisma';
import { SeatLimitError } from '@jetstream/team-seats';
import { TeamAccessProfileRequest, TeamInvitationRequest, TeamSeatSummary } from '@jetstream/types';
import { beforeEach, describe, expect, it, Mock, vi } from 'vitest';
import { NotFoundError, UserFacingError } from '../../utils/error-handler';
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
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
    teamMemberInvitation: {
      count: vi.fn(),
      deleteMany: vi.fn(),
      create: vi.fn(),
      findFirst: vi.fn(),
      updateMany: vi.fn(),
    },
    teamAccessProfile: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
    },
    user: {
      findUniqueOrThrow: vi.fn(),
    },
    team: {
      update: vi.fn(),
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  };
  return mock;
});

const teamSeatsMock = vi.hoisted(() => ({
  withTeamSeatLock: vi.fn(),
  assertSeatAvailable: vi.fn(),
  addMemberFromInvitation: vi.fn(),
  findDefaultAccessProfileId: vi.fn(),
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
    PrismaClientKnownRequestError: class extends Error {
      code: string;
      constructor(message: string, { code }: { code: string }) {
        super(message);
        this.code = code;
      }
    },
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
// updateTeamMemberRole validates its request, which requires profile ids to be uuids
const ACCESS_PROFILE_ID = '6b1f8d4e-2c3a-4e5f-9a7b-1c2d3e4f5a6b';
const OTHER_ACCESS_PROFILE_ID = '0d9c8b7a-6f5e-4d3c-8b2a-1f0e9d8c7b6a';

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
  return { role, status, user: { email: 'user@example.com' } };
}

function makeInvitation(overrides: Record<string, unknown> = {}) {
  const now = new Date();
  return {
    id: 'invite-id',
    email: 'invitee@example.com',
    expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
    lastSentAt: now,
    role: 'MEMBER',
    team: { name: 'Test Team' },
    token: 'token',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

/** An access profile row as selected by team.db, including the assignment counts */
function makeAccessProfileRecord({
  members = 0,
  invitations = 0,
  ...overrides
}: { members?: number; invitations?: number } & Record<string, unknown> = {}) {
  const now = new Date();
  return {
    id: 'profile-1',
    name: 'Read only',
    description: null,
    policy: { v: 1, tools: ['query'], operations: [], surfaces: [] },
    isDefault: false,
    version: 1,
    createdAt: now,
    updatedAt: now,
    _count: { members, invitations },
    ...overrides,
  };
}

/**
 * Marks when the team seat lock is released, so a test can assert a call happened inside the locked
 * callback rather than before or after it. Returns the assertion.
 */
function trackTeamSeatLockWindow() {
  const lockReleased = vi.fn();
  teamSeatsMock.withTeamSeatLock.mockImplementation(async (_teamId: string, fn: (tx: unknown) => Promise<unknown>) => {
    try {
      return await fn(prismaMock);
    } finally {
      lockReleased();
    }
  });
  return function expectCalledUnderLock(mockFn: Mock, callIndex = 0) {
    const callOrder = mockFn.mock.invocationCallOrder[callIndex];
    expect(callOrder).toBeGreaterThan(teamSeatsMock.withTeamSeatLock.mock.invocationCallOrder[0]);
    expect(callOrder).toBeLessThan(lockReleased.mock.invocationCallOrder[0]);
  };
}

beforeEach(() => {
  // resetAllMocks (not clearAllMocks) also drains mockResolvedValueOnce queues: the "aborts before the
  // write" tests queue an update result that is never consumed and would leak into the next test.
  vi.resetAllMocks();
  teamSeatsMock.withTeamSeatLock.mockImplementation(async (_teamId: string, fn: (tx: unknown) => Promise<unknown>) => fn(prismaMock));
  teamSeatsMock.assertSeatAvailable.mockResolvedValue(makeSeatSummary());
  teamSeatsMock.addMemberFromInvitation.mockResolvedValue({ role: 'MEMBER', status: 'ACTIVE' });
  // Default: the team has no default access profile, so new invitations get full access
  teamSeatsMock.findDefaultAccessProfileId.mockResolvedValue(null);
  prismaMock.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn(prismaMock));
  // Default: at least one OTHER active admin exists so demotion/deactivation is allowed.
  prismaMock.teamMember.count.mockResolvedValue(1);
  prismaMock.teamMember.findUnique.mockResolvedValue({ role: 'ADMIN', status: 'ACTIVE' });
});

describe('updateTeamMemberRole — seat check transitions', () => {
  async function run(previousRole: string, data: { role?: string; accessProfileId?: string | null }, previousStatus = 'ACTIVE') {
    prismaMock.teamMember.findUniqueOrThrow.mockResolvedValue(makePreReadMember(previousRole, previousStatus));
    prismaMock.teamMember.update.mockResolvedValueOnce(makeFullTeamMember(data.role ?? previousRole, previousStatus));
    return teamDb.updateTeamMemberRole({
      teamId: TEAM_ID,
      userId: USER_ID,
      runningUserId: 'admin-id',
      data: data as any,
    });
  }

  it('access-profile-only update never checks seats', async () => {
    await run('MEMBER', { accessProfileId: null });

    expect(teamSeatsMock.assertSeatAvailable).not.toHaveBeenCalled();
    expect(prismaMock.teamMember.update).toHaveBeenCalledTimes(1);
  });

  it('MEMBER → ADMIN is seat-neutral and never checks', async () => {
    await run('MEMBER', { role: 'ADMIN' });

    expect(teamSeatsMock.assertSeatAvailable).not.toHaveBeenCalled();
    expect(prismaMock.teamMember.update).toHaveBeenCalledTimes(1);
  });

  it('BILLING → MEMBER takes a seat', async () => {
    await run('BILLING', { role: 'MEMBER' });

    expect(teamSeatsMock.withTeamSeatLock).toHaveBeenCalledWith(TEAM_ID, expect.any(Function));
    expect(teamSeatsMock.assertSeatAvailable).toHaveBeenCalledWith(prismaMock, {
      teamId: TEAM_ID,
      kind: 'ADD',
      role: 'MEMBER',
    });
    expect(prismaMock.teamMember.update).toHaveBeenCalledTimes(1);
  });

  it('BILLING → ADMIN takes a seat', async () => {
    await run('BILLING', { role: 'ADMIN' });

    expect(teamSeatsMock.assertSeatAvailable).toHaveBeenCalledWith(prismaMock, {
      teamId: TEAM_ID,
      kind: 'ADD',
      role: 'ADMIN',
    });
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

describe('updateTeamMemberRole — access profile assignment', () => {
  function run(data: { role?: string; accessProfileId?: string | null }) {
    return teamDb.updateTeamMemberRole({ teamId: TEAM_ID, userId: USER_ID, runningUserId: 'admin-id', data: data as any });
  }

  beforeEach(() => {
    // The single read under the lock
    prismaMock.teamMember.findUniqueOrThrow.mockResolvedValue({
      role: 'MEMBER',
      status: 'ACTIVE',
      accessProfileId: OTHER_ACCESS_PROFILE_ID,
      user: { email: 'user@example.com' },
    });
    prismaMock.teamMember.update.mockResolvedValue(makeFullTeamMember('MEMBER'));
  });

  it("rejects another team's profile before the member is written", async () => {
    prismaMock.teamAccessProfile.findFirst.mockResolvedValue(null);

    await expect(run({ accessProfileId: ACCESS_PROFILE_ID })).rejects.toBeInstanceOf(NotFoundError);
    expect(prismaMock.teamAccessProfile.findFirst).toHaveBeenCalledWith({
      select: { id: true },
      where: { id: ACCESS_PROFILE_ID, teamId: TEAM_ID },
    });
    expect(prismaMock.teamMember.update).not.toHaveBeenCalled();
  });

  it('assigns a profile that belongs to the team', async () => {
    prismaMock.teamAccessProfile.findFirst.mockResolvedValue({ id: ACCESS_PROFILE_ID });

    await run({ accessProfileId: ACCESS_PROFILE_ID });

    expect(prismaMock.teamMember.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { accessProfileId: ACCESS_PROFILE_ID, updatedById: 'admin-id' } }),
    );
  });

  it('writes null for an explicit null, which moves the member to full access', async () => {
    await run({ accessProfileId: null });

    expect(prismaMock.teamAccessProfile.findFirst).not.toHaveBeenCalled();
    expect(prismaMock.teamMember.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { accessProfileId: null, updatedById: 'admin-id' } }),
    );
  });

  it('leaves the profile unchanged when the request omits it', async () => {
    await run({ role: 'ADMIN' });

    expect(prismaMock.teamAccessProfile.findFirst).not.toHaveBeenCalled();
    const [{ data }] = prismaMock.teamMember.update.mock.calls[0];
    // An undefined accessProfileId is left untouched by Prisma
    expect(data).toEqual({ role: 'ADMIN', updatedById: 'admin-id' });
  });

  it('reports the previous role, profile and email from the single read under the lock', async () => {
    const expectCalledUnderLock = trackTeamSeatLockWindow();
    prismaMock.teamAccessProfile.findFirst.mockResolvedValue({ id: ACCESS_PROFILE_ID });

    const result = await run({ accessProfileId: ACCESS_PROFILE_ID });

    expect(result.previousMember).toEqual({ role: 'MEMBER', accessProfileId: OTHER_ACCESS_PROFILE_ID, email: 'user@example.com' });
    expect(prismaMock.teamMember.findUniqueOrThrow).toHaveBeenCalledTimes(1);
    expect(prismaMock.teamMember.findUniqueOrThrow).toHaveBeenCalledWith(
      expect.objectContaining({ select: { role: true, status: true, accessProfileId: true, user: { select: { email: true } } } }),
    );
    expectCalledUnderLock(prismaMock.teamMember.findUniqueOrThrow, 0);
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

  it('INACTIVE → ACTIVE MEMBER takes a seat', async () => {
    await run({ previousRole: 'MEMBER', previousStatus: 'INACTIVE', newStatus: 'ACTIVE' });

    expect(teamSeatsMock.withTeamSeatLock).toHaveBeenCalledWith(TEAM_ID, expect.any(Function));
    expect(teamSeatsMock.assertSeatAvailable).toHaveBeenCalledWith(prismaMock, {
      teamId: TEAM_ID,
      kind: 'ADD',
      role: 'MEMBER',
    });
    expect(prismaMock.teamMember.update).toHaveBeenCalledTimes(1);
  });

  it('INACTIVE → ACTIVE as BILLING never checks', async () => {
    await run({ previousRole: 'MEMBER', previousStatus: 'INACTIVE', newRole: 'BILLING', newStatus: 'ACTIVE' });

    expect(teamSeatsMock.assertSeatAvailable).not.toHaveBeenCalled();
    expect(prismaMock.teamMember.update).toHaveBeenCalledTimes(1);
  });

  it('INACTIVE MEMBER → ACTIVE ADMIN takes a seat', async () => {
    await run({ previousRole: 'MEMBER', previousStatus: 'INACTIVE', newRole: 'ADMIN', newStatus: 'ACTIVE' });

    expect(teamSeatsMock.assertSeatAvailable).toHaveBeenCalledWith(prismaMock, {
      teamId: TEAM_ID,
      kind: 'ADD',
      role: 'ADMIN',
    });
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
  function run(role: string, overrides: Partial<TeamInvitationRequest> = {}) {
    return teamDb.createTeamInvitation({
      teamId: TEAM_ID,
      runningUserId: 'admin-id',
      request: { email: 'invitee@example.com', role: role as any, ...overrides },
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
    expect(teamSeatsMock.assertSeatAvailable).toHaveBeenCalledWith(prismaMock, { teamId: TEAM_ID, kind: 'ADD', role: 'MEMBER' });
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

  describe('access profile', () => {
    it("applies the team's default profile when the request omits one", async () => {
      teamSeatsMock.findDefaultAccessProfileId.mockResolvedValue('profile-default');
      prismaMock.teamAccessProfile.findFirst.mockResolvedValue({ id: 'profile-default' });

      await run('MEMBER');

      expect(teamSeatsMock.findDefaultAccessProfileId).toHaveBeenCalledWith(prismaMock, TEAM_ID);
      expect(prismaMock.teamMemberInvitation.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ accessProfileId: 'profile-default' }) }),
      );
    });

    it('creates a full access invitation when the request omits a profile and the team has no default', async () => {
      await run('MEMBER');

      expect(prismaMock.teamAccessProfile.findFirst).not.toHaveBeenCalled();
      expect(prismaMock.teamMemberInvitation.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ accessProfileId: null }) }),
      );
    });

    it('creates a full access invitation for an explicit null, ignoring the team default', async () => {
      teamSeatsMock.findDefaultAccessProfileId.mockResolvedValue('profile-default');

      await run('MEMBER', { accessProfileId: null });

      expect(teamSeatsMock.findDefaultAccessProfileId).not.toHaveBeenCalled();
      expect(prismaMock.teamAccessProfile.findFirst).not.toHaveBeenCalled();
      expect(prismaMock.teamMemberInvitation.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ accessProfileId: null }) }),
      );
    });

    it('checks that a provided profile belongs to the team before using it', async () => {
      prismaMock.teamAccessProfile.findFirst.mockResolvedValue({ id: 'profile-1' });

      await run('MEMBER', { accessProfileId: 'profile-1' });

      expect(teamSeatsMock.findDefaultAccessProfileId).not.toHaveBeenCalled();
      expect(prismaMock.teamAccessProfile.findFirst).toHaveBeenCalledWith({
        select: { id: true },
        where: { id: 'profile-1', teamId: TEAM_ID },
      });
      expect(prismaMock.teamMemberInvitation.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ accessProfileId: 'profile-1' }) }),
      );
    });

    it("rejects another team's profile before the invitation is written", async () => {
      prismaMock.teamAccessProfile.findFirst.mockResolvedValue(null);

      await expect(run('MEMBER', { accessProfileId: 'other-team-profile' })).rejects.toBeInstanceOf(NotFoundError);
      expect(prismaMock.teamMemberInvitation.create).not.toHaveBeenCalled();
    });
  });
});

describe('updateTeamInvitation (resend)', () => {
  const YESTERDAY = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const TOMORROW = new Date(Date.now() + 24 * 60 * 60 * 1000);

  function run({ currentRole, expiresAt, requestRole }: { currentRole: string; expiresAt: Date; requestRole?: string }) {
    prismaMock.teamMemberInvitation.findFirst
      .mockResolvedValueOnce({ email: 'invitee@example.com', role: currentRole, expiresAt })
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
    expect(teamSeatsMock.assertSeatAvailable).toHaveBeenCalledWith(prismaMock, { teamId: TEAM_ID, kind: 'ADD', role: 'MEMBER' });
    expect(prismaMock.teamMemberInvitation.updateMany).toHaveBeenCalledTimes(1);
  });

  it('resending an unexpired billable invitation keeps its seat and never checks', async () => {
    await run({ currentRole: 'MEMBER', expiresAt: TOMORROW });

    expect(teamSeatsMock.assertSeatAvailable).not.toHaveBeenCalled();
    expect(prismaMock.teamMemberInvitation.updateMany).toHaveBeenCalledTimes(1);
  });

  it('moving an unexpired BILLING invitation to MEMBER reserves a seat', async () => {
    await run({ currentRole: 'BILLING', expiresAt: TOMORROW, requestRole: 'MEMBER' });

    expect(teamSeatsMock.assertSeatAvailable).toHaveBeenCalledWith(prismaMock, { teamId: TEAM_ID, kind: 'ADD', role: 'MEMBER' });
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

  it('refuses to resend to someone who has since joined a team, so no second seat is reserved for them', async () => {
    prismaMock.teamMember.findFirst.mockResolvedValueOnce({ teamId: TEAM_ID });

    await expect(run({ currentRole: 'MEMBER', expiresAt: YESTERDAY })).rejects.toThrow(/already a member/);
    expect(prismaMock.teamMember.findFirst).toHaveBeenCalledWith({
      select: { teamId: true },
      where: { user: { email: 'invitee@example.com' } },
    });
    expect(teamSeatsMock.assertSeatAvailable).not.toHaveBeenCalled();
    expect(prismaMock.teamMemberInvitation.updateMany).not.toHaveBeenCalled();
  });
});

describe('updateTeamInvitation — access profile assignment', () => {
  const TOMORROW = new Date(Date.now() + 24 * 60 * 60 * 1000);

  function run(request: { accessProfileId?: string | null }) {
    const nextAccessProfileId = request.accessProfileId === undefined ? OTHER_ACCESS_PROFILE_ID : request.accessProfileId;
    prismaMock.teamMemberInvitation.findFirst
      .mockResolvedValueOnce({
        email: 'invitee@example.com',
        role: 'MEMBER',
        accessProfileId: OTHER_ACCESS_PROFILE_ID,
        expiresAt: TOMORROW,
      })
      .mockResolvedValueOnce(makeInvitation({ accessProfileId: nextAccessProfileId }));
    prismaMock.teamMemberInvitation.updateMany.mockResolvedValueOnce({ count: 1 });
    return teamDb.updateTeamInvitation({
      id: 'invite-id',
      teamId: TEAM_ID,
      expectedRole: 'MEMBER',
      runningUserId: 'admin-id',
      request,
    });
  }

  it("rejects another team's profile before the invitation is updated", async () => {
    prismaMock.teamAccessProfile.findFirst.mockResolvedValue(null);

    await expect(run({ accessProfileId: ACCESS_PROFILE_ID })).rejects.toBeInstanceOf(NotFoundError);
    expect(prismaMock.teamAccessProfile.findFirst).toHaveBeenCalledWith({
      select: { id: true },
      where: { id: ACCESS_PROFILE_ID, teamId: TEAM_ID },
    });
    expect(prismaMock.teamMemberInvitation.updateMany).not.toHaveBeenCalled();
  });

  it('writes null for an explicit null, which moves the invitation to full access', async () => {
    await run({ accessProfileId: null });

    expect(prismaMock.teamAccessProfile.findFirst).not.toHaveBeenCalled();
    const [{ data }] = prismaMock.teamMemberInvitation.updateMany.mock.calls[0];
    expect(data).toHaveProperty('accessProfileId', null);
  });

  it('leaves the profile unchanged when the request omits it', async () => {
    await run({});

    expect(prismaMock.teamAccessProfile.findFirst).not.toHaveBeenCalled();
    const [{ data }] = prismaMock.teamMemberInvitation.updateMany.mock.calls[0];
    expect(data).not.toHaveProperty('accessProfileId');
  });

  it('reports the previous profile from the read under the lock', async () => {
    const expectCalledUnderLock = trackTeamSeatLockWindow();
    prismaMock.teamAccessProfile.findFirst.mockResolvedValue({ id: ACCESS_PROFILE_ID });

    const result = await run({ accessProfileId: ACCESS_PROFILE_ID });

    expect(result.previousAccessProfileId).toBe(OTHER_ACCESS_PROFILE_ID);
    expect(result.accessProfileId).toBe(ACCESS_PROFILE_ID);
    expect(prismaMock.teamMemberInvitation.findFirst).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ select: expect.objectContaining({ accessProfileId: true }), where: { id: 'invite-id', teamId: TEAM_ID } }),
    );
    expectCalledUnderLock(prismaMock.teamMemberInvitation.findFirst, 0);
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
      invitation: expect.objectContaining({ id: 'invite-id', role: 'MEMBER' }),
    });
    expect(result).toEqual({ email: 'invitee@example.com', role: 'MEMBER' });
  });

  it('reports the role from the locked acceptance rather than the pre-lock snapshot', async () => {
    teamSeatsMock.addMemberFromInvitation.mockResolvedValueOnce({ role: 'ADMIN', status: 'ACTIVE' });

    const result = await teamDb.acceptTeamInvitation({ user, teamId: TEAM_ID, token: 'token' });

    expect(result).toEqual({ email: 'invitee@example.com', role: 'ADMIN' });
  });

  it('propagates a seat rejection from addMemberFromInvitation', async () => {
    teamSeatsMock.addMemberFromInvitation.mockRejectedValueOnce(makeSeatLimitError('ACCEPT_INVITATION'));

    await expect(teamDb.acceptTeamInvitation({ user, teamId: TEAM_ID, token: 'token' })).rejects.toBeInstanceOf(SeatLimitError);
  });
});

describe('revokeTeamInvitation', () => {
  it('deletes inside the team seat lock so a concurrent accept cannot lose the invitation mid-transaction', async () => {
    prismaMock.teamMemberInvitation.deleteMany.mockResolvedValue({ count: 1 });

    await teamDb.revokeTeamInvitation({ id: 'invite-id', teamId: TEAM_ID, expectedRole: 'MEMBER' });

    expect(teamSeatsMock.withTeamSeatLock).toHaveBeenCalledWith(TEAM_ID, expect.any(Function));
    expect(prismaMock.teamMemberInvitation.deleteMany).toHaveBeenCalledWith({
      where: { id: 'invite-id', teamId: TEAM_ID, role: 'MEMBER' },
    });
  });

  it('rejects a revoke whose role changed since the authorization check', async () => {
    prismaMock.teamMemberInvitation.deleteMany.mockResolvedValue({ count: 0 });
    prismaMock.teamMemberInvitation.findFirst.mockResolvedValue({ id: 'invite-id' });

    await expect(teamDb.revokeTeamInvitation({ id: 'invite-id', teamId: TEAM_ID, expectedRole: 'MEMBER' })).rejects.toThrow(
      'modified by another admin',
    );
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
        data: { role: 'MEMBER' as any },
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
      data: { role: 'MEMBER' as any },
    });

    expect(result.teamMember.role).toBe('MEMBER');
    expect(prismaMock.teamMember.update).toHaveBeenCalledTimes(1);
  });
});

describe('upsertTeamWithBillingAccount', () => {
  function givenExistingTeam(customerId: string | null) {
    prismaMock.user.findUniqueOrThrow.mockResolvedValue({ email: 'buyer@example.com' });
    prismaMock.teamMember.findFirst.mockResolvedValue({
      userId: USER_ID,
      teamId: TEAM_ID,
      team: { billingAccount: customerId ? { customerId } : null },
    });
    prismaMock.team.update.mockResolvedValue({ id: TEAM_ID });
  }

  it('leaves the team untouched when a different customer completes a Team checkout', async () => {
    // e.g. the buyer opened checkout before accepting an invitation to this team
    givenExistingTeam('cus_team');

    const result = await teamDb.upsertTeamWithBillingAccount({ userId: USER_ID, billingAccountCustomerId: 'cus_buyer' });

    // Not even the status changes, and the caller learns the team is billed elsewhere
    expect(prismaMock.team.update).not.toHaveBeenCalled();
    expect(result).toEqual({ id: TEAM_ID, customerId: 'cus_team' });
  });

  it('leaves the team untouched when checkout was opened for a different team', async () => {
    givenExistingTeam('cus_team');

    const result = await teamDb.upsertTeamWithBillingAccount({
      userId: USER_ID,
      billingAccountCustomerId: 'cus_buyer',
      rebindCustomerForTeamId: 'some-other-team',
    });

    expect(prismaMock.team.update).not.toHaveBeenCalled();
    expect(result).toEqual({ id: TEAM_ID, customerId: 'cus_team' });
  });

  it('moves the billing account to the new customer when checkout was opened for this team', async () => {
    // A team whose Stripe customer was deleted checks out again against a fresh customer
    givenExistingTeam('cus_deleted');

    const result = await teamDb.upsertTeamWithBillingAccount({
      userId: USER_ID,
      billingAccountCustomerId: 'cus_fresh',
      rebindCustomerForTeamId: TEAM_ID,
    });

    const [{ data }] = prismaMock.team.update.mock.calls[0];
    expect(data.billingAccount).toEqual({ update: { customerId: 'cus_fresh', manualBilling: undefined } });
    expect(result).toEqual({ id: TEAM_ID, customerId: 'cus_fresh' });
  });

  it('updates a team that is already on this customer', async () => {
    givenExistingTeam('cus_team');

    const result = await teamDb.upsertTeamWithBillingAccount({
      userId: USER_ID,
      billingAccountCustomerId: 'cus_team',
      manualBilling: false,
    });

    const [{ data }] = prismaMock.team.update.mock.calls[0];
    expect(data.billingAccount).toEqual({ update: { customerId: 'cus_team', manualBilling: false } });
    expect(result).toEqual({ id: TEAM_ID, customerId: 'cus_team' });
  });

  it('creates the billing account on an existing team that has none', async () => {
    givenExistingTeam(null);

    const result = await teamDb.upsertTeamWithBillingAccount({ userId: USER_ID, billingAccountCustomerId: 'cus_buyer' });

    const [{ data }] = prismaMock.team.update.mock.calls[0];
    expect(data.billingAccount).toEqual({ create: { customerId: 'cus_buyer', manualBilling: undefined } });
    expect(result).toEqual({ id: TEAM_ID, customerId: 'cus_buyer' });
  });
});

function makeAccessProfileRequest(overrides: Partial<TeamAccessProfileRequest> = {}): TeamAccessProfileRequest {
  return {
    name: 'Read only',
    description: null,
    isDefault: false,
    policy: { tools: ['query'], operations: [], surfaces: [] },
    ...overrides,
  };
}

describe('createAccessProfile', () => {
  function run(request: TeamAccessProfileRequest) {
    return teamDb.createAccessProfile({ teamId: TEAM_ID, runningUserId: 'admin-id', request });
  }

  it('clears the previous default before creating a new default profile', async () => {
    prismaMock.teamAccessProfile.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.teamAccessProfile.create.mockResolvedValue(makeAccessProfileRecord({ isDefault: true }));

    const result = await run(makeAccessProfileRequest({ isDefault: true }));

    expect(prismaMock.teamAccessProfile.updateMany).toHaveBeenCalledWith({
      where: { teamId: TEAM_ID, isDefault: true },
      data: { isDefault: false },
    });
    expect(prismaMock.teamAccessProfile.updateMany.mock.invocationCallOrder[0]).toBeLessThan(
      prismaMock.teamAccessProfile.create.mock.invocationCallOrder[0],
    );
    expect(prismaMock.teamAccessProfile.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          name: 'Read only',
          description: null,
          isDefault: true,
          policy: { v: 1, tools: ['query'], operations: [], surfaces: [] },
          teamId: TEAM_ID,
          createdById: 'admin-id',
          updatedById: 'admin-id',
        },
      }),
    );
    expect(result).toEqual(expect.objectContaining({ id: 'profile-1', isDefault: true, memberCount: 0, invitationCount: 0 }));
  });

  it('leaves the existing default alone when the new profile is not the default', async () => {
    prismaMock.teamAccessProfile.create.mockResolvedValue(makeAccessProfileRecord());

    await run(makeAccessProfileRequest({ isDefault: false }));

    expect(prismaMock.teamAccessProfile.updateMany).not.toHaveBeenCalled();
    expect(prismaMock.teamAccessProfile.create).toHaveBeenCalledTimes(1);
  });

  it('reports a duplicate name as a user-facing error', async () => {
    prismaMock.teamAccessProfile.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: 'test' }),
    );

    const promise = run(makeAccessProfileRequest());

    await expect(promise).rejects.toBeInstanceOf(UserFacingError);
    await expect(promise).rejects.toThrow('An access profile named "Read only" already exists.');
  });

  it('rethrows any other database error unchanged', async () => {
    const error = new Prisma.PrismaClientKnownRequestError('Foreign key constraint failed', { code: 'P2003', clientVersion: 'test' });
    prismaMock.teamAccessProfile.create.mockRejectedValue(error);

    await expect(run(makeAccessProfileRequest())).rejects.toBe(error);
  });
});

describe('updateAccessProfile', () => {
  function run(request: TeamAccessProfileRequest) {
    return teamDb.updateAccessProfile({ teamId: TEAM_ID, id: 'profile-1', runningUserId: 'admin-id', request });
  }

  it('rejects a profile that belongs to another team before anything is written', async () => {
    prismaMock.teamAccessProfile.findFirst.mockResolvedValue(null);

    await expect(run(makeAccessProfileRequest({ isDefault: true }))).rejects.toBeInstanceOf(NotFoundError);
    expect(teamSeatsMock.withTeamSeatLock).toHaveBeenCalledWith(TEAM_ID, expect.any(Function));
    expect(prismaMock.teamAccessProfile.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'profile-1', teamId: TEAM_ID } }),
    );
    expect(prismaMock.teamAccessProfile.updateMany).not.toHaveBeenCalled();
    expect(prismaMock.teamAccessProfile.update).not.toHaveBeenCalled();
  });

  it('clears the previous default under the lock before saving the new default', async () => {
    const expectCalledUnderLock = trackTeamSeatLockWindow();
    prismaMock.teamAccessProfile.findFirst.mockResolvedValue(makeAccessProfileRecord());
    prismaMock.teamAccessProfile.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.teamAccessProfile.update.mockResolvedValue(makeAccessProfileRecord({ isDefault: true, version: 2 }));

    await run(makeAccessProfileRequest({ isDefault: true }));

    expect(prismaMock.teamAccessProfile.updateMany).toHaveBeenCalledWith({
      where: { teamId: TEAM_ID, isDefault: true, id: { not: 'profile-1' } },
      data: { isDefault: false },
    });
    expectCalledUnderLock(prismaMock.teamAccessProfile.updateMany);
    expect(prismaMock.teamAccessProfile.updateMany.mock.invocationCallOrder[0]).toBeLessThan(
      prismaMock.teamAccessProfile.update.mock.invocationCallOrder[0],
    );
  });

  it('leaves the existing default alone when the profile is not the default', async () => {
    prismaMock.teamAccessProfile.findFirst.mockResolvedValue(makeAccessProfileRecord());
    prismaMock.teamAccessProfile.update.mockResolvedValue(makeAccessProfileRecord({ version: 2 }));

    await run(makeAccessProfileRequest({ isDefault: false }));

    expect(prismaMock.teamAccessProfile.updateMany).not.toHaveBeenCalled();
    expect(prismaMock.teamAccessProfile.update).toHaveBeenCalledTimes(1);
  });

  it('increments the version and returns the profile from before and after the edit', async () => {
    prismaMock.teamAccessProfile.findFirst.mockResolvedValue(makeAccessProfileRecord({ members: 3 }));
    prismaMock.teamAccessProfile.update.mockResolvedValue(makeAccessProfileRecord({ name: 'Renamed', version: 2, members: 3 }));

    const result = await run(makeAccessProfileRequest({ name: 'Renamed' }));

    expect(prismaMock.teamAccessProfile.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'profile-1' },
        data: {
          name: 'Renamed',
          description: null,
          isDefault: false,
          policy: { v: 1, tools: ['query'], operations: [], surfaces: [] },
          version: { increment: 1 },
          updatedById: 'admin-id',
        },
      }),
    );
    expect(result.previousAccessProfile).toEqual(expect.objectContaining({ name: 'Read only', version: 1 }));
    expect(result.accessProfile).toEqual(expect.objectContaining({ name: 'Renamed', version: 2, memberCount: 3 }));
  });

  it('reports a rename to a name that is already taken as a user-facing error', async () => {
    prismaMock.teamAccessProfile.findFirst.mockResolvedValue(makeAccessProfileRecord());
    prismaMock.teamAccessProfile.update.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: 'test' }),
    );

    const promise = run(makeAccessProfileRequest({ name: 'Admins' }));

    await expect(promise).rejects.toBeInstanceOf(UserFacingError);
    await expect(promise).rejects.toThrow('An access profile named "Admins" already exists.');
  });
});

describe('deleteAccessProfile', () => {
  function run(reassignToAccessProfileId?: string | null) {
    return teamDb.deleteAccessProfile({ teamId: TEAM_ID, id: 'profile-1', runningUserId: 'admin-id', reassignToAccessProfileId });
  }

  function expectNothingWritten() {
    expect(prismaMock.teamMember.updateMany).not.toHaveBeenCalled();
    expect(prismaMock.teamMemberInvitation.updateMany).not.toHaveBeenCalled();
    expect(prismaMock.teamAccessProfile.delete).not.toHaveBeenCalled();
  }

  beforeEach(() => {
    prismaMock.teamMember.findMany.mockResolvedValue([]);
    prismaMock.teamMember.updateMany.mockResolvedValue({ count: 0 });
    prismaMock.teamMemberInvitation.updateMany.mockResolvedValue({ count: 0 });
    prismaMock.teamAccessProfile.delete.mockResolvedValue({});
  });

  it('rejects a profile that does not belong to the team', async () => {
    prismaMock.teamAccessProfile.findFirst.mockResolvedValue(null);

    await expect(run(null)).rejects.toBeInstanceOf(NotFoundError);
    expect(prismaMock.teamAccessProfile.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'profile-1', teamId: TEAM_ID } }),
    );
    expectNothingWritten();
  });

  it.each([
    ['members', { members: 2, invitations: 0 }],
    ['invitations', { members: 0, invitations: 1 }],
  ])('refuses to delete a profile still assigned to %s without a reassignment target', async (_assignee, counts) => {
    prismaMock.teamAccessProfile.findFirst.mockResolvedValue(makeAccessProfileRecord(counts));

    await expect(run()).rejects.toThrow(/still assigned/);
    expect(teamSeatsMock.withTeamSeatLock).toHaveBeenCalledWith(TEAM_ID, expect.any(Function));
    expectNothingWritten();
  });

  it('refuses to move members to the profile that is being deleted', async () => {
    prismaMock.teamAccessProfile.findFirst.mockResolvedValue(makeAccessProfileRecord({ members: 1 }));

    await expect(run('profile-1')).rejects.toThrow(/cannot be moved to the profile that is being deleted/);
    expectNothingWritten();
  });

  it('rejects a reassignment target from another team before anything is written', async () => {
    prismaMock.teamAccessProfile.findFirst.mockResolvedValueOnce(makeAccessProfileRecord({ members: 1 })).mockResolvedValueOnce(null);

    await expect(run('other-team-profile')).rejects.toBeInstanceOf(NotFoundError);
    expect(prismaMock.teamAccessProfile.findFirst).toHaveBeenLastCalledWith({
      select: { id: true },
      where: { id: 'other-team-profile', teamId: TEAM_ID },
    });
    expectNothingWritten();
  });

  it('moves members and invitations to the target profile, then deletes', async () => {
    prismaMock.teamAccessProfile.findFirst
      .mockResolvedValueOnce(makeAccessProfileRecord({ members: 2, invitations: 1 }))
      .mockResolvedValueOnce({ id: 'profile-2' });
    prismaMock.teamMember.findMany.mockResolvedValue([{ userId: 'user-a' }, { userId: 'user-b' }]);
    prismaMock.teamMember.updateMany.mockResolvedValue({ count: 2 });
    prismaMock.teamMemberInvitation.updateMany.mockResolvedValue({ count: 1 });

    const result = await run('profile-2');

    expect(teamSeatsMock.withTeamSeatLock).toHaveBeenCalledWith(TEAM_ID, expect.any(Function));
    expect(prismaMock.teamMember.updateMany).toHaveBeenCalledWith({
      where: { teamId: TEAM_ID, accessProfileId: 'profile-1' },
      data: { accessProfileId: 'profile-2', updatedById: 'admin-id' },
    });
    expect(prismaMock.teamMemberInvitation.updateMany).toHaveBeenCalledWith({
      where: { teamId: TEAM_ID, accessProfileId: 'profile-1' },
      data: { accessProfileId: 'profile-2', updatedById: 'admin-id' },
    });
    expect(prismaMock.teamAccessProfile.delete).toHaveBeenCalledWith({ where: { id: 'profile-1' } });
    // Assignments must be moved first, the foreign key refuses to delete a profile that is still referenced
    const deleteCallOrder = prismaMock.teamAccessProfile.delete.mock.invocationCallOrder[0];
    expect(prismaMock.teamMember.updateMany.mock.invocationCallOrder[0]).toBeLessThan(deleteCallOrder);
    expect(prismaMock.teamMemberInvitation.updateMany.mock.invocationCallOrder[0]).toBeLessThan(deleteCallOrder);
    expect(result).toEqual({
      deletedAccessProfile: expect.objectContaining({ id: 'profile-1', memberCount: 2, invitationCount: 1 }),
      reassignedUserIds: ['user-a', 'user-b'],
      reassignedInvitationCount: 1,
    });
  });

  it('moves members and invitations to full access when the target is null', async () => {
    prismaMock.teamAccessProfile.findFirst.mockResolvedValue(makeAccessProfileRecord({ members: 1, invitations: 1 }));
    prismaMock.teamMember.findMany.mockResolvedValue([{ userId: 'user-a' }]);
    prismaMock.teamMemberInvitation.updateMany.mockResolvedValue({ count: 1 });

    await run(null);

    expect(prismaMock.teamAccessProfile.findFirst).toHaveBeenCalledTimes(1);
    expect(prismaMock.teamMember.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { accessProfileId: null, updatedById: 'admin-id' } }),
    );
    expect(prismaMock.teamMemberInvitation.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { accessProfileId: null, updatedById: 'admin-id' } }),
    );
    expect(prismaMock.teamAccessProfile.delete).toHaveBeenCalledWith({ where: { id: 'profile-1' } });
  });

  it('deletes an unassigned profile without a reassignment target', async () => {
    prismaMock.teamAccessProfile.findFirst.mockResolvedValue(makeAccessProfileRecord());

    const result = await run();

    expect(prismaMock.teamMember.updateMany).not.toHaveBeenCalled();
    expect(prismaMock.teamAccessProfile.delete).toHaveBeenCalledWith({ where: { id: 'profile-1' } });
    expect(result).toEqual(expect.objectContaining({ reassignedUserIds: [], reassignedInvitationCount: 0 }));
  });

  it('counts only the invitations the dashboard still lists when deciding whether the profile is in use', async () => {
    prismaMock.teamAccessProfile.findFirst.mockResolvedValue(makeAccessProfileRecord());

    await run();

    const [{ select }] = prismaMock.teamAccessProfile.findFirst.mock.calls[0];
    const countedSince: Date = select._count.select.invitations.where.expiresAt.gte;
    const listedSince = Date.now() - teamDb.TEAM_INVITE_EXPIRES_DAYS * 24 * 60 * 60 * 1000;
    expect(Math.abs(countedSince.getTime() - listedSince)).toBeLessThan(60_000);
  });
});
