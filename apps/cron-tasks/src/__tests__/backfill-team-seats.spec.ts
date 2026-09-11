import { createAuditLog } from '@jetstream/audit-logs';
import type { PrismaClient } from '@jetstream/prisma';
import { beforeEach, describe, expect, it, vi, type MockedFunction } from 'vitest';
import { backfillTeamSeats, type SeatBackfillLogger, type SeatBackfillStripeClient } from '../utils/backfill-team-seats.utils';

vi.mock('@jetstream/audit-logs', () => ({
  createAuditLog: vi.fn(),
  AuditLogAction: { TEAM_SEATS_BACKFILLED: 'TEAM_SEATS_BACKFILLED' },
  AuditLogResource: { TEAM_SEATS: 'team_seats' },
}));

const mockCreateAuditLog = createAuditLog as MockedFunction<typeof createAuditLog>;

const NOW = new Date('2026-09-10T12:00:00.000Z');
const PERIOD_END_SECONDS = Math.floor(new Date('2026-10-10T12:00:00.000Z').getTime() / 1000);

/** Legacy Team price: flat amount covers the first five seats, per-seat beyond that */
const LEGACY_TIERS = [
  { flat_amount: 2500, unit_amount: null, up_to: 5 },
  { flat_amount: null, unit_amount: 500, up_to: null },
];
/** Current volume price: per-seat from the first seat */
const VOLUME_TIERS = [
  { flat_amount: null, unit_amount: 1000, up_to: 5 },
  { flat_amount: null, unit_amount: 800, up_to: null },
];

interface FakeAccount {
  teamId: string;
  customerId: string;
  manualBilling: boolean;
  licenseCountLimit: number | null;
  seatQuantity: number | null;
  includedSeats: number;
  seatSubscriptionItemId: string | null;
}

function createAccount(overrides: Partial<FakeAccount> & Pick<FakeAccount, 'teamId' | 'customerId'>): FakeAccount {
  return {
    manualBilling: false,
    licenseCountLimit: null,
    seatQuantity: null,
    includedSeats: 0,
    seatSubscriptionItemId: null,
    ...overrides,
  };
}

function createCustomer({
  id,
  subscriptions = [],
}: {
  id: string;
  subscriptions?: Array<{
    id: string;
    status: string;
    schedule?: string | null;
    items: Array<{ id: string; priceId: string; lookupKey: string | null; quantity?: number }>;
  }>;
}) {
  return {
    id,
    object: 'customer',
    subscriptions: {
      data: subscriptions.map((subscription) => ({
        id: subscription.id,
        status: subscription.status,
        schedule: subscription.schedule ?? null,
        items: {
          data: subscription.items.map((item) => ({
            id: item.id,
            quantity: item.quantity,
            current_period_end: PERIOD_END_SECONDS,
            price: { id: item.priceId, lookup_key: item.lookupKey },
          })),
        },
      })),
    },
  };
}

function createHarness({
  accounts,
  customersById,
  tiersByPriceId = {},
  memberCount = 0,
  invitationCount = 0,
}: {
  accounts: FakeAccount[];
  customersById: Record<string, unknown>;
  tiersByPriceId?: Record<string, unknown[]>;
  memberCount?: number;
  invitationCount?: number;
}) {
  const findMany = vi.fn().mockResolvedValueOnce(accounts).mockResolvedValue([]);
  const update = vi.fn().mockResolvedValue(null);
  const prisma = {
    teamBillingAccount: { findMany, update },
    teamMember: { count: vi.fn().mockResolvedValue(memberCount) },
    teamMemberInvitation: { count: vi.fn().mockResolvedValue(invitationCount) },
  } as unknown as PrismaClient;

  const customersRetrieve = vi.fn(async (customerId: string) => {
    const customer = customersById[customerId];
    if (customer instanceof Error) {
      throw customer;
    }
    return customer;
  });
  const pricesRetrieve = vi.fn(async (priceId: string) => ({ id: priceId, tiers: tiersByPriceId[priceId] }));
  const stripe = {
    customers: { retrieve: customersRetrieve },
    prices: { retrieve: pricesRetrieve },
  } as unknown as SeatBackfillStripeClient;

  const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() } as unknown as SeatBackfillLogger;

  return { prisma, stripe, logger, update, customersRetrieve, pricesRetrieve };
}

function loggedMessages(logFn: unknown): string[] {
  return (logFn as MockedFunction<(...args: unknown[]) => void>).mock.calls.map((args) => String(args[args.length - 1]));
}

describe('backfillTeamSeats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('skips teams whose customer has no active TEAM_ subscription item', async () => {
    const harness = createHarness({
      accounts: [
        createAccount({ teamId: 'team-none', customerId: 'cus_none' }),
        createAccount({ teamId: 'team-canceled', customerId: 'cus_canceled' }),
        createAccount({ teamId: 'team-pro', customerId: 'cus_pro' }),
        createAccount({ teamId: 'team-deleted', customerId: 'cus_deleted' }),
      ],
      customersById: {
        cus_none: createCustomer({ id: 'cus_none' }),
        cus_canceled: createCustomer({
          id: 'cus_canceled',
          subscriptions: [{ id: 'sub_1', status: 'canceled', items: [{ id: 'si_1', priceId: 'price_team', lookupKey: 'TEAM_ANNUAL' }] }],
        }),
        cus_pro: createCustomer({
          id: 'cus_pro',
          subscriptions: [{ id: 'sub_2', status: 'active', items: [{ id: 'si_2', priceId: 'price_pro', lookupKey: 'PRO_ANNUAL' }] }],
        }),
        cus_deleted: { id: 'cus_deleted', object: 'customer', deleted: true },
      },
    });

    const result = await backfillTeamSeats({ ...harness, dryRun: false, now: NOW });

    expect(result).toEqual({ dryRun: false, scanned: 4, updated: 0, skipped: 4, warnings: 0, failures: 0 });
    expect(harness.update).not.toHaveBeenCalled();
    expect(mockCreateAuditLog).not.toHaveBeenCalled();
    expect(loggedMessages(harness.logger.info).filter((message) => message.includes('[SKIP_NO_SUBSCRIPTION]'))).toHaveLength(4);
  });

  it('skips a customer with more than one TEAM_ item rather than writing an ambiguous cap', async () => {
    const harness = createHarness({
      accounts: [createAccount({ teamId: 'team-ambiguous', customerId: 'cus_ambiguous' })],
      customersById: {
        cus_ambiguous: createCustomer({
          id: 'cus_ambiguous',
          subscriptions: [
            {
              id: 'sub_1',
              status: 'active',
              items: [{ id: 'si_monthly', priceId: 'price_team_m', lookupKey: 'TEAM_MONTHLY', quantity: 5 }],
            },
            { id: 'sub_2', status: 'active', items: [{ id: 'si_annual', priceId: 'price_team_a', lookupKey: 'TEAM_ANNUAL', quantity: 9 }] },
          ],
        }),
      },
    });

    const result = await backfillTeamSeats({ ...harness, dryRun: false, now: NOW });

    expect(result).toEqual({ dryRun: false, scanned: 1, updated: 0, skipped: 1, warnings: 1, failures: 0 });
    expect(harness.update).not.toHaveBeenCalled();
    expect(mockCreateAuditLog).not.toHaveBeenCalled();
    expect(loggedMessages(harness.logger.warn).filter((message) => message.includes('[SKIP_AMBIGUOUS_SEAT_ITEM]'))).toHaveLength(1);
  });

  it('sets purchased seats to the included seats for a legacy flat-tier plan with quantity 1', async () => {
    const harness = createHarness({
      accounts: [createAccount({ teamId: 'team-legacy', customerId: 'cus_legacy' })],
      customersById: {
        cus_legacy: createCustomer({
          id: 'cus_legacy',
          subscriptions: [
            {
              id: 'sub_legacy',
              status: 'active',
              items: [{ id: 'si_legacy', priceId: 'price_legacy', lookupKey: 'TEAM_MONTHLY', quantity: 1 }],
            },
          ],
        }),
      },
      tiersByPriceId: { price_legacy: LEGACY_TIERS },
      memberCount: 3,
    });

    const result = await backfillTeamSeats({ ...harness, dryRun: false, now: NOW });

    expect(result).toEqual({ dryRun: false, scanned: 1, updated: 1, skipped: 0, warnings: 0, failures: 0 });
    expect(harness.update).toHaveBeenCalledWith({
      where: { teamId: 'team-legacy' },
      data: {
        seatQuantity: 1,
        includedSeats: 5,
        seatSubscriptionItemId: 'si_legacy',
        seatPeriodEnd: new Date(PERIOD_END_SECONDS * 1000),
        licenseCountLimit: 5,
      },
    });
    expect(mockCreateAuditLog).toHaveBeenCalledWith({
      teamId: 'team-legacy',
      action: 'TEAM_SEATS_BACKFILLED',
      resource: 'team_seats',
      resourceId: 'team-legacy',
      metadata: { previousLimit: null, newSeats: 5, seatQuantity: 1, includedSeats: 5, source: 'stripe-quantity' },
    });
  });

  it('mirrors the Stripe quantity for a volume-priced plan', async () => {
    const harness = createHarness({
      accounts: [createAccount({ teamId: 'team-volume', customerId: 'cus_volume', licenseCountLimit: 10 })],
      customersById: {
        cus_volume: createCustomer({
          id: 'cus_volume',
          subscriptions: [
            {
              id: 'sub_volume',
              status: 'active',
              items: [{ id: 'si_volume', priceId: 'price_volume', lookupKey: 'TEAM_ANNUAL', quantity: 7 }],
            },
          ],
        }),
      },
      tiersByPriceId: { price_volume: VOLUME_TIERS },
      memberCount: 5,
      invitationCount: 1,
    });

    const result = await backfillTeamSeats({ ...harness, dryRun: false, now: NOW });

    expect(result).toEqual({ dryRun: false, scanned: 1, updated: 1, skipped: 0, warnings: 0, failures: 0 });
    expect(harness.update).toHaveBeenCalledWith({
      where: { teamId: 'team-volume' },
      data: expect.objectContaining({ seatQuantity: 7, includedSeats: 0, seatSubscriptionItemId: 'si_volume', licenseCountLimit: 7 }),
    });
    expect(mockCreateAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ metadata: expect.objectContaining({ previousLimit: 10, newSeats: 7, source: 'stripe-quantity' }) }),
    );
  });

  it('is idempotent: a team whose seat fields already match Stripe is skipped', async () => {
    const harness = createHarness({
      accounts: [
        createAccount({
          teamId: 'team-synced',
          customerId: 'cus_synced',
          licenseCountLimit: 7,
          seatQuantity: 7,
          seatSubscriptionItemId: 'si_synced',
        }),
      ],
      customersById: {
        cus_synced: createCustomer({
          id: 'cus_synced',
          subscriptions: [
            {
              id: 'sub_synced',
              status: 'active',
              items: [{ id: 'si_synced', priceId: 'price_volume', lookupKey: 'TEAM_ANNUAL', quantity: 7 }],
            },
          ],
        }),
      },
      tiersByPriceId: { price_volume: VOLUME_TIERS },
    });

    const result = await backfillTeamSeats({ ...harness, dryRun: false, now: NOW });

    expect(result).toEqual({ dryRun: false, scanned: 1, updated: 0, skipped: 1, warnings: 0, failures: 0 });
    expect(harness.update).not.toHaveBeenCalled();
    expect(mockCreateAuditLog).not.toHaveBeenCalled();
    expect(loggedMessages(harness.logger.info).some((message) => message.includes('[SKIP_ALREADY_SYNCED]'))).toBe(true);
  });

  it('writes nothing in dry-run mode but reports what would change', async () => {
    const harness = createHarness({
      accounts: [createAccount({ teamId: 'team-dry', customerId: 'cus_dry' })],
      customersById: {
        cus_dry: createCustomer({
          id: 'cus_dry',
          subscriptions: [
            { id: 'sub_dry', status: 'active', items: [{ id: 'si_dry', priceId: 'price_volume', lookupKey: 'TEAM_ANNUAL', quantity: 4 }] },
          ],
        }),
      },
      tiersByPriceId: { price_volume: VOLUME_TIERS },
    });

    const result = await backfillTeamSeats({ ...harness, dryRun: true, now: NOW });

    expect(result).toEqual({ dryRun: true, scanned: 1, updated: 1, skipped: 0, warnings: 0, failures: 0 });
    expect(harness.update).not.toHaveBeenCalled();
    expect(mockCreateAuditLog).not.toHaveBeenCalled();
    expect(harness.logger.info).toHaveBeenCalledWith(
      expect.objectContaining({ teamId: 'team-dry', licenseCountLimit: 4, seatQuantity: 4 }),
      expect.stringContaining('[DRY_RUN]'),
    );
  });

  it('warns when active members and pending invitations exceed the purchased seats, but still updates', async () => {
    const harness = createHarness({
      accounts: [createAccount({ teamId: 'team-over', customerId: 'cus_over' })],
      customersById: {
        cus_over: createCustomer({
          id: 'cus_over',
          subscriptions: [
            {
              id: 'sub_over',
              status: 'active',
              items: [{ id: 'si_over', priceId: 'price_volume', lookupKey: 'TEAM_ANNUAL', quantity: 3 }],
            },
          ],
        }),
      },
      tiersByPriceId: { price_volume: VOLUME_TIERS },
      memberCount: 3,
      invitationCount: 1,
    });

    const result = await backfillTeamSeats({ ...harness, dryRun: false, now: NOW });

    expect(result).toEqual({ dryRun: false, scanned: 1, updated: 1, skipped: 0, warnings: 1, failures: 0 });
    expect(harness.logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ teamId: 'team-over', seatsInUse: 4, desiredSeats: 3 }),
      expect.stringContaining('[USAGE_EXCEEDS_CAP]'),
    );
    expect(harness.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ licenseCountLimit: 3 }) }));
    // Only unexpired invitations reserve a seat
    expect((harness.prisma.teamMemberInvitation.count as unknown as MockedFunction<(args: unknown) => unknown>).mock.calls[0][0]).toEqual({
      where: { teamId: 'team-over', role: { in: ['ADMIN', 'MEMBER'] }, expiresAt: { gte: NOW } },
    });
  });

  it('warns when a subscription schedule is present and never writes pending seat fields', async () => {
    const harness = createHarness({
      accounts: [createAccount({ teamId: 'team-schedule', customerId: 'cus_schedule' })],
      customersById: {
        cus_schedule: createCustomer({
          id: 'cus_schedule',
          subscriptions: [
            {
              id: 'sub_schedule',
              status: 'active',
              schedule: 'sub_sched_123',
              items: [{ id: 'si_schedule', priceId: 'price_volume', lookupKey: 'TEAM_ANNUAL', quantity: 6 }],
            },
          ],
        }),
      },
      tiersByPriceId: { price_volume: VOLUME_TIERS },
    });

    const result = await backfillTeamSeats({ ...harness, dryRun: false, now: NOW });

    expect(result.warnings).toBe(1);
    expect(harness.logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ teamId: 'team-schedule', scheduleId: 'sub_sched_123' }),
      expect.stringContaining('[WARN_SCHEDULE_PRESENT]'),
    );
    const writtenFields = Object.keys(harness.update.mock.calls[0][0].data);
    expect(writtenFields).not.toContain('pendingSeatQuantity');
    expect(writtenFields).not.toContain('pendingSeatEffectiveAt');
    expect(writtenFields).not.toContain('seatScheduleId');
  });

  it('memoizes price tier lookups per price across teams', async () => {
    const harness = createHarness({
      accounts: [createAccount({ teamId: 'team-a', customerId: 'cus_a' }), createAccount({ teamId: 'team-b', customerId: 'cus_b' })],
      customersById: {
        cus_a: createCustomer({
          id: 'cus_a',
          subscriptions: [
            { id: 'sub_a', status: 'active', items: [{ id: 'si_a', priceId: 'price_shared', lookupKey: 'TEAM_ANNUAL', quantity: 2 }] },
          ],
        }),
        cus_b: createCustomer({
          id: 'cus_b',
          subscriptions: [
            { id: 'sub_b', status: 'past_due', items: [{ id: 'si_b', priceId: 'price_shared', lookupKey: 'TEAM_ANNUAL', quantity: 3 }] },
          ],
        }),
      },
      tiersByPriceId: { price_shared: VOLUME_TIERS },
    });

    const result = await backfillTeamSeats({ ...harness, dryRun: false, now: NOW });

    expect(result.updated).toBe(2);
    expect(harness.pricesRetrieve).toHaveBeenCalledTimes(1);
    expect(harness.pricesRetrieve).toHaveBeenCalledWith('price_shared', { expand: ['tiers'] });
  });

  it('counts a Stripe failure for one team and keeps processing the rest', async () => {
    const harness = createHarness({
      accounts: [
        createAccount({ teamId: 'team-broken', customerId: 'cus_broken' }),
        createAccount({ teamId: 'team-ok', customerId: 'cus_ok' }),
      ],
      customersById: {
        cus_broken: new Error('No such customer'),
        cus_ok: createCustomer({
          id: 'cus_ok',
          subscriptions: [
            { id: 'sub_ok', status: 'active', items: [{ id: 'si_ok', priceId: 'price_volume', lookupKey: 'TEAM_ANNUAL', quantity: 2 }] },
          ],
        }),
      },
      tiersByPriceId: { price_volume: VOLUME_TIERS },
    });

    const result = await backfillTeamSeats({ ...harness, dryRun: false, now: NOW });

    expect(result).toEqual({ dryRun: false, scanned: 2, updated: 1, skipped: 0, warnings: 0, failures: 1 });
    expect(harness.logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ teamId: 'team-broken', message: 'No such customer' }),
      expect.stringContaining('[FAILED]'),
    );
    expect(harness.update).toHaveBeenCalledTimes(1);
    expect(harness.update).toHaveBeenCalledWith(expect.objectContaining({ where: { teamId: 'team-ok' } }));
  });

  it('only scans self-serve billing accounts', async () => {
    const harness = createHarness({ accounts: [], customersById: {} });

    await backfillTeamSeats({ ...harness, dryRun: false, now: NOW });

    expect(harness.prisma.teamBillingAccount.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { manualBilling: false }, orderBy: { teamId: 'asc' } }),
    );
  });
});
