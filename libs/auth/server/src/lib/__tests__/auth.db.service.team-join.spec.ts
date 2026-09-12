/**
 * Seat enforcement on the two login-time paths that add a user to a team without going through the
 * team dashboard: domain auto-join for a brand-new user, and accepting a pending invitation while
 * signing in. Neither may take a seat the team does not have, and neither may block the login
 * itself: the user is created (or signed in) without the membership and the denial is audited.
 */
import { AuditLogAction } from '@jetstream/audit-logs';
import { SeatLimitError } from '@jetstream/team-seats';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handleSignInOrRegistration } from '../auth.db.service';

const prismaMock = vi.hoisted(() => ({
  user: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    findFirstOrThrow: vi.fn(),
  },
  teamMemberInvitation: {
    findFirst: vi.fn(),
    deleteMany: vi.fn(),
  },
  authIdentity: {
    findUniqueOrThrow: vi.fn(),
    update: vi.fn(),
  },
  $transaction: vi.fn(),
}));

const teamSeatsMock = vi.hoisted(() => ({
  withTeamSeatLock: vi.fn(),
  checkSeatAvailability: vi.fn(),
  addMemberFromInvitation: vi.fn(),
}));

const auditLogMock = vi.hoisted(() => ({ createTeamAuditLog: vi.fn() }));

vi.mock('@jetstream/api-config', () => ({
  ENV: { JETSTREAM_AUTH_2FA_EMAIL_DEFAULT_VALUE: false },
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  prisma: prismaMock,
  DbCacheProvider: class {
    static cleanupExpired = vi.fn();
    consumeOnceAsync = vi.fn();
  },
}));

// The lock runs its callback against the prisma mock; SeatLimitError and the seat math stay real.
vi.mock('@jetstream/team-seats', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@jetstream/team-seats')>();
  return { ...actual, ...teamSeatsMock };
});

vi.mock('@jetstream/audit-logs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@jetstream/audit-logs')>();
  return { ...actual, ...auditLogMock };
});

const TEAM_ID = 'team-1';
const USER_ID = 'user-1';
const EMAIL = 'new@example.com';

const providerUser = {
  id: 'google-1',
  email: EMAIL,
  emailVerified: true,
  username: 'new',
  name: 'New User',
  givenName: null,
  familyName: null,
  picture: null,
};

const seats = {
  purchased: 5,
  pending: null,
  pendingEffectiveAt: null,
  effective: 5,
  used: 5,
  reserved: 0,
  available: 0,
  isUnlimited: false,
  isOverAllocated: false,
  includedSeats: 0,
};

function makeSeatLimitError(kind: 'ADD' | 'ACCEPT_INVITATION') {
  return new SeatLimitError({ code: 'NO_SEATS', teamId: TEAM_ID, kind, seats });
}

function makeUser(teamMembership: { teamId: string; role: string; status: string } | null) {
  return {
    id: USER_ID,
    userId: `google|${providerUser.id}`,
    name: providerUser.name,
    email: EMAIL,
    emailVerified: true,
    tosAcceptedVersion: null,
    authFactors: [],
    teamMembership,
  };
}

/** A pending invitation whose team login configuration optionally auto-joins new users by domain. */
function makeInvite({ autoAddToTeam }: { autoAddToTeam: boolean }) {
  return {
    id: 'invite-1',
    email: EMAIL,
    role: 'MEMBER',
    features: ['ALL'],
    createdById: 'admin-1',
    team: {
      id: TEAM_ID,
      name: 'Test Team',
      loginConfig: {
        id: '11111111-1111-4111-8111-111111111111',
        allowedMfaMethods: ['email', 'otp'],
        allowedProviders: ['google', 'credentials'],
        allowIdentityLinking: true,
        domains: ['example.com'],
        autoAddToTeam,
        ssoProvider: 'NONE',
        ssoEnabled: false,
        ssoJitProvisioningEnabled: false,
        requireMfa: false,
        team: { id: TEAM_ID },
      },
    },
  };
}

function signInWithGoogle() {
  return handleSignInOrRegistration({
    providerType: 'oauth',
    provider: 'google',
    providerUser,
    teamInvite: { token: 'token-1', teamId: TEAM_ID },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  teamSeatsMock.withTeamSeatLock.mockImplementation(async (_teamId: string, fn: (tx: unknown) => Promise<unknown>) => fn(prismaMock));
  prismaMock.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn(prismaMock));
  teamSeatsMock.checkSeatAvailability.mockResolvedValue({ ok: true, seats });
  teamSeatsMock.addMemberFromInvitation.mockResolvedValue({ role: 'MEMBER', status: 'ACTIVE' });
  prismaMock.user.update.mockResolvedValue({});
  prismaMock.teamMemberInvitation.deleteMany.mockResolvedValue({ count: 1 });
  // Reload after accepting the invitation returns the user with their new membership
  prismaMock.user.findFirstOrThrow.mockResolvedValue(makeUser({ teamId: TEAM_ID, role: 'MEMBER', status: 'ACTIVE' }));
});

describe('domain auto-join for a new user', () => {
  beforeEach(() => {
    prismaMock.teamMemberInvitation.findFirst.mockResolvedValue(makeInvite({ autoAddToTeam: true }));
    // No user for this provider id and none with this email: registration path
    prismaMock.user.findFirst.mockResolvedValue(null);
    prismaMock.user.findMany.mockResolvedValue([]);
  });

  it('checks for a new seat (ADD) under the team lock and attaches the membership when one is free', async () => {
    prismaMock.user.create.mockResolvedValue(makeUser({ teamId: TEAM_ID, role: 'MEMBER', status: 'ACTIVE' }));

    await signInWithGoogle();

    expect(teamSeatsMock.withTeamSeatLock).toHaveBeenCalledWith(TEAM_ID, expect.any(Function));
    expect(teamSeatsMock.checkSeatAvailability).toHaveBeenCalledWith(prismaMock, { teamId: TEAM_ID, kind: 'ADD' });
    expect(prismaMock.user.create.mock.calls[0][0].data.teamMembership).toEqual({
      create: { teamId: TEAM_ID, role: 'MEMBER', status: 'ACTIVE' },
    });
    expect(auditLogMock.createTeamAuditLog).not.toHaveBeenCalledWith(
      expect.objectContaining({ action: AuditLogAction.TEAM_MEMBER_ADD_BLOCKED_NO_SEATS }),
    );
  });

  it('creates the user WITHOUT a membership and audits the denial when no seat is available', async () => {
    teamSeatsMock.checkSeatAvailability.mockResolvedValue({ ok: false, error: makeSeatLimitError('ADD') });
    prismaMock.user.create.mockResolvedValue(makeUser(null));

    await signInWithGoogle();

    expect(prismaMock.user.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.user.create.mock.calls[0][0].data.teamMembership).toBeUndefined();
    expect(auditLogMock.createTeamAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        teamId: TEAM_ID,
        action: AuditLogAction.TEAM_MEMBER_ADD_BLOCKED_NO_SEATS,
        metadata: expect.objectContaining({
          attemptedAction: 'AUTO_JOIN',
          code: 'NO_SEATS',
          kind: 'ADD',
          targetEmail: EMAIL,
          role: 'MEMBER',
        }),
      }),
    );
  });
});

describe('accepting a pending invitation during login', () => {
  const existingUser = makeUser(null);

  beforeEach(() => {
    prismaMock.teamMemberInvitation.findFirst.mockResolvedValue(makeInvite({ autoAddToTeam: false }));
    prismaMock.user.findFirst.mockResolvedValue(existingUser);
    // Identity attributes already match the provider payload, so no update is attempted
    prismaMock.authIdentity.findUniqueOrThrow.mockResolvedValue({
      isPrimary: true,
      provider: 'google',
      providerAccountId: providerUser.id,
      email: EMAIL,
      name: providerUser.name,
      emailVerified: true,
      username: providerUser.username,
      familyName: null,
      givenName: null,
      picture: null,
    });
  });

  it('delegates to addMemberFromInvitation under the team lock and returns the reloaded user', async () => {
    const result = await signInWithGoogle();

    expect(teamSeatsMock.withTeamSeatLock).toHaveBeenCalledWith(TEAM_ID, expect.any(Function));
    expect(teamSeatsMock.addMemberFromInvitation).toHaveBeenCalledWith(prismaMock, {
      teamId: TEAM_ID,
      userId: USER_ID,
      invitation: expect.objectContaining({ id: 'invite-1', role: 'MEMBER', features: ['ALL'] }),
    });
    expect(result.user.teamMembership).toEqual({ teamId: TEAM_ID, role: 'MEMBER', status: 'ACTIVE' });
  });

  it('signs the user in without the team, leaves the invitation untouched, and audits the denial when no seat is available', async () => {
    teamSeatsMock.addMemberFromInvitation.mockRejectedValueOnce(makeSeatLimitError('ACCEPT_INVITATION'));

    const result = await signInWithGoogle();

    expect(result.user.teamMembership).toBeNull();
    expect(prismaMock.user.findFirstOrThrow).not.toHaveBeenCalled();
    expect(prismaMock.teamMemberInvitation.deleteMany).not.toHaveBeenCalled();
    expect(auditLogMock.createTeamAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: USER_ID,
        teamId: TEAM_ID,
        action: AuditLogAction.TEAM_MEMBER_ADD_BLOCKED_NO_SEATS,
        resourceId: USER_ID,
        metadata: expect.objectContaining({
          attemptedAction: 'ACCEPT_INVITATION_ON_LOGIN',
          code: 'NO_SEATS',
          kind: 'ACCEPT_INVITATION',
          targetEmail: EMAIL,
          targetUserId: USER_ID,
          role: 'MEMBER',
        }),
      }),
    );
  });
});
