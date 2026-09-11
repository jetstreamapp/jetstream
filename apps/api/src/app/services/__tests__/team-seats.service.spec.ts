import { formatISO, fromUnixTime, getUnixTime } from 'date-fns';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type * as TeamSeatsService from '../team-seats.service';

const PERIOD_START = getUnixTime(new Date()) - 5 * 24 * 3600;
const PERIOD_END = PERIOD_START + 30 * 24 * 3600;

const prismaMock = vi.hoisted(() => ({ __tag: 'prisma-mock' }));

const mocks = vi.hoisted(() => ({
  getTeamBillingAccountForSeats: vi.fn(),
  setPendingSeatDecrease: vi.fn(async () => ({})),
  clearPendingSeatDecrease: vi.fn(async () => ({})),
  findTeamById: vi.fn(async () => ({ id: 'team_1', name: 'Acme' })),
  fetchCustomerWithSubscriptionsById: vi.fn(),
  resolveTeamSeatState: vi.fn(),
  previewTeamSeatChange: vi.fn(async () => ({ nextInvoiceAmount: 200, amountDueNow: 0 })),
  commitTeamSeatIncrease: vi.fn(async () => ({ id: 'si_1' })),
  scheduleTeamSeatDecrease: vi.fn(async () => ({ id: 'sub_sched_new' })),
  releaseTeamSeatSchedule: vi.fn(async () => undefined),
  fetchLatestInvoiceForSubscription: vi.fn(async () => ({ id: 'in_1', status: 'paid', amountDue: 50, hostedInvoiceUrl: null })),
  saveOrUpdateSubscription: vi.fn(async () => undefined),
  withTeamSeatLock: vi.fn(),
  getTeamSeatSummary: vi.fn(),
  createTeamAuditLog: vi.fn(),
}));

vi.mock('@jetstream/api-config', () => ({
  ENV: {},
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
  prisma: prismaMock,
}));
vi.mock('@jetstream/prisma', () => ({
  Prisma: { TransactionIsolationLevel: { ReadCommitted: 'ReadCommitted', Serializable: 'Serializable' } },
}));
vi.mock('@jetstream/audit-logs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@jetstream/audit-logs')>();
  return { ...actual, createTeamAuditLog: mocks.createTeamAuditLog };
});
// Keep the pure seat math real; only the database-touching helpers are replaced
vi.mock('@jetstream/team-seats', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@jetstream/team-seats')>();
  return { ...actual, withTeamSeatLock: mocks.withTeamSeatLock, getTeamSeatSummary: mocks.getTeamSeatSummary };
});
vi.mock('../../utils/error-handler', () => ({
  UserFacingError: class UserFacingError extends Error {
    additionalData?: Record<string, unknown>;
    constructor(message: string, additionalData?: Record<string, unknown>) {
      super(message);
      this.name = 'UserFacingError';
      this.additionalData = additionalData;
    }
  },
}));
vi.mock('../../db/subscription.db', () => ({
  getTeamBillingAccountForSeats: mocks.getTeamBillingAccountForSeats,
  getPurchasedSeatCount: ({ quantity, includedSeats }: { quantity: number; includedSeats: number }) => Math.max(quantity, includedSeats),
  setPendingSeatDecrease: mocks.setPendingSeatDecrease,
  clearPendingSeatDecrease: mocks.clearPendingSeatDecrease,
}));
vi.mock('../../db/team.db', () => ({ findById: mocks.findTeamById }));
vi.mock('../stripe.service', () => ({
  fetchCustomerWithSubscriptionsById: mocks.fetchCustomerWithSubscriptionsById,
  filterInactiveSubscriptions: (subscriptions: { status: string }[]) =>
    subscriptions.filter(({ status }) => ['active', 'trialing', 'incomplete'].includes(status)),
  findTeamSeatItem: (subscriptions: { items: { data: { price: { lookup_key?: string } }[] } }[]) => {
    for (const subscription of subscriptions) {
      const item = subscription.items.data.find((candidate) => candidate.price.lookup_key?.startsWith('TEAM_'));
      if (item) {
        return { subscription, item };
      }
    }
    return null;
  },
  resolveTeamSeatState: mocks.resolveTeamSeatState,
  previewTeamSeatChange: mocks.previewTeamSeatChange,
  commitTeamSeatIncrease: mocks.commitTeamSeatIncrease,
  scheduleTeamSeatDecrease: mocks.scheduleTeamSeatDecrease,
  releaseTeamSeatSchedule: mocks.releaseTeamSeatSchedule,
  fetchLatestInvoiceForSubscription: mocks.fetchLatestInvoiceForSubscription,
  saveOrUpdateSubscription: mocks.saveOrUpdateSubscription,
  isStripeCardError: (ex: { type?: string } | null) => ex?.type === 'StripeCardError',
  isProrationDateError: (ex: { type?: string; message?: string } | null) =>
    ex?.type === 'StripeInvalidRequestError' && /proration_date/.test(ex?.message ?? ''),
  getStripeErrorDetails: (ex: { message?: string; decline_code?: string }) => ({
    message: ex.message,
    declineCode: ex.decline_code ?? null,
  }),
}));

function billingAccount(overrides: Record<string, unknown> = {}) {
  return {
    customerId: 'cus_1',
    manualBilling: false,
    licenseCountLimit: 5,
    seatQuantity: 5,
    includedSeats: 0,
    seatSubscriptionItemId: 'si_1',
    seatPeriodEnd: fromUnixTime(PERIOD_END),
    pendingSeatQuantity: null,
    pendingSeatEffectiveAt: null,
    seatScheduleId: null,
    ...overrides,
  };
}

function teamRow({ billingStatus = 'ACTIVE', account = billingAccount() as Record<string, unknown> | null } = {}) {
  return { id: 'team_1', billingStatus, billingAccount: account };
}

function subscription(overrides: Record<string, unknown> = {}, item: Record<string, unknown> = {}) {
  return {
    id: 'sub_1',
    status: 'active',
    cancel_at_period_end: false,
    cancel_at: null,
    discounts: [],
    schedule: null,
    items: {
      data: [
        {
          id: 'si_1',
          quantity: 5,
          current_period_start: PERIOD_START,
          current_period_end: PERIOD_END,
          price: { id: 'price_TEAM_MONTHLY', lookup_key: 'TEAM_MONTHLY', recurring: { interval: 'month', interval_count: 1 } },
          ...item,
        },
      ],
    },
    ...overrides,
  };
}

function customer(subscriptions = [subscription()], overrides: Record<string, unknown> = {}) {
  return { id: 'cus_1', deleted: undefined, discount: null, subscriptions: { data: subscriptions }, ...overrides };
}

function seatState(overrides: Record<string, unknown> = {}) {
  return {
    subscriptionItemId: 'si_1',
    quantity: 5,
    includedSeats: 0,
    periodEnd: fromUnixTime(PERIOD_END),
    pending: null,
    foreignScheduleId: null,
    ...overrides,
  };
}

const PENDING = { quantity: 3, effectiveAt: fromUnixTime(PERIOD_END), scheduleId: 'sub_sched_1' };

async function usage(used: number, reserved = 0) {
  const { summarizeSeats } = await vi.importActual<typeof import('@jetstream/team-seats')>('@jetstream/team-seats');
  return {
    billingStatus: 'ACTIVE',
    manualBilling: false,
    seats: summarizeSeats({ purchasedSeats: 5, pendingSeats: null, pendingEffectiveAt: null, usedSeats: used, reservedSeats: reserved }),
  };
}

async function expectSeatError(promise: Promise<unknown>, code: string, messagePart?: string | RegExp) {
  await expect(promise).rejects.toMatchObject({
    name: 'UserFacingError',
    additionalData: expect.objectContaining({ code }),
    ...(messagePart ? { message: expect.stringMatching(messagePart) } : {}),
  });
}

let service: typeof TeamSeatsService;

beforeEach(async () => {
  vi.resetModules();
  vi.clearAllMocks();
  mocks.getTeamBillingAccountForSeats.mockResolvedValue(teamRow());
  mocks.fetchCustomerWithSubscriptionsById.mockResolvedValue(customer());
  mocks.resolveTeamSeatState.mockResolvedValue(seatState());
  mocks.getTeamSeatSummary.mockResolvedValue(await usage(2, 1));
  mocks.withTeamSeatLock.mockImplementation(async (_teamId: string, fn: (tx: unknown) => Promise<unknown>) => fn(prismaMock));
  mocks.previewTeamSeatChange.mockResolvedValue({ nextInvoiceAmount: 200, amountDueNow: 0 });
  mocks.findTeamById.mockResolvedValue({ id: 'team_1', name: 'Acme' });
  service = await import('../team-seats.service');
});

describe('previewSeatChange rejections', () => {
  it('rejects manual-billing teams', async () => {
    mocks.getTeamBillingAccountForSeats.mockResolvedValue(teamRow({ account: billingAccount({ manualBilling: true }) }));

    await expectSeatError(service.previewSeatChange({ teamId: 'team_1', seats: 8 }), 'SEATS_MANUAL_BILLING');
    expect(mocks.fetchCustomerWithSubscriptionsById).not.toHaveBeenCalled();
  });

  it('rejects past-due teams', async () => {
    mocks.getTeamBillingAccountForSeats.mockResolvedValue(teamRow({ billingStatus: 'PAST_DUE' }));

    await expectSeatError(service.previewSeatChange({ teamId: 'team_1', seats: 8 }), 'SEATS_PAST_DUE', /past due/);
  });

  it('rejects teams without a billing account as having no active subscription', async () => {
    mocks.getTeamBillingAccountForSeats.mockResolvedValue(teamRow({ account: null }));

    await expectSeatError(service.previewSeatChange({ teamId: 'team_1', seats: 8 }), 'SEATS_PAST_DUE', /active subscription/);
  });

  it('rejects when Stripe has no active team item', async () => {
    mocks.fetchCustomerWithSubscriptionsById.mockResolvedValue(customer([subscription({ status: 'canceled' })]));

    await expectSeatError(service.previewSeatChange({ teamId: 'team_1', seats: 8 }), 'SEATS_PAST_DUE', /active subscription/);
  });

  it('rejects a subscription that is set to cancel', async () => {
    mocks.fetchCustomerWithSubscriptionsById.mockResolvedValue(customer([subscription({ cancel_at_period_end: true })]));

    await expectSeatError(service.previewSeatChange({ teamId: 'team_1', seats: 8 }), 'SEATS_SUBSCRIPTION_CANCELING');
  });

  it('rejects when a schedule Jetstream did not create is attached', async () => {
    mocks.resolveTeamSeatState.mockResolvedValue(seatState({ foreignScheduleId: 'sub_sched_foreign' }));

    await expect(service.previewSeatChange({ teamId: 'team_1', seats: 8 })).rejects.toMatchObject({
      additionalData: { code: 'SEATS_BLOCKED_BY_SCHEDULE', scheduleId: 'sub_sched_foreign' },
    });
  });

  it('rejects a count below active members plus pending invitations and names the minimum', async () => {
    mocks.getTeamSeatSummary.mockResolvedValue(await usage(3, 1));

    await expect(service.previewSeatChange({ teamId: 'team_1', seats: 3 })).rejects.toMatchObject({
      message: expect.stringContaining('at least 4 seats'),
      additionalData: expect.objectContaining({ code: 'SEATS_BELOW_MINIMUM', minimum: 4, used: 3, reserved: 1 }),
    });
    expect(mocks.previewTeamSeatChange).not.toHaveBeenCalled();
  });

  it('rejects a count below the seats a legacy plan includes', async () => {
    mocks.resolveTeamSeatState.mockResolvedValue(seatState({ quantity: 1, includedSeats: 5 }));
    mocks.getTeamSeatSummary.mockResolvedValue(await usage(1));

    await expect(service.previewSeatChange({ teamId: 'team_1', seats: 3 })).rejects.toMatchObject({
      message: expect.stringContaining('includes 5 seats'),
      additionalData: expect.objectContaining({ code: 'SEATS_BELOW_MINIMUM', minimum: 5 }),
    });
  });
});

describe('previewSeatChange', () => {
  it('previews an increase with a proration date and the prorated amount due now', async () => {
    mocks.previewTeamSeatChange.mockResolvedValue({ nextInvoiceAmount: 200, amountDueNow: 37.5 });
    const before = getUnixTime(new Date());

    const preview = await service.previewSeatChange({ teamId: 'team_1', seats: 8 });

    expect(mocks.previewTeamSeatChange).toHaveBeenCalledWith({
      customerId: 'cus_1',
      subscriptionId: 'sub_1',
      subscriptionItemId: 'si_1',
      quantity: 8,
      prorationDate: expect.any(Number),
    });
    expect(preview).toEqual({
      changeType: 'INCREASE',
      currentSeats: 5,
      requestedSeats: 8,
      minimumSeats: 3,
      amountDueNow: 37.5,
      prorationDate: expect.any(Number),
      nextInvoice: { amount: 200, date: formatISO(fromUnixTime(PERIOD_END)) },
      interval: 'MONTH',
      effectiveAt: expect.any(String),
      replacesPendingDecrease: null,
      hasDiscount: false,
    });
    expect(preview.prorationDate).toBeGreaterThanOrEqual(before);
    expect(getUnixTime(new Date(preview.effectiveAt))).toBeGreaterThanOrEqual(before);
  });

  it('previews a decrease effective at period end with nothing due now', async () => {
    const preview = await service.previewSeatChange({ teamId: 'team_1', seats: 4 });

    expect(mocks.previewTeamSeatChange).toHaveBeenCalledWith(expect.objectContaining({ quantity: 4, prorationDate: null }));
    expect(preview).toEqual(
      expect.objectContaining({
        changeType: 'DECREASE',
        amountDueNow: 0,
        prorationDate: null,
        effectiveAt: formatISO(fromUnixTime(PERIOD_END)),
      }),
    );
  });

  it('classifies restoring the current count as cancelling the pending decrease', async () => {
    mocks.resolveTeamSeatState.mockResolvedValue(seatState({ pending: PENDING }));

    const preview = await service.previewSeatChange({ teamId: 'team_1', seats: 5 });

    expect(preview).toEqual(
      expect.objectContaining({
        changeType: 'CANCEL_PENDING_DECREASE',
        amountDueNow: 0,
        prorationDate: null,
        replacesPendingDecrease: { seats: 3, effectiveAt: formatISO(fromUnixTime(PERIOD_END)) },
      }),
    );
  });

  it('returns NONE when the requested count matches the current count with nothing pending', async () => {
    const preview = await service.previewSeatChange({ teamId: 'team_1', seats: 5 });

    expect(preview.changeType).toBe('NONE');
    expect(preview.amountDueNow).toBe(0);
  });

  it('returns NONE when the requested count is already the pending decrease target', async () => {
    mocks.resolveTeamSeatState.mockResolvedValue(seatState({ pending: PENDING }));

    const preview = await service.previewSeatChange({ teamId: 'team_1', seats: 3 });

    expect(preview.changeType).toBe('NONE');
  });

  it('treats a legacy plan with included seats as owning those seats and reports annual intervals and discounts', async () => {
    mocks.resolveTeamSeatState.mockResolvedValue(seatState({ quantity: 1, includedSeats: 5 }));
    mocks.fetchCustomerWithSubscriptionsById.mockResolvedValue(
      customer([
        subscription(
          { discounts: ['di_1'] },
          { price: { id: 'price_TEAM_ANNUAL', lookup_key: 'TEAM_ANNUAL', recurring: { interval: 'year', interval_count: 1 } } },
        ),
      ]),
    );
    mocks.getTeamSeatSummary.mockResolvedValue(await usage(1));

    const preview = await service.previewSeatChange({ teamId: 'team_1', seats: 6 });

    expect(preview).toEqual(
      expect.objectContaining({ changeType: 'INCREASE', currentSeats: 5, minimumSeats: 5, interval: 'YEAR', hasDiscount: true }),
    );
  });
});

describe('commitSeatChange guards', () => {
  it('rejects a stale preview when the current seat count moved', async () => {
    await expect(
      service.commitSeatChange({
        teamId: 'team_1',
        seats: 8,
        expectedCurrentSeats: 4,
        prorationDate: getUnixTime(new Date()),
        runningUserId: 'user_1',
      }),
    ).rejects.toMatchObject({
      additionalData: { code: 'STALE_PREVIEW', currentSeats: 5 },
    });
    expect(mocks.withTeamSeatLock).not.toHaveBeenCalled();
    expect(mocks.commitTeamSeatIncrease).not.toHaveBeenCalled();
  });

  it('re-validates usage under the team seat lock and rejects before touching Stripe', async () => {
    // Usage read inside the lock is higher than the request: an invite landed since the preview
    mocks.getTeamSeatSummary.mockResolvedValue(await usage(4, 1));

    await expectSeatError(
      service.commitSeatChange({ teamId: 'team_1', seats: 4, expectedCurrentSeats: 5, runningUserId: 'user_1' }),
      'SEATS_BELOW_MINIMUM',
    );

    expect(mocks.withTeamSeatLock).toHaveBeenCalledWith('team_1', expect.any(Function));
    expect(mocks.getTeamSeatSummary).toHaveBeenCalledWith(prismaMock, { teamId: 'team_1' });
    expect(mocks.scheduleTeamSeatDecrease).not.toHaveBeenCalled();
    expect(mocks.commitTeamSeatIncrease).not.toHaveBeenCalled();
  });

  it('rejects a no-op commit', async () => {
    await expect(
      service.commitSeatChange({ teamId: 'team_1', seats: 5, expectedCurrentSeats: 5, runningUserId: 'user_1' }),
    ).rejects.toMatchObject({
      message: expect.stringContaining('No change'),
      additionalData: expect.objectContaining({ changeType: 'NONE' }),
    });
    expect(mocks.commitTeamSeatIncrease).not.toHaveBeenCalled();
    expect(mocks.saveOrUpdateSubscription).not.toHaveBeenCalled();
  });
});

describe('commitSeatChange INCREASE', () => {
  const now = () => getUnixTime(new Date());

  it.each([
    ['is missing', undefined],
    ['is older than fifteen minutes', () => now() - 16 * 60],
    ['precedes the current billing period', PERIOD_START - 60],
  ])('rejects with PREVIEW_EXPIRED when the proration date %s', async (_label, prorationDate) => {
    const resolvedProrationDate = typeof prorationDate === 'function' ? prorationDate() : prorationDate;

    await expectSeatError(
      service.commitSeatChange({
        teamId: 'team_1',
        seats: 8,
        expectedCurrentSeats: 5,
        prorationDate: resolvedProrationDate,
        runningUserId: 'user_1',
      }),
      'PREVIEW_EXPIRED',
    );
    expect(mocks.commitTeamSeatIncrease).not.toHaveBeenCalled();
  });

  it('updates the item with the previewed proration date, then re-syncs from Stripe and returns the invoice', async () => {
    const prorationDate = now() - 30;

    const response = await service.commitSeatChange({
      teamId: 'team_1',
      seats: 8,
      expectedCurrentSeats: 5,
      prorationDate,
      runningUserId: 'user_1',
    });

    expect(mocks.releaseTeamSeatSchedule).not.toHaveBeenCalled();
    expect(mocks.commitTeamSeatIncrease).toHaveBeenCalledWith({ subscriptionItemId: 'si_1', quantity: 8, prorationDate });
    expect(mocks.fetchLatestInvoiceForSubscription).toHaveBeenCalledWith('sub_1');
    expect(mocks.saveOrUpdateSubscription).toHaveBeenCalledWith({
      customer: expect.objectContaining({ id: 'cus_1' }),
      sendWelcomeEmail: false,
    });
    expect(mocks.findTeamById).toHaveBeenCalledWith({ teamId: 'team_1', runningUserId: 'user_1' });
    expect(response).toEqual({
      team: { id: 'team_1', name: 'Acme' },
      result: {
        changeType: 'INCREASE',
        seats: 8,
        effectiveAt: expect.any(String),
        invoice: { id: 'in_1', status: 'paid', amountDue: 50, hostedInvoiceUrl: null },
      },
    });
  });

  it('releases a pending decrease before the update and records the cancellation', async () => {
    mocks.resolveTeamSeatState.mockResolvedValue(seatState({ pending: PENDING }));

    await service.commitSeatChange({ teamId: 'team_1', seats: 8, expectedCurrentSeats: 5, prorationDate: now(), runningUserId: 'user_1' });

    expect(mocks.releaseTeamSeatSchedule).toHaveBeenCalledWith('sub_sched_1');
    expect(mocks.clearPendingSeatDecrease).toHaveBeenCalledWith({ teamId: 'team_1' });
    expect(mocks.releaseTeamSeatSchedule.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.commitTeamSeatIncrease.mock.invocationCallOrder[0],
    );
    expect(mocks.createTeamAuditLog).toHaveBeenCalledWith({
      userId: 'user_1',
      teamId: 'team_1',
      action: 'TEAM_SEATS_DECREASE_CANCELLED',
      resource: 'team_seats',
      resourceId: 'team_1',
      metadata: { previousSeats: 3, newSeats: 5, effectiveAt: expect.any(String), scheduleId: 'sub_sched_1' },
    });
  });

  it('maps a declined card to PAYMENT_FAILED with the decline code and still re-syncs', async () => {
    mocks.commitTeamSeatIncrease.mockRejectedValueOnce({
      type: 'StripeCardError',
      message: 'Your card was declined.',
      decline_code: 'card_declined',
    });

    await expect(
      service.commitSeatChange({ teamId: 'team_1', seats: 8, expectedCurrentSeats: 5, prorationDate: now(), runningUserId: 'user_1' }),
    ).rejects.toMatchObject({
      message: expect.stringContaining('Your card was declined.'),
      additionalData: { code: 'PAYMENT_FAILED', declineCode: 'card_declined', stripeMessage: 'Your card was declined.' },
    });
    expect(mocks.saveOrUpdateSubscription).toHaveBeenCalledTimes(1);
    expect(mocks.findTeamById).not.toHaveBeenCalled();
  });

  it('puts a released pending decrease back when the payment fails and does not record a cancellation', async () => {
    mocks.resolveTeamSeatState.mockResolvedValue(seatState({ pending: PENDING }));
    mocks.commitTeamSeatIncrease.mockRejectedValueOnce({
      type: 'StripeCardError',
      message: 'Your card was declined.',
      decline_code: 'card_declined',
    });

    await expectSeatError(
      service.commitSeatChange({ teamId: 'team_1', seats: 8, expectedCurrentSeats: 5, prorationDate: now(), runningUserId: 'user_1' }),
      'PAYMENT_FAILED',
    );

    // The schedule had to be released for Stripe to accept the update, so it is re-created with the original target
    expect(mocks.releaseTeamSeatSchedule).toHaveBeenCalledWith('sub_sched_1');
    expect(mocks.scheduleTeamSeatDecrease).toHaveBeenCalledWith(expect.objectContaining({ teamId: 'team_1', quantity: PENDING.quantity }));
    expect(mocks.setPendingSeatDecrease).toHaveBeenCalledWith(
      expect.objectContaining({
        teamId: 'team_1',
        quantity: PENDING.quantity,
        effectiveAt: PENDING.effectiveAt,
        scheduleId: 'sub_sched_new',
      }),
    );
    expect(mocks.createTeamAuditLog).not.toHaveBeenCalledWith(expect.objectContaining({ action: 'TEAM_SEATS_DECREASE_CANCELLED' }));
  });

  it('maps a proration date Stripe rejects to PREVIEW_EXPIRED', async () => {
    mocks.commitTeamSeatIncrease.mockRejectedValueOnce({ type: 'StripeInvalidRequestError', message: 'Invalid proration_date' });

    await expectSeatError(
      service.commitSeatChange({ teamId: 'team_1', seats: 8, expectedCurrentSeats: 5, prorationDate: now(), runningUserId: 'user_1' }),
      'PREVIEW_EXPIRED',
    );
  });

  it('rethrows unexpected Stripe failures unchanged after a best-effort re-sync', async () => {
    mocks.commitTeamSeatIncrease.mockRejectedValueOnce(new Error('stripe unavailable'));
    mocks.saveOrUpdateSubscription.mockRejectedValueOnce(new Error('db unavailable'));

    await expect(
      service.commitSeatChange({ teamId: 'team_1', seats: 8, expectedCurrentSeats: 5, prorationDate: now(), runningUserId: 'user_1' }),
    ).rejects.toThrow('stripe unavailable');
  });
});

describe('commitSeatChange DECREASE', () => {
  it('schedules the decrease for period end, persists the pending fields and records it', async () => {
    const response = await service.commitSeatChange({ teamId: 'team_1', seats: 4, expectedCurrentSeats: 5, runningUserId: 'user_1' });

    expect(mocks.scheduleTeamSeatDecrease).toHaveBeenCalledWith({
      teamId: 'team_1',
      subscription: expect.objectContaining({ id: 'sub_1' }),
      item: expect.objectContaining({ id: 'si_1' }),
      quantity: 4,
    });
    expect(mocks.setPendingSeatDecrease).toHaveBeenCalledWith({
      teamId: 'team_1',
      quantity: 4,
      effectiveAt: fromUnixTime(PERIOD_END),
      scheduleId: 'sub_sched_new',
    });
    expect(mocks.createTeamAuditLog).toHaveBeenCalledWith({
      userId: 'user_1',
      teamId: 'team_1',
      action: 'TEAM_SEATS_DECREASE_SCHEDULED',
      resource: 'team_seats',
      resourceId: 'team_1',
      metadata: { previousSeats: 5, newSeats: 4, effectiveAt: formatISO(fromUnixTime(PERIOD_END)), scheduleId: 'sub_sched_new' },
    });
    expect(mocks.saveOrUpdateSubscription).toHaveBeenCalledTimes(1);
    expect(response.result).toEqual({ changeType: 'DECREASE', seats: 4, effectiveAt: formatISO(fromUnixTime(PERIOD_END)), invoice: null });
    expect(mocks.commitTeamSeatIncrease).not.toHaveBeenCalled();
  });

  it('replaces a pending decrease with a different target by releasing the old schedule first', async () => {
    mocks.resolveTeamSeatState.mockResolvedValue(seatState({ pending: PENDING }));

    await service.commitSeatChange({ teamId: 'team_1', seats: 4, expectedCurrentSeats: 5, runningUserId: 'user_1' });

    expect(mocks.releaseTeamSeatSchedule).toHaveBeenCalledWith('sub_sched_1');
    expect(mocks.releaseTeamSeatSchedule.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.scheduleTeamSeatDecrease.mock.invocationCallOrder[0],
    );
    expect(mocks.setPendingSeatDecrease).toHaveBeenCalledWith(expect.objectContaining({ quantity: 4, scheduleId: 'sub_sched_new' }));
  });
});

describe('commitSeatChange CANCEL_PENDING_DECREASE', () => {
  it('releases the schedule, clears the pending fields, records it and re-syncs', async () => {
    mocks.resolveTeamSeatState.mockResolvedValue(seatState({ pending: PENDING }));

    const response = await service.commitSeatChange({ teamId: 'team_1', seats: 5, expectedCurrentSeats: 5, runningUserId: 'user_1' });

    expect(mocks.releaseTeamSeatSchedule).toHaveBeenCalledWith('sub_sched_1');
    expect(mocks.clearPendingSeatDecrease).toHaveBeenCalledWith({ teamId: 'team_1' });
    expect(mocks.createTeamAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'TEAM_SEATS_DECREASE_CANCELLED',
        metadata: expect.objectContaining({ previousSeats: 3, newSeats: 5, scheduleId: 'sub_sched_1' }),
      }),
    );
    expect(mocks.scheduleTeamSeatDecrease).not.toHaveBeenCalled();
    expect(mocks.commitTeamSeatIncrease).not.toHaveBeenCalled();
    expect(mocks.saveOrUpdateSubscription).toHaveBeenCalledTimes(1);
    expect(response.result).toEqual({ changeType: 'CANCEL_PENDING_DECREASE', seats: 5, effectiveAt: expect.any(String), invoice: null });
  });
});
