import { beforeEach, describe, expect, it, vi } from 'vitest';
import { claimTeamBillingAccountForCustomer } from '../team.db';

const prismaMock = vi.hoisted(() => ({
  teamBillingAccount: {
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
  ENV: {},
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  prisma: prismaMock,
  DbCacheProvider: vi.fn(),
  rollbarServer: { error: vi.fn(), warn: vi.fn() },
  getExceptionLog: (error: unknown) => ({ error }),
}));

vi.mock('@jetstream/prisma', () => ({
  Prisma: {
    PrismaClientKnownRequestError: prismaErrors.PrismaClientKnownRequestError,
    TransactionIsolationLevel: { Serializable: 'Serializable' },
  },
}));

describe('claimTeamBillingAccountForCustomer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.teamBillingAccount.create.mockResolvedValue({ teamId: 'team-1', customerId: 'cus_new' });
  });

  // This used to be an unconditional `upsert` keyed on teamId, so any duplicate customer emitting an event
  // repointed the team's account. `team_subscription.customerId` cascades on that update, which handed the
  // paying customer's rows to the claiming one for the following reconciliation to delete.
  it('scopes the update to the current customer when this one may not take the account over', async () => {
    prismaMock.teamBillingAccount.updateMany.mockResolvedValue({ count: 1 });

    const claimed = await claimTeamBillingAccountForCustomer({ teamId: 'team-1', customerId: 'cus_stale', allowRepoint: false });

    expect(claimed).toBe(true);
    expect(prismaMock.teamBillingAccount.updateMany).toHaveBeenCalledWith({
      where: { teamId: 'team-1', customerId: 'cus_stale' },
      data: { customerId: 'cus_stale' },
    });
  });

  it('repoints on teamId alone when the customer is being paid for', async () => {
    prismaMock.teamBillingAccount.updateMany.mockResolvedValue({ count: 1 });

    const claimed = await claimTeamBillingAccountForCustomer({ teamId: 'team-1', customerId: 'cus_paid', allowRepoint: true });

    expect(claimed).toBe(true);
    expect(prismaMock.teamBillingAccount.updateMany).toHaveBeenCalledWith({
      where: { teamId: 'team-1' },
      data: { customerId: 'cus_paid' },
    });
    expect(prismaMock.teamBillingAccount.create).not.toHaveBeenCalled();
  });

  // Team plans are paid by bank transfer, so a team's first subscription normally arrives as `incomplete` and
  // cannot repoint anything. There is nothing to displace yet, so the account still has to be created.
  it('creates the account when the team has none yet, even for an unpaid subscription', async () => {
    prismaMock.teamBillingAccount.updateMany.mockResolvedValue({ count: 0 });

    const claimed = await claimTeamBillingAccountForCustomer({ teamId: 'team-1', customerId: 'cus_first', allowRepoint: false });

    expect(claimed).toBe(true);
    expect(prismaMock.teamBillingAccount.create).toHaveBeenCalledWith({ data: { teamId: 'team-1', customerId: 'cus_first' } });
  });

  it('reports the account as unclaimed when another customer holds it', async () => {
    prismaMock.teamBillingAccount.updateMany.mockResolvedValue({ count: 0 });
    prismaMock.teamBillingAccount.create.mockRejectedValue(
      new prismaErrors.PrismaClientKnownRequestError('Unique constraint failed', 'P2002'),
    );

    const claimed = await claimTeamBillingAccountForCustomer({ teamId: 'team-1', customerId: 'cus_stale', allowRepoint: false });

    expect(claimed).toBe(false);
  });

  it('rethrows an unexpected database error rather than reporting the account as unclaimed', async () => {
    prismaMock.teamBillingAccount.updateMany.mockResolvedValue({ count: 0 });
    prismaMock.teamBillingAccount.create.mockRejectedValue(new Error('connection lost'));

    await expect(claimTeamBillingAccountForCustomer({ teamId: 'team-1', customerId: 'cus_stale', allowRepoint: false })).rejects.toThrow(
      'connection lost',
    );
  });
});
