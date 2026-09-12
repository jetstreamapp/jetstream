import { beforeEach, describe, expect, it, vi } from 'vitest';
import { updateUser, upsertBillingAccount } from '../user.db';

const prismaMock = vi.hoisted(() => ({
  user: {
    findUniqueOrThrow: vi.fn(),
    update: vi.fn(),
  },
  billingAccount: {
    upsert: vi.fn(),
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
    prismaMock.user.findUniqueOrThrow.mockResolvedValue({
      id: sessionUser.id,
      name: 'Existing User',
      preferences: {
        skipFrontdoorLogin: false,
        recordSyncEnabled: true,
        soqlQueryFormatOptions: {},
      },
    });
    prismaMock.user.update.mockResolvedValue({});
  });

  it('stores SQL-looking profile names as literal values scoped to the session user', async () => {
    const name = "Staging Test' AND '1'='1' --";

    await updateUser(sessionUser as any, { name });

    expect(prismaMock.user.findUniqueOrThrow).toHaveBeenCalledWith(expect.objectContaining({ where: { id: sessionUser.id } }));
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

describe('upsertBillingAccount', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.billingAccount.upsert.mockResolvedValue({ userId: 'user-1', customerId: 'cus_new' });
  });

  // Regression: this keyed on the (userId, customerId) pair and then fell through to a create, which hit
  // the unique violation on userId whenever a second Stripe customer existed for the same user. That
  // aborted checkout completion, so a paid subscription went unrecorded.
  it('keys on userId alone so a different customer repoints the account instead of colliding', async () => {
    await upsertBillingAccount({ userId: 'user-1', customerId: 'cus_new' });

    expect(prismaMock.billingAccount.upsert).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      create: { customerId: 'cus_new', userId: 'user-1' },
      update: { customerId: 'cus_new' },
    });
  });
});
