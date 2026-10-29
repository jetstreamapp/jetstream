import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getBillingAccount, updateUser } from '../user.db';

const prismaMock = vi.hoisted(() => ({
  user: {
    update: vi.fn(),
    findFirst: vi.fn(),
  },
}));

vi.mock('@jetstream/api-config', () => ({
  logger: {
    error: vi.fn(),
  },
  prisma: prismaMock,
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
