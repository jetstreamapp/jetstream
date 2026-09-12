import { SeatLimitError } from '@jetstream/team-seats';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getLoginConfiguration } from '../auth.db.service';
import { SsoLicenseLimitExceeded } from '../auth.errors';
import { handleSsoLogin, linkSsoIdentity, resolveSsoUser } from '../sso-auth.service';

const loggerMock = vi.hoisted(() => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }));

const prismaMock = vi.hoisted(() => ({
  authIdentity: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
  },
  user: {
    findMany: vi.fn(),
    create: vi.fn(),
    findFirstOrThrow: vi.fn(),
    update: vi.fn(),
  },
  teamMember: {
    create: vi.fn(),
  },
  teamMemberInvitation: {
    findFirst: vi.fn(),
    deleteMany: vi.fn(),
  },
  webExtensionToken: {
    updateMany: vi.fn(),
  },
  $transaction: vi.fn(),
}));

const teamSeatsMock = vi.hoisted(() => ({
  withTeamSeatLock: vi.fn(),
  assertSeatAvailable: vi.fn(),
  addMemberFromInvitation: vi.fn(),
}));

const auditLogMock = vi.hoisted(() => ({ createTeamAuditLog: vi.fn() }));

const prismaErrorMock = vi.hoisted(() => {
  class PrismaUniqueConstraintError extends Error {}
  return {
    PrismaUniqueConstraintError,
    isPrismaError: vi.fn(() => false),
    toTypedPrismaError: vi.fn(() => null),
  };
});

vi.mock('@jetstream/api-config', () => ({
  ENV: {},
  logger: loggerMock,
  prisma: prismaMock,
}));

vi.mock('@jetstream/prisma', () => ({
  isPrismaError: prismaErrorMock.isPrismaError,
  PrismaUniqueConstraintError: prismaErrorMock.PrismaUniqueConstraintError,
  toTypedPrismaError: prismaErrorMock.toTypedPrismaError,
}));

// The lock runs its callback against the prisma mock; seat math (isBillableRole) and SeatLimitError stay real.
vi.mock('@jetstream/team-seats', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@jetstream/team-seats')>();
  return { ...actual, ...teamSeatsMock };
});

vi.mock('@jetstream/audit-logs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@jetstream/audit-logs')>();
  return { ...actual, ...auditLogMock };
});

vi.mock('@jetstream/auth/types', () => ({
  AuthenticatedUserSchema: {
    parse: (value: unknown) => value,
  },
}));

vi.mock('../auth-logging.db.service', () => ({ createUserActivity: vi.fn() }));

vi.mock('../auth.db.service', () => ({
  AuthenticatedUserSelect: {},
  discoverSsoByDomain: vi.fn(),
  getLoginConfiguration: vi.fn(),
}));

vi.mock('../auth.service', () => ({ initSession: vi.fn() }));

const fakeUser = (overrides: Record<string, unknown> = {}) => ({
  id: 'user-1',
  email: 'user@example.com',
  ...overrides,
});

/** Make the next error thrown pass isUniqueConstraintError(). */
function makeUniqueConstraintThrow(): Error {
  const err = new Error('unique_violation');
  prismaErrorMock.isPrismaError.mockReturnValueOnce(true);
  prismaErrorMock.toTypedPrismaError.mockReturnValueOnce(new prismaErrorMock.PrismaUniqueConstraintError() as any);
  return err;
}

describe('resolveSsoUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaErrorMock.isPrismaError.mockReturnValue(false);
    prismaErrorMock.toTypedPrismaError.mockReturnValue(null);
    prismaMock.$transaction.mockImplementation(async (operations: unknown[]) => operations);
  });

  it('returns the user identified by subject when an AuthIdentity matches', async () => {
    prismaMock.authIdentity.findFirst.mockResolvedValueOnce({ user: fakeUser() });

    const result = await resolveSsoUser({
      provider: 'saml',
      email: 'user@example.com',
      subject: 'nameid-abc-123',
      teamId: 'team-1',
      samlConfigurationId: 'saml-1',
    });

    expect(result).toEqual(fakeUser());
    expect(prismaMock.authIdentity.findFirst).toHaveBeenCalledTimes(1);
    expect(prismaMock.authIdentity.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          provider: 'saml',
          providerAccountId: 'nameid-abc-123',
          samlConfigurationId: 'saml-1',
        }),
      }),
    );
    expect(prismaMock.user.findMany).not.toHaveBeenCalled();
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('falls back to legacy email-keyed identity and migrates it to the subject key', async () => {
    prismaMock.authIdentity.findFirst
      .mockResolvedValueOnce(null) // lookup by subject misses
      .mockResolvedValueOnce({ user: fakeUser() }); // legacy email lookup hits

    const result = await resolveSsoUser({
      provider: 'saml',
      email: 'user@example.com',
      subject: 'nameid-abc-123',
      teamId: 'team-1',
      samlConfigurationId: 'saml-1',
    });

    expect(result).toEqual(fakeUser());
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(prismaMock.authIdentity.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { provider_providerAccountId: { provider: 'saml', providerAccountId: 'user@example.com' } },
        data: { providerAccountId: 'nameid-abc-123' },
      }),
    );
    expect(prismaMock.webExtensionToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-1', provider: 'saml', providerAccountId: 'user@example.com' },
        data: { providerAccountId: 'nameid-abc-123' },
      }),
    );
    expect(prismaMock.user.findMany).not.toHaveBeenCalled();
  });

  it('throws SsoAmbiguousAccount when multiple users share the email and none can be disambiguated by team', async () => {
    prismaMock.authIdentity.findFirst.mockResolvedValue(null);
    prismaMock.user.findMany.mockResolvedValueOnce([fakeUser({ id: 'user-1' }), fakeUser({ id: 'user-2' })]);

    await expect(
      resolveSsoUser({
        provider: 'saml',
        email: 'user@example.com',
        subject: 'nameid-abc-123',
        teamId: 'team-1',
        samlConfigurationId: 'saml-1',
      }),
    ).rejects.toMatchObject({ type: 'SsoAmbiguousAccount' });

    expect(loggerMock.warn).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'user@example.com', matchCount: 2, teamMatchCount: 0 }),
      expect.stringContaining('multiple users share this email'),
    );
  });

  it('disambiguates multiple email matches by preferring the user already in this team', async () => {
    prismaMock.authIdentity.findFirst.mockResolvedValue(null);
    prismaMock.user.findMany.mockResolvedValueOnce([
      fakeUser({ id: 'user-1', teamMembership: { teamId: 'team-other' } }),
      fakeUser({ id: 'user-2', teamMembership: { teamId: 'team-1' } }),
    ]);

    const result = await resolveSsoUser({
      provider: 'saml',
      email: 'user@example.com',
      subject: 'nameid-abc-123',
      teamId: 'team-1',
      samlConfigurationId: 'saml-1',
    });

    expect(result).toMatchObject({ id: 'user-2' });
  });

  it('throws SsoAmbiguousAccount when multiple users with this email are members of the same team', async () => {
    prismaMock.authIdentity.findFirst.mockResolvedValue(null);
    prismaMock.user.findMany.mockResolvedValueOnce([
      fakeUser({ id: 'user-1', teamMembership: { teamId: 'team-1' } }),
      fakeUser({ id: 'user-2', teamMembership: { teamId: 'team-1' } }),
    ]);

    await expect(
      resolveSsoUser({
        provider: 'saml',
        email: 'user@example.com',
        subject: 'nameid-abc-123',
        teamId: 'team-1',
        samlConfigurationId: 'saml-1',
      }),
    ).rejects.toMatchObject({ type: 'SsoAmbiguousAccount' });

    expect(loggerMock.warn).toHaveBeenCalledWith(
      expect.objectContaining({ matchCount: 2, teamMatchCount: 2 }),
      expect.stringContaining('multiple users share this email'),
    );
  });

  it('returns the single matching user via email fallback when no identity exists yet', async () => {
    prismaMock.authIdentity.findFirst.mockResolvedValue(null);
    prismaMock.user.findMany.mockResolvedValueOnce([fakeUser()]);

    const result = await resolveSsoUser({
      provider: 'saml',
      email: 'user@example.com',
      subject: 'nameid-abc-123',
      teamId: 'team-1',
      samlConfigurationId: 'saml-1',
    });

    expect(result).toEqual(fakeUser());
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('returns null when no identity and no user matches (triggers JIT in caller)', async () => {
    prismaMock.authIdentity.findFirst.mockResolvedValue(null);
    prismaMock.user.findMany.mockResolvedValueOnce([]);

    const result = await resolveSsoUser({
      provider: 'oidc',
      email: 'new@example.com',
      subject: 'sub-999',
      teamId: 'team-1',
      oidcConfigurationId: 'oidc-1',
    });

    expect(result).toBeNull();
  });

  it('skips subject lookup when IdP did not provide a subject', async () => {
    prismaMock.authIdentity.findFirst.mockResolvedValueOnce({ user: fakeUser() });

    const result = await resolveSsoUser({
      provider: 'saml',
      email: 'user@example.com',
      subject: undefined,
      teamId: 'team-1',
      samlConfigurationId: 'saml-1',
    });

    expect(result).toEqual(fakeUser());
    expect(prismaMock.authIdentity.findFirst).toHaveBeenCalledTimes(1);
    expect(prismaMock.authIdentity.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ providerAccountId: 'user@example.com' }),
      }),
    );
  });

  it('does not migrate the identity key when subject equals email (no-op case)', async () => {
    prismaMock.authIdentity.findFirst.mockResolvedValueOnce({ user: fakeUser() });

    await resolveSsoUser({
      provider: 'saml',
      email: 'user@example.com',
      subject: 'user@example.com',
      teamId: 'team-1',
      samlConfigurationId: 'saml-1',
    });

    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(prismaMock.authIdentity.update).not.toHaveBeenCalled();
  });

  it('blocks the login when a non-constraint migration failure occurs (avoids orphan rows)', async () => {
    prismaMock.authIdentity.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ user: fakeUser() });
    prismaMock.$transaction.mockRejectedValueOnce(new Error('db unavailable'));

    await expect(
      resolveSsoUser({
        provider: 'saml',
        email: 'user@example.com',
        subject: 'nameid-abc-123',
        teamId: 'team-1',
        samlConfigurationId: 'saml-1',
      }),
    ).rejects.toMatchObject({ type: 'SsoInvalidAction' });

    expect(loggerMock.error).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1', email: 'user@example.com', subject: 'nameid-abc-123' }),
      expect.stringContaining('blocking login to avoid creating an orphan'),
    );
  });

  it('throws SsoAmbiguousAccount when the migration hits a unique-constraint violation', async () => {
    prismaMock.authIdentity.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ user: fakeUser() });
    prismaMock.$transaction.mockRejectedValueOnce(makeUniqueConstraintThrow());

    await expect(
      resolveSsoUser({
        provider: 'saml',
        email: 'user@example.com',
        subject: 'nameid-abc-123',
        teamId: 'team-1',
        samlConfigurationId: 'saml-1',
      }),
    ).rejects.toMatchObject({ type: 'SsoAmbiguousAccount' });

    expect(loggerMock.error).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1', subject: 'nameid-abc-123' }),
      expect.stringContaining('migration blocked'),
    );
  });

  it('scopes OIDC identity lookups by oidcConfigurationId', async () => {
    prismaMock.authIdentity.findFirst.mockResolvedValueOnce({ user: fakeUser() });

    await resolveSsoUser({
      provider: 'oidc',
      email: 'user@example.com',
      subject: 'sub-xyz',
      teamId: 'team-1',
      oidcConfigurationId: 'oidc-1',
    });

    expect(prismaMock.authIdentity.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          provider: 'oidc',
          providerAccountId: 'sub-xyz',
          oidcConfigurationId: 'oidc-1',
        }),
      }),
    );
    const calledArgs = prismaMock.authIdentity.findFirst.mock.calls[0]?.[0] as { where: Record<string, unknown> };
    expect(calledArgs.where).not.toHaveProperty('samlConfigurationId');
  });
});

describe('linkSsoIdentity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a new identity row keyed by subject when none exists', async () => {
    prismaMock.authIdentity.findUnique.mockResolvedValueOnce(null);

    await linkSsoIdentity(
      'user-1',
      'saml',
      'user@example.com',
      { email: 'user@example.com', userName: 'user', subject: 'nameid-abc' },
      { samlConfigurationId: 'saml-1' },
    );

    expect(prismaMock.authIdentity.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'user-1',
          provider: 'saml',
          providerAccountId: 'nameid-abc',
          samlConfigurationId: 'saml-1',
          oidcConfigurationId: undefined,
        }),
      }),
    );
  });

  it('falls back to email-keyed identity when IdP did not provide a subject', async () => {
    prismaMock.authIdentity.findUnique.mockResolvedValueOnce(null);

    await linkSsoIdentity(
      'user-1',
      'saml',
      'user@example.com',
      { email: 'user@example.com', userName: 'user' },
      { samlConfigurationId: 'saml-1' },
    );

    expect(prismaMock.authIdentity.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { provider_providerAccountId: { provider: 'saml', providerAccountId: 'user@example.com' } },
      }),
    );
    expect(prismaMock.authIdentity.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ providerAccountId: 'user@example.com' }),
      }),
    );
  });

  it('no-ops when the existing identity already belongs to this user', async () => {
    prismaMock.authIdentity.findUnique.mockResolvedValueOnce({ userId: 'user-1' });

    await linkSsoIdentity(
      'user-1',
      'saml',
      'user@example.com',
      { email: 'user@example.com', userName: 'user', subject: 'nameid-abc' },
      { samlConfigurationId: 'saml-1' },
    );

    expect(prismaMock.authIdentity.create).not.toHaveBeenCalled();
  });

  it('throws SsoInvalidAction when called with neither or both config ids', async () => {
    await expect(
      linkSsoIdentity('user-1', 'saml', 'user@example.com', { email: 'user@example.com', userName: 'user', subject: 'nameid-abc' }, {}),
    ).rejects.toMatchObject({ type: 'SsoInvalidAction' });

    await expect(
      linkSsoIdentity(
        'user-1',
        'saml',
        'user@example.com',
        { email: 'user@example.com', userName: 'user', subject: 'nameid-abc' },
        { samlConfigurationId: 'saml-1', oidcConfigurationId: 'oidc-1' },
      ),
    ).rejects.toMatchObject({ type: 'SsoInvalidAction' });

    expect(prismaMock.authIdentity.findUnique).not.toHaveBeenCalled();
    expect(prismaMock.authIdentity.create).not.toHaveBeenCalled();
  });

  it('throws SsoAmbiguousAccount when an identity row exists for a different user', async () => {
    prismaMock.authIdentity.findUnique.mockResolvedValueOnce({ userId: 'other-user' });

    await expect(
      linkSsoIdentity(
        'user-1',
        'saml',
        'user@example.com',
        { email: 'user@example.com', userName: 'user', subject: 'nameid-abc' },
        { samlConfigurationId: 'saml-1' },
      ),
    ).rejects.toMatchObject({ type: 'SsoAmbiguousAccount' });

    expect(loggerMock.error).toHaveBeenCalledWith(
      expect.objectContaining({ existingUserId: 'other-user', newUserId: 'user-1', provider: 'saml', providerAccountId: 'nameid-abc' }),
      expect.stringContaining('row exists for a different user'),
    );
    expect(prismaMock.authIdentity.create).not.toHaveBeenCalled();
  });
});

describe('handleSsoLogin seat enforcement', () => {
  const TEAM_ID = 'team-1';
  const userInfo = { email: 'user@example.com', userName: 'user', subject: 'nameid-1' };
  const seats = {
    purchased: 5,
    pending: null,
    pendingEffectiveAt: null,
    effective: 5,
    used: 2,
    reserved: 1,
    available: 2,
    isUnlimited: false,
    isOverAllocated: false,
    includedSeats: 0,
  };
  const membership = { teamId: TEAM_ID, role: 'MEMBER', status: 'ACTIVE' };

  function makeSeatLimitError(kind: 'ADD' | 'ACCEPT_INVITATION') {
    return new SeatLimitError({ code: 'NO_SEATS', teamId: TEAM_ID, kind, seats: { ...seats, available: 0 } });
  }

  beforeEach(() => {
    vi.clearAllMocks();
    prismaErrorMock.isPrismaError.mockReturnValue(false);
    prismaErrorMock.toTypedPrismaError.mockReturnValue(null);
    vi.mocked(getLoginConfiguration).mockResolvedValue({
      id: 'login-config-1',
      ssoEnabled: true,
      ssoProvider: 'SAML',
      domains: ['example.com'],
      samlConfiguration: { id: 'saml-1' },
      oidcConfiguration: null,
      ssoJitProvisioningEnabled: true,
      ssoRequireMfa: false,
      allowedMfaMethods: new Set(),
    } as any);
    teamSeatsMock.withTeamSeatLock.mockImplementation(async (_teamId: string, fn: (tx: unknown) => Promise<unknown>) => fn(prismaMock));
    teamSeatsMock.assertSeatAvailable.mockResolvedValue(seats);
    teamSeatsMock.addMemberFromInvitation.mockResolvedValue({ role: 'MEMBER', status: 'ACTIVE' });
    // No invitation and no existing user unless a test says otherwise
    prismaMock.teamMemberInvitation.findFirst.mockResolvedValue(null);
    prismaMock.teamMemberInvitation.deleteMany.mockResolvedValue({ count: 1 });
    prismaMock.authIdentity.findFirst.mockResolvedValue(null);
    prismaMock.authIdentity.findUnique.mockResolvedValue({ userId: 'user-1' });
    prismaMock.user.findMany.mockResolvedValue([]);
    prismaMock.user.create.mockResolvedValue(fakeUser({ authFactors: [], teamMembership: membership }));
    prismaMock.user.findFirstOrThrow.mockResolvedValue(fakeUser({ authFactors: [], teamMembership: membership }));
    prismaMock.user.update.mockResolvedValue({});
    prismaMock.teamMember.create.mockResolvedValue(membership);
  });

  describe('new user (JIT provisioning)', () => {
    it('without an invitation takes a brand-new seat (ADD) inside the team lock', async () => {
      await handleSsoLogin('saml', TEAM_ID, userInfo, {} as any);

      expect(teamSeatsMock.withTeamSeatLock).toHaveBeenCalledWith(TEAM_ID, expect.any(Function));
      expect(teamSeatsMock.assertSeatAvailable).toHaveBeenCalledWith(prismaMock, { teamId: TEAM_ID, kind: 'ADD' });
      expect(prismaMock.user.create).toHaveBeenCalledTimes(1);
      expect(prismaMock.user.create.mock.calls[0][0].data.teamMembership).toEqual({
        create: expect.objectContaining({ teamId: TEAM_ID, role: 'MEMBER', status: 'ACTIVE' }),
      });
    });

    it('with an invitation converts the reservation (ACCEPT_INVITATION) and removes the invitation in the same transaction', async () => {
      prismaMock.teamMemberInvitation.findFirst.mockResolvedValue({ id: 'invite-1', role: 'MEMBER', features: ['ALL'] });

      await handleSsoLogin('saml', TEAM_ID, userInfo, {} as any);

      expect(teamSeatsMock.assertSeatAvailable).toHaveBeenCalledWith(prismaMock, { teamId: TEAM_ID, kind: 'ACCEPT_INVITATION' });
      expect(prismaMock.teamMemberInvitation.deleteMany).toHaveBeenCalledWith({ where: { id: 'invite-1' } });
    });

    it('with a BILLING invitation never checks seats', async () => {
      prismaMock.teamMemberInvitation.findFirst.mockResolvedValue({ id: 'invite-1', role: 'BILLING', features: ['ALL'] });

      await handleSsoLogin('saml', TEAM_ID, userInfo, {} as any);

      expect(teamSeatsMock.assertSeatAvailable).not.toHaveBeenCalled();
      expect(prismaMock.user.create).toHaveBeenCalledTimes(1);
    });

    it('maps a seat rejection to SsoLicenseLimitExceeded, audits it, and never creates the user', async () => {
      teamSeatsMock.assertSeatAvailable.mockRejectedValueOnce(makeSeatLimitError('ADD'));

      await expect(handleSsoLogin('saml', TEAM_ID, userInfo, {} as any)).rejects.toBeInstanceOf(SsoLicenseLimitExceeded);

      expect(prismaMock.user.create).not.toHaveBeenCalled();
      expect(auditLogMock.createTeamAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          teamId: TEAM_ID,
          action: 'TEAM_MEMBER_ADD_BLOCKED_NO_SEATS',
          metadata: expect.objectContaining({ attemptedAction: 'SSO_JIT', code: 'NO_SEATS', kind: 'ADD', targetEmail: 'user@example.com' }),
        }),
      );
    });
  });

  describe('existing user without a membership', () => {
    beforeEach(() => {
      prismaMock.authIdentity.findFirst.mockResolvedValue({ user: fakeUser({ authFactors: [], teamMembership: null }) });
    });

    it('with an invitation delegates to addMemberFromInvitation (no separate ADD check)', async () => {
      prismaMock.teamMemberInvitation.findFirst.mockResolvedValue({ id: 'invite-1', role: 'MEMBER', features: ['ALL'] });

      await handleSsoLogin('saml', TEAM_ID, userInfo, {} as any);

      expect(teamSeatsMock.withTeamSeatLock).toHaveBeenCalledWith(TEAM_ID, expect.any(Function));
      expect(teamSeatsMock.addMemberFromInvitation).toHaveBeenCalledWith(prismaMock, {
        teamId: TEAM_ID,
        userId: 'user-1',
        invitation: expect.objectContaining({ id: 'invite-1', role: 'MEMBER' }),
      });
      expect(teamSeatsMock.assertSeatAvailable).not.toHaveBeenCalled();
      expect(prismaMock.teamMember.create).not.toHaveBeenCalled();
    });

    it('without an invitation checks for a new seat (ADD) before creating the membership', async () => {
      await handleSsoLogin('saml', TEAM_ID, userInfo, {} as any);

      expect(teamSeatsMock.assertSeatAvailable).toHaveBeenCalledWith(prismaMock, { teamId: TEAM_ID, kind: 'ADD' });
      expect(prismaMock.teamMember.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ teamId: TEAM_ID, userId: 'user-1', role: 'MEMBER' }) }),
      );
      expect(teamSeatsMock.addMemberFromInvitation).not.toHaveBeenCalled();
    });

    it('maps a seat rejection to SsoLicenseLimitExceeded with the user id in the audit entry', async () => {
      teamSeatsMock.assertSeatAvailable.mockRejectedValueOnce(makeSeatLimitError('ADD'));

      await expect(handleSsoLogin('saml', TEAM_ID, userInfo, {} as any)).rejects.toBeInstanceOf(SsoLicenseLimitExceeded);

      expect(prismaMock.teamMember.create).not.toHaveBeenCalled();
      expect(auditLogMock.createTeamAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          teamId: TEAM_ID,
          action: 'TEAM_MEMBER_ADD_BLOCKED_NO_SEATS',
          metadata: expect.objectContaining({ attemptedAction: 'SSO_JIT', targetUserId: 'user-1' }),
        }),
      );
    });
  });
});
