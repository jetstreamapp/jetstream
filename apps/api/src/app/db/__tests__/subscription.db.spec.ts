import { beforeEach, describe, expect, it, vi } from 'vitest';
import type * as SubscriptionDb from '../subscription.db';

const prismaMock = vi.hoisted(() => {
  const mock: any = {
    team: {
      findFirstOrThrow: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      update: vi.fn(async () => ({})),
    },
    teamSubscription: {
      deleteMany: vi.fn(async () => ({ count: 0 })),
      upsert: vi.fn(async () => ({})),
      updateMany: vi.fn(async () => ({ count: 0 })),
    },
    teamBillingAccount: {
      update: vi.fn(async () => ({})),
      updateMany: vi.fn(async () => ({ count: 0 })),
    },
    subscription: {
      updateMany: vi.fn(async () => ({ count: 0 })),
    },
  };
  mock.$transaction = vi.fn(async (operations: unknown) =>
    Array.isArray(operations) ? Promise.all(operations) : (operations as any)(mock),
  );
  return mock;
});

const mocks = vi.hoisted(() => ({
  withTeamSeatLock: vi.fn(),
  getTeamSeatSummary: vi.fn(),
  createTeamAuditLog: vi.fn(),
}));

vi.mock('@jetstream/api-config', () => ({
  ENV: {},
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
  prisma: prismaMock,
}));
vi.mock('@jetstream/prisma', () => ({ Prisma: {} }));
vi.mock('@jetstream/team-seats', () => ({
  withTeamSeatLock: mocks.withTeamSeatLock,
  getTeamSeatSummary: mocks.getTeamSeatSummary,
}));
vi.mock('@jetstream/audit-logs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@jetstream/audit-logs')>();
  return { ...actual, createTeamAuditLog: mocks.createTeamAuditLog };
});

type SeatState = SubscriptionDb.TeamSeatState;
type BillingAccount = SubscriptionDb.TeamSeatBillingAccount;
type StripeSubscription = Parameters<typeof SubscriptionDb.updateTeamSubscriptionStateForCustomer>[0]['subscriptions'][number];

const PERIOD_END = new Date('2026-10-01T00:00:00.000Z');

function seatState(overrides: Partial<SeatState> = {}): SeatState {
  return {
    subscriptionItemId: 'si_1',
    quantity: 4,
    includedSeats: 0,
    periodEnd: PERIOD_END,
    pending: null,
    foreignScheduleId: null,
    ...overrides,
  };
}

function billingAccount(overrides: Partial<BillingAccount> = {}): BillingAccount {
  return {
    customerId: 'cus_1',
    manualBilling: false,
    licenseCountLimit: 4,
    seatQuantity: 4,
    includedSeats: 0,
    seatSubscriptionItemId: 'si_1',
    seatPeriodEnd: new Date(PERIOD_END),
    pendingSeatQuantity: null,
    pendingSeatEffectiveAt: null,
    seatScheduleId: null,
    ...overrides,
  };
}

function stripeSubscription(status = 'active'): StripeSubscription {
  return { id: 'sub_1', status, items: { data: [{ price: { id: 'price_TEAM_MONTHLY' } }] } } as unknown as StripeSubscription;
}

let subscriptionDb: typeof SubscriptionDb;

beforeEach(async () => {
  vi.resetModules();
  vi.clearAllMocks();
  mocks.withTeamSeatLock.mockImplementation(async (_teamId: string, fn: (tx: unknown) => Promise<unknown>) => fn(prismaMock));
  prismaMock.team.findFirstOrThrow.mockResolvedValue({
    id: 'team_1',
    billingAccount: { manualBilling: false, licenseCountLimit: 4, seatScheduleId: null },
  });
  subscriptionDb = await import('../subscription.db');
});

describe('updateTeamSubscriptionStateForCustomer', () => {
  const run = (seat: SeatState | null, subscriptions = [stripeSubscription()]) =>
    subscriptionDb.updateTeamSubscriptionStateForCustomer({ teamId: 'team_1', customerId: 'cus_1', subscriptions, seatState: seat });

  it('runs under the team seat lock and upserts the subscription rows inside it', async () => {
    await run(seatState());

    expect(mocks.withTeamSeatLock).toHaveBeenCalledWith('team_1', expect.any(Function));
    expect(prismaMock.teamSubscription.deleteMany).toHaveBeenCalledWith({
      where: { teamId: 'team_1', customerId: 'cus_1', priceId: { notIn: ['price_TEAM_MONTHLY'] } },
    });
    expect(prismaMock.teamSubscription.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: { teamId: 'team_1', subscriptionId: 'sub_1', status: 'ACTIVE', customerId: 'cus_1', priceId: 'price_TEAM_MONTHLY' },
        where: { uniqueSubscription: { teamId: 'team_1', subscriptionId: 'sub_1', priceId: 'price_TEAM_MONTHLY' } },
      }),
    );
    expect(prismaMock.team.update).toHaveBeenCalledWith({ data: { billingStatus: 'ACTIVE' }, where: { id: 'team_1' } });
  });

  it('writes the seat mirror and the cap as max(quantity, includedSeats) for self-serve teams', async () => {
    await run(seatState({ quantity: 6 }));

    expect(prismaMock.teamBillingAccount.update).toHaveBeenCalledWith({
      where: { teamId: 'team_1' },
      data: {
        seatQuantity: 6,
        includedSeats: 0,
        seatSubscriptionItemId: 'si_1',
        seatPeriodEnd: PERIOD_END,
        pendingSeatQuantity: null,
        pendingSeatEffectiveAt: null,
        seatScheduleId: null,
        licenseCountLimit: 6,
      },
    });
  });

  it('lets a legacy plan with included seats keep those seats when the quantity is lower', async () => {
    await run(seatState({ quantity: 1, includedSeats: 5 }));

    expect(prismaMock.teamBillingAccount.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ seatQuantity: 1, includedSeats: 5, licenseCountLimit: 5 }) }),
    );
  });

  it('writes the pending decrease fields', async () => {
    const effectiveAt = new Date('2026-10-01T00:00:00.000Z');
    await run(seatState({ pending: { quantity: 2, effectiveAt, scheduleId: 'sub_sched_1' } }));

    expect(prismaMock.teamBillingAccount.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          pendingSeatQuantity: 2,
          pendingSeatEffectiveAt: effectiveAt,
          seatScheduleId: 'sub_sched_1',
          licenseCountLimit: 4,
        }),
      }),
    );
  });

  it('nulls the mirrors but keeps the cap when there is no active team item', async () => {
    await run(null, []);

    const [{ data }] = prismaMock.teamBillingAccount.update.mock.calls[0];
    expect(data).toEqual({
      seatQuantity: null,
      includedSeats: 0,
      seatSubscriptionItemId: null,
      seatPeriodEnd: null,
      pendingSeatQuantity: null,
      pendingSeatEffectiveAt: null,
      seatScheduleId: null,
    });
    expect(data).not.toHaveProperty('licenseCountLimit');
    expect(prismaMock.team.update).toHaveBeenCalledWith({ data: { billingStatus: 'PAST_DUE' }, where: { id: 'team_1' } });
  });

  it('never writes seat fields for manual-billing teams and marks them MANUAL', async () => {
    prismaMock.team.findFirstOrThrow.mockResolvedValue({
      id: 'team_1',
      billingAccount: { manualBilling: true, licenseCountLimit: 50, seatScheduleId: null },
    });

    await run(seatState({ quantity: 6 }));

    expect(prismaMock.teamBillingAccount.update).not.toHaveBeenCalled();
    expect(prismaMock.team.update).toHaveBeenCalledWith({ data: { billingStatus: 'MANUAL' }, where: { id: 'team_1' } });
    expect(mocks.createTeamAuditLog).not.toHaveBeenCalled();
  });

  it('skips seat writes when the team has no billing account', async () => {
    prismaMock.team.findFirstOrThrow.mockResolvedValue({ id: 'team_1', billingAccount: null });

    await run(seatState());

    expect(prismaMock.teamBillingAccount.update).not.toHaveBeenCalled();
  });

  it('marks the team PAST_DUE when any subscription is past due', async () => {
    await run(seatState(), [stripeSubscription('past_due')]);

    expect(prismaMock.team.update).toHaveBeenCalledWith({ data: { billingStatus: 'PAST_DUE' }, where: { id: 'team_1' } });
  });

  it('records a system audit entry when a scheduled decrease lands and lowers the cap', async () => {
    prismaMock.team.findFirstOrThrow.mockResolvedValue({
      id: 'team_1',
      billingAccount: { manualBilling: false, licenseCountLimit: 5, seatScheduleId: 'sub_sched_1' },
    });

    await run(seatState({ quantity: 3 }));

    expect(mocks.createTeamAuditLog).toHaveBeenCalledWith({
      teamId: 'team_1',
      action: 'TEAM_SEATS_DECREASE_APPLIED',
      resource: 'team_seats',
      resourceId: 'team_1',
      metadata: { previousSeats: 5, newSeats: 3, scheduleId: 'sub_sched_1' },
    });
    expect(mocks.createTeamAuditLog.mock.calls[0][0]).not.toHaveProperty('userId');
  });

  it('does not record an applied decrease for increases, unchanged caps, or teams without a prior cap', async () => {
    await run(seatState({ quantity: 9 }));
    await run(seatState({ quantity: 4 }));
    prismaMock.team.findFirstOrThrow.mockResolvedValue({
      id: 'team_1',
      billingAccount: { manualBilling: false, licenseCountLimit: null, seatScheduleId: null },
    });
    await run(seatState({ quantity: 1 }));
    await run(null, []);

    expect(mocks.createTeamAuditLog).not.toHaveBeenCalled();
  });
});

describe('isTeamSeatStateInSync', () => {
  it('is always in sync for manual-billing teams and teams without a billing account', () => {
    expect(subscriptionDb.isTeamSeatStateInSync(billingAccount({ manualBilling: true, seatQuantity: 99 }), seatState())).toBe(true);
    expect(subscriptionDb.isTeamSeatStateInSync(null, seatState())).toBe(true);
  });

  it('is in sync when every mirrored column and the cap match Stripe', () => {
    expect(subscriptionDb.isTeamSeatStateInSync(billingAccount(), seatState())).toBe(true);
    expect(
      subscriptionDb.isTeamSeatStateInSync(
        billingAccount({ pendingSeatQuantity: 2, pendingSeatEffectiveAt: new Date(PERIOD_END), seatScheduleId: 'sub_sched_1' }),
        seatState({ pending: { quantity: 2, effectiveAt: PERIOD_END, scheduleId: 'sub_sched_1' } }),
      ),
    ).toBe(true);
  });

  it.each([
    ['quantity', billingAccount({ seatQuantity: 3 }), seatState()],
    ['item id', billingAccount({ seatSubscriptionItemId: 'si_old' }), seatState()],
    ['period end', billingAccount({ seatPeriodEnd: new Date('2026-11-01T00:00:00.000Z') }), seatState()],
    ['included seats', billingAccount({ includedSeats: 5 }), seatState()],
    ['pending quantity', billingAccount(), seatState({ pending: { quantity: 2, effectiveAt: PERIOD_END, scheduleId: 'sub_sched_1' } })],
    [
      'schedule id',
      billingAccount({ pendingSeatQuantity: 2, pendingSeatEffectiveAt: new Date(PERIOD_END), seatScheduleId: 'sub_sched_old' }),
      seatState({ pending: { quantity: 2, effectiveAt: PERIOD_END, scheduleId: 'sub_sched_1' } }),
    ],
    ['cap', billingAccount({ licenseCountLimit: 3 }), seatState()],
    [
      'cap for a legacy plan',
      billingAccount({ seatQuantity: 1, includedSeats: 5, licenseCountLimit: 1 }),
      seatState({ quantity: 1, includedSeats: 5 }),
    ],
  ])('drifts when the %s differs', (_label, account, state) => {
    expect(subscriptionDb.isTeamSeatStateInSync(account, state)).toBe(false);
  });

  it('expects empty mirrors and any cap when Stripe has no team item', () => {
    const emptyMirrors = billingAccount({ seatQuantity: null, seatSubscriptionItemId: null, seatPeriodEnd: null, licenseCountLimit: 7 });
    expect(subscriptionDb.isTeamSeatStateInSync(emptyMirrors, null)).toBe(true);
    expect(subscriptionDb.isTeamSeatStateInSync(billingAccount(), null)).toBe(false);
  });
});

describe('pending decrease writers', () => {
  it('sets the pending decrease fields', async () => {
    await subscriptionDb.setPendingSeatDecrease({ teamId: 'team_1', quantity: 2, effectiveAt: PERIOD_END, scheduleId: 'sub_sched_1' });

    expect(prismaMock.teamBillingAccount.update).toHaveBeenCalledWith({
      where: { teamId: 'team_1' },
      data: { pendingSeatQuantity: 2, pendingSeatEffectiveAt: PERIOD_END, seatScheduleId: 'sub_sched_1' },
    });
  });

  it('clears the pending decrease fields', async () => {
    await subscriptionDb.clearPendingSeatDecrease({ teamId: 'team_1' });

    expect(prismaMock.teamBillingAccount.update).toHaveBeenCalledWith({
      where: { teamId: 'team_1' },
      data: { pendingSeatQuantity: null, pendingSeatEffectiveAt: null, seatScheduleId: null },
    });
  });
});

describe('cancelAllSubscriptionsForUser', () => {
  it('cancels subscription rows and clears any pending seat decrease for the customer', async () => {
    await subscriptionDb.cancelAllSubscriptionsForUser({ customerId: 'cus_1' });

    expect(prismaMock.subscription.updateMany).toHaveBeenCalledWith({ where: { customerId: 'cus_1' }, data: { status: 'CANCELED' } });
    expect(prismaMock.teamSubscription.updateMany).toHaveBeenCalledWith({ where: { customerId: 'cus_1' }, data: { status: 'CANCELED' } });
    expect(prismaMock.teamBillingAccount.updateMany).toHaveBeenCalledWith({
      where: { customerId: 'cus_1' },
      data: { pendingSeatQuantity: null, pendingSeatEffectiveAt: null, seatScheduleId: null },
    });
  });
});

describe('seat lookups', () => {
  it('selects billing status and every seat column for the seat service', async () => {
    prismaMock.team.findUniqueOrThrow.mockResolvedValue({ id: 'team_1', billingStatus: 'ACTIVE', billingAccount: billingAccount() });

    const team = await subscriptionDb.getTeamBillingAccountForSeats({ teamId: 'team_1' });

    expect(prismaMock.team.findUniqueOrThrow).toHaveBeenCalledWith({
      where: { id: 'team_1' },
      select: {
        id: true,
        billingStatus: true,
        billingAccount: {
          select: {
            customerId: true,
            manualBilling: true,
            licenseCountLimit: true,
            seatQuantity: true,
            includedSeats: true,
            seatSubscriptionItemId: true,
            seatPeriodEnd: true,
            pendingSeatQuantity: true,
            pendingSeatEffectiveAt: true,
            seatScheduleId: true,
          },
        },
      },
    });
    expect(team.billingAccount?.customerId).toBe('cus_1');
  });

  it('returns the usage summary from the seat library', async () => {
    const seats = {
      purchased: 4,
      pending: null,
      pendingEffectiveAt: null,
      effective: 4,
      used: 2,
      reserved: 1,
      available: 1,
      isUnlimited: false,
      isOverAllocated: false,
    };
    mocks.getTeamSeatSummary.mockResolvedValue({ billingStatus: 'ACTIVE', manualBilling: false, seats });

    expect(await subscriptionDb.getTeamSeatUsage({ teamId: 'team_1' })).toEqual(seats);
    expect(mocks.getTeamSeatSummary).toHaveBeenCalledWith(prismaMock, { teamId: 'team_1' });
  });

  it('derives the purchased seat count as the larger of quantity and included seats', () => {
    expect(subscriptionDb.getPurchasedSeatCount({ quantity: 1, includedSeats: 5 })).toBe(5);
    expect(subscriptionDb.getPurchasedSeatCount({ quantity: 8, includedSeats: 5 })).toBe(8);
    expect(subscriptionDb.getPurchasedSeatCount({ quantity: 3, includedSeats: 0 })).toBe(3);
  });
});
