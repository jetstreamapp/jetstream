import { beforeEach, describe, expect, it, vi } from 'vitest';
import { claimBillingAccountForCustomer, updateUser } from '../user.db';

const prismaMock = vi.hoisted(() => ({
  user: {
    findUniqueOrThrow: vi.fn(),
    update: vi.fn(),
  },
  billingAccount: {
    updateMany: vi.fn(),
    create: vi.fn(),
  },
}));

const prismaErrors = vi.hoisted(() => {
  class PrismaClientKnownRequestError extends Error {
    code: string;
    constructor(message: string, code: string) {
      super(message);
      this.code = code;
    }
  }
  return { PrismaClientKnownRequestError };
});

vi.mock('@jetstream/api-config', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
  },
  prisma: prismaMock,
}));

vi.mock('@jetstream/prisma', () => ({
  Prisma: { PrismaClientKnownRequestError: prismaErrors.PrismaClientKnownRequestError },
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

describe('claimBillingAccountForCustomer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.billingAccount.create.mockResolvedValue({ userId: 'user-1', customerId: 'cus_new' });
  });

  // Reading the account and then writing it left a window where a stale customer could move the account back
  // off the one that is paying, so the comparison has to live in the write filter.
  it('scopes the update to the current customer when this one may not take the account over', async () => {
    prismaMock.billingAccount.updateMany.mockResolvedValue({ count: 1 });

    const claimed = await claimBillingAccountForCustomer({ userId: 'user-1', customerId: 'cus_stale', allowRepoint: false });

    expect(claimed).toBe(true);
    expect(prismaMock.billingAccount.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', customerId: 'cus_stale' },
      data: { customerId: 'cus_stale' },
    });
  });

  // Regression: this keyed on the (userId, customerId) pair and then fell through to a create, which hit
  // the unique violation on userId whenever a second Stripe customer existed for the same user. That
  // aborted checkout completion, so a paid subscription went unrecorded.
  it('repoints on userId alone when the customer is being paid for', async () => {
    prismaMock.billingAccount.updateMany.mockResolvedValue({ count: 1 });

    const claimed = await claimBillingAccountForCustomer({ userId: 'user-1', customerId: 'cus_paid', allowRepoint: true });

    expect(claimed).toBe(true);
    expect(prismaMock.billingAccount.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      data: { customerId: 'cus_paid' },
    });
    expect(prismaMock.billingAccount.create).not.toHaveBeenCalled();
  });

  it('creates the account when the user has none yet', async () => {
    prismaMock.billingAccount.updateMany.mockResolvedValue({ count: 0 });

    const claimed = await claimBillingAccountForCustomer({ userId: 'user-1', customerId: 'cus_first', allowRepoint: false });

    expect(claimed).toBe(true);
    expect(prismaMock.billingAccount.create).toHaveBeenCalledWith({ data: { customerId: 'cus_first', userId: 'user-1' } });
  });

  it('reports the account as unclaimed when another customer holds it', async () => {
    prismaMock.billingAccount.updateMany.mockResolvedValue({ count: 0 });
    prismaMock.billingAccount.create.mockRejectedValue(new prismaErrors.PrismaClientKnownRequestError('Unique constraint failed', 'P2002'));

    const claimed = await claimBillingAccountForCustomer({ userId: 'user-1', customerId: 'cus_stale', allowRepoint: false });

    expect(claimed).toBe(false);
  });

  it('rethrows anything that is not a unique violation', async () => {
    prismaMock.billingAccount.updateMany.mockResolvedValue({ count: 0 });
    prismaMock.billingAccount.create.mockRejectedValue(new Error('connection lost'));

    await expect(claimBillingAccountForCustomer({ userId: 'user-1', customerId: 'cus_stale', allowRepoint: false })).rejects.toThrow(
      'connection lost',
    );
  });
});
