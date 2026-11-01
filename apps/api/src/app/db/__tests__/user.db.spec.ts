import { Prisma } from '@jetstream/prisma';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { findActiveTeamAccessProfile, findIdByUserIdUserFacing, getBillingAccount, updateUser, upsertBillingAccount } from '../user.db';

const prismaMock = vi.hoisted(() => ({
  user: {
    update: vi.fn(),
    findFirst: vi.fn(),
    findFirstOrThrow: vi.fn(),
  },
  teamMember: {
    findFirst: vi.fn(),
  },
  billingAccount: {
    findUnique: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    create: vi.fn(),
    updateMany: vi.fn(),
  },
}));

const loggerMock = vi.hoisted(() => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn() }));

vi.mock('@jetstream/api-config', () => ({
  logger: loggerMock,
  prisma: prismaMock,
}));

vi.mock('../feature-flags.db', () => ({
  resolveFeatureFlagsForUser: vi.fn(async () => ({})),
}));

vi.mock('../../services/feature-flag-signing.service', () => ({
  signFeatureFlags: vi.fn(() => 'signature'),
}));

const sessionUser = {
  id: 'user-session-id',
  email: 'user@example.com',
  name: 'Existing User',
};

describe('updateUser security regressions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.user.update.mockResolvedValue({});
  });

  it('stores SQL-looking profile names as literal values scoped to the session user', async () => {
    const name = "Staging Test' AND '1'='1' --";

    await updateUser(sessionUser as any, { name });

    expect(prismaMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: sessionUser.id },
        data: expect.objectContaining({ name }),
      }),
    );
  });

  it('stores path-looking profile names as literal values and never trusts body identity fields', async () => {
    const name = '../../profile';

    await updateUser(sessionUser as any, { id: 'attacker-selected-id', name } as any);

    expect(prismaMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: sessionUser.id },
        data: expect.objectContaining({ name }),
      }),
    );
  });
});

describe('updateUser preferences', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.user.update.mockResolvedValue({});
  });

  it('writes only the preferences that were sent, so concurrent partial updates cannot undo each other', async () => {
    await updateUser(sessionUser as any, { preferences: { recordSyncEnabled: false } });

    const { data } = prismaMock.user.update.mock.calls[0][0];
    expect(data.name).toBeUndefined();
    expect(data.preferences.upsert.update).toEqual({
      skipFrontdoorLogin: undefined,
      recordSyncEnabled: false,
      soqlQueryFormatOptions: undefined,
    });
  });

  it('fills in defaults for preferences that were not sent when creating the preferences record', async () => {
    await updateUser(sessionUser as any, { preferences: { skipFrontdoorLogin: true } });

    const { data } = prismaMock.user.update.mock.calls[0][0];
    expect(data.preferences.upsert.create).toEqual({
      skipFrontdoorLogin: true,
      recordSyncEnabled: true,
      soqlQueryFormatOptions: expect.objectContaining({ numIndent: 1, fieldMaxLineLength: 1 }),
    });
  });
});

describe('findActiveTeamAccessProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the profile the user is assigned in an active team', async () => {
    const accessProfile = { id: 'profile-1', version: 3, policy: { v: 1, tools: [], operations: [], surfaces: ['desktop'] } };
    prismaMock.teamMember.findFirst.mockResolvedValue({ accessProfile });

    await expect(findActiveTeamAccessProfile({ userId: sessionUser.id })).resolves.toEqual(accessProfile);
    // A membership of an inactive team is ignored, matching /api/me
    expect(prismaMock.teamMember.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: sessionUser.id, team: { status: 'ACTIVE' } } }),
    );
  });

  it('returns null for a member without a profile', async () => {
    prismaMock.teamMember.findFirst.mockResolvedValue({ accessProfile: null });

    await expect(findActiveTeamAccessProfile({ userId: sessionUser.id })).resolves.toBeNull();
  });

  it('returns null for a user without a membership in an active team', async () => {
    prismaMock.teamMember.findFirst.mockResolvedValue(null);

    await expect(findActiveTeamAccessProfile({ userId: sessionUser.id })).resolves.toBeNull();
  });
});

describe('findIdByUserIdUserFacing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('only reads the membership of an active team, so a profile from an inactive team cannot block desktop or extension sign in', async () => {
    prismaMock.user.findFirstOrThrow.mockResolvedValue({
      id: sessionUser.id,
      email: sessionUser.email,
      name: sessionUser.name,
      emailVerified: true,
      picture: null,
      preferences: null,
      entitlements: null,
      subscriptions: [],
      teamMembership: null,
    });

    const userProfile = await findIdByUserIdUserFacing({ userId: sessionUser.id });

    expect(userProfile.teamMembership).toBeNull();
    // The desktop and extension initSession surface checks read `teamMembership.accessProfile` from this
    // result, so the select is the only thing excluding an inactive team's profile (matches verifyToken)
    const { select } = prismaMock.user.findFirstOrThrow.mock.calls[0][0];
    expect(select.teamMembership.where).toEqual({ team: { status: 'ACTIVE' } });
    expect(select.teamMembership.select.accessProfile).toEqual({ select: { id: true, name: true, version: true, policy: true } });
  });
});

describe('getBillingAccount gates the team customer on active membership', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function inactiveAdminWithTeamCustomer({ personalCustomerId }: { personalCustomerId: string | null }) {
    return {
      billingAccount: personalCustomerId ? { customerId: personalCustomerId, manualBilling: false } : null,
      teamMembership: {
        status: 'INACTIVE',
        role: 'ADMIN',
        team: {
          id: 'team-1',
          status: 'ACTIVE',
          billingAccount: { customerId: 'cus_team', manualBilling: false },
        },
      },
    };
  }

  it('does not resolve a DEACTIVATED admin to the team Stripe customer (no personal account -> null)', async () => {
    prismaMock.user.findFirst.mockResolvedValue(inactiveAdminWithTeamCustomer({ personalCustomerId: null }));

    const result = await getBillingAccount('deactivated-admin-id');

    // The inactive membership no longer opens the team's billing portal.
    expect(result).toBeNull();
  });

  it('falls through to the DEACTIVATED member personal billing account instead of the team customer', async () => {
    prismaMock.user.findFirst.mockResolvedValue(inactiveAdminWithTeamCustomer({ personalCustomerId: 'cus_personal' }));

    const result = await getBillingAccount('deactivated-admin-id');

    // Their own customer, as a plain user — never the shared team customer.
    expect(result).toEqual({ customerId: 'cus_personal', manualBilling: false, teamId: null, teamRole: null });
  });

  it('still resolves an ACTIVE admin of an ACTIVE team to the team Stripe customer', async () => {
    prismaMock.user.findFirst.mockResolvedValue({
      billingAccount: null,
      teamMembership: {
        status: 'ACTIVE',
        role: 'ADMIN',
        team: { id: 'team-1', status: 'ACTIVE', billingAccount: { customerId: 'cus_team', manualBilling: false } },
      },
    });

    const result = await getBillingAccount('active-admin-id');

    expect(result).toEqual({ customerId: 'cus_team', manualBilling: false, teamId: 'team-1', teamRole: 'ADMIN' });
  });

  it('does not resolve the team customer when the team itself is INACTIVE', async () => {
    prismaMock.user.findFirst.mockResolvedValue({
      billingAccount: null,
      teamMembership: {
        status: 'ACTIVE',
        role: 'ADMIN',
        team: { id: 'team-1', status: 'INACTIVE', billingAccount: { customerId: 'cus_team', manualBilling: false } },
      },
    });

    const result = await getBillingAccount('admin-of-inactive-team');

    expect(result).toBeNull();
  });
});

describe('upsertBillingAccount', () => {
  const USER_ID = 'user-1';

  const uniqueConstraintError = () =>
    new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: 'test' });

  function existingAccount({ customerId, paidSubscriptionIds = [] }: { customerId: string; paidSubscriptionIds?: string[] }) {
    prismaMock.billingAccount.findUnique.mockResolvedValue({
      customerId,
      subscriptions: paidSubscriptionIds.map((subscriptionId) => ({ subscriptionId })),
    });
  }

  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.billingAccount.findUnique.mockResolvedValue(null);
    prismaMock.billingAccount.create.mockImplementation(async ({ data }: { data: { customerId: string } }) => ({
      customerId: data.customerId,
    }));
    prismaMock.billingAccount.updateMany.mockResolvedValue({ count: 1 });
  });

  it('looks the account up by user id alone and reads only the paid subscriptions recorded on it', async () => {
    await upsertBillingAccount({ userId: USER_ID, customerId: 'cus_1', canRepoint: true });

    expect(prismaMock.billingAccount.findUnique).toHaveBeenCalledWith({
      where: { userId: USER_ID },
      select: {
        customerId: true,
        subscriptions: { where: { status: { in: ['ACTIVE', 'TRIALING'] } }, select: { subscriptionId: true } },
      },
    });
  });

  it('creates the account for a user who has none', async () => {
    await expect(upsertBillingAccount({ userId: USER_ID, customerId: 'cus_1', canRepoint: false })).resolves.toEqual({
      customerId: 'cus_1',
    });
    expect(prismaMock.billingAccount.create).toHaveBeenCalledWith({
      data: { customerId: 'cus_1', userId: USER_ID },
      select: { customerId: true },
    });
  });

  it('leaves an account already on the customer alone', async () => {
    existingAccount({ customerId: 'cus_1', paidSubscriptionIds: ['sub_1'] });

    await expect(upsertBillingAccount({ userId: USER_ID, customerId: 'cus_1', canRepoint: false })).resolves.toEqual({
      customerId: 'cus_1',
    });
    expect(prismaMock.billingAccount.create).not.toHaveBeenCalled();
    expect(prismaMock.billingAccount.updateMany).not.toHaveBeenCalled();
  });

  // The unique violation used to abort checkout completion after the user had already been charged
  it('moves the account to a second paid customer instead of failing on the unique user id', async () => {
    existingAccount({ customerId: 'cus_old' });
    prismaMock.billingAccount.create.mockRejectedValue(uniqueConstraintError());

    await expect(upsertBillingAccount({ userId: USER_ID, customerId: 'cus_new', canRepoint: true })).resolves.toEqual({
      customerId: 'cus_new',
    });
    expect(prismaMock.billingAccount.create).not.toHaveBeenCalled();
    expect(prismaMock.billingAccount.updateMany).toHaveBeenCalledWith({
      where: {
        userId: USER_ID,
        customerId: 'cus_old',
        subscriptions: { none: { status: { in: ['ACTIVE', 'TRIALING'] } } },
      },
      data: { customerId: 'cus_new' },
    });
  });

  it('keeps the account on its customer when the new one has nothing paid for', async () => {
    existingAccount({ customerId: 'cus_old' });

    await expect(upsertBillingAccount({ userId: USER_ID, customerId: 'cus_new', canRepoint: false })).resolves.toEqual({
      customerId: 'cus_old',
    });
    expect(prismaMock.billingAccount.updateMany).not.toHaveBeenCalled();
    expect(loggerMock.error).not.toHaveBeenCalled();
  });

  it('keeps the account on a customer that is still paid for and flags the double charge for a refund', async () => {
    existingAccount({ customerId: 'cus_old', paidSubscriptionIds: ['sub_old'] });

    await expect(upsertBillingAccount({ userId: USER_ID, customerId: 'cus_new', canRepoint: true })).resolves.toEqual({
      customerId: 'cus_old',
    });
    expect(prismaMock.billingAccount.updateMany).not.toHaveBeenCalled();
    expect(loggerMock.error).toHaveBeenCalledTimes(1);
    expect(loggerMock.error).toHaveBeenCalledWith(
      expect.objectContaining({ userId: USER_ID, customerId: 'cus_new', billingAccountCustomerId: 'cus_old' }),
      expect.stringContaining('review for a refund'),
    );
  });

  it('reports the customer a concurrent event moved the account to', async () => {
    existingAccount({ customerId: 'cus_old' });
    prismaMock.billingAccount.updateMany.mockResolvedValue({ count: 0 });
    prismaMock.billingAccount.findUniqueOrThrow.mockResolvedValue({ customerId: 'cus_other' });

    await expect(upsertBillingAccount({ userId: USER_ID, customerId: 'cus_new', canRepoint: true })).resolves.toEqual({
      customerId: 'cus_other',
    });
  });

  it('flags the double charge when the current customer is paid for between the read and the write', async () => {
    prismaMock.billingAccount.findUnique
      .mockResolvedValueOnce({ customerId: 'cus_old', subscriptions: [] })
      .mockResolvedValueOnce({ customerId: 'cus_old', subscriptions: [{ subscriptionId: 'sub_old' }] });
    prismaMock.billingAccount.updateMany.mockResolvedValueOnce({ count: 0 });
    prismaMock.billingAccount.findUniqueOrThrow.mockResolvedValue({ customerId: 'cus_old' });

    await expect(upsertBillingAccount({ userId: USER_ID, customerId: 'cus_new', canRepoint: true })).resolves.toEqual({
      customerId: 'cus_old',
    });
    expect(prismaMock.billingAccount.updateMany).toHaveBeenCalledTimes(1);
    expect(loggerMock.error).toHaveBeenCalledWith(expect.anything(), expect.stringContaining('review for a refund'));
  });

  it('reports the customer of an account a concurrent event created first when this one may not replace it', async () => {
    prismaMock.billingAccount.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({ customerId: 'cus_other', subscriptions: [] });
    prismaMock.billingAccount.create.mockRejectedValue(uniqueConstraintError());

    await expect(upsertBillingAccount({ userId: USER_ID, customerId: 'cus_new', canRepoint: false })).resolves.toEqual({
      customerId: 'cus_other',
    });
    expect(prismaMock.billingAccount.updateMany).not.toHaveBeenCalled();
  });

  // An unpaid customer's event can win the create; the paid customer's event must still take the account
  it('moves an account a concurrent event created for an unpaid customer to the paid one', async () => {
    prismaMock.billingAccount.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({ customerId: 'cus_unpaid', subscriptions: [] });
    prismaMock.billingAccount.create.mockRejectedValue(uniqueConstraintError());

    await expect(upsertBillingAccount({ userId: USER_ID, customerId: 'cus_paid', canRepoint: true })).resolves.toEqual({
      customerId: 'cus_paid',
    });
    expect(prismaMock.billingAccount.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ customerId: 'cus_unpaid' }), data: { customerId: 'cus_paid' } }),
    );
  });

  it('rethrows any other database error', async () => {
    prismaMock.billingAccount.create.mockRejectedValue(new Error('connection lost'));

    await expect(upsertBillingAccount({ userId: USER_ID, customerId: 'cus_1', canRepoint: true })).rejects.toThrow('connection lost');
  });
});
