import { beforeEach, describe, expect, it, vi } from 'vitest';
import { updateSubscriptionStateForCustomer, updateTeamSubscriptionStateForCustomer } from '../subscription.db';

const prismaMock = vi.hoisted(() => ({
  $transaction: vi.fn(async () => []),
  subscription: {
    deleteMany: vi.fn((args: unknown) => ({ __op: 'deleteMany', args })),
    upsert: vi.fn((args: unknown) => ({ __op: 'upsert', args })),
  },
  teamSubscription: {
    deleteMany: vi.fn((args: unknown) => ({ __op: 'deleteMany', args })),
    upsert: vi.fn((args: unknown) => ({ __op: 'upsert', args })),
  },
  team: {
    findFirstOrThrow: vi.fn(async () => ({ id: 'team-1', billingAccount: { manualBilling: false } })),
    update: vi.fn((args: unknown) => ({ __op: 'update', args })),
  },
}));

vi.mock('@jetstream/api-config', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
  prisma: prismaMock,
}));
vi.mock('@jetstream/prisma', () => ({ Prisma: {} }));
vi.mock('./feature-flags.db', () => ({ resolveActiveTeamIdForUser: vi.fn() }));

// Derived from the function signature rather than imported from `stripe` directly - the package resolves to
// its esm types here and its cjs types inside the module under test, which are structurally incompatible.
type SubscriptionArg = Parameters<typeof updateSubscriptionStateForCustomer>[0]['subscriptions'][number];

const subscription = (id: string, priceIds: string[], status = 'active') =>
  ({
    id,
    status,
    items: { object: 'list', data: priceIds.map((priceId) => ({ id: `si_${priceId}`, price: { id: priceId } })) },
  }) as unknown as SubscriptionArg;

const deleteArgs = () => prismaMock.subscription.deleteMany.mock.calls[0][0] as { where: Record<string, unknown> };
const teamDeleteArgs = () => prismaMock.teamSubscription.deleteMany.mock.calls[0][0] as { where: Record<string, unknown> };

describe('updateSubscriptionStateForCustomer stale row removal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Repointing a billing account cascades the previous customer's rows onto the claiming customerId while they
  // keep their original subscriptionId. Matching on price alone stranded them permanently whenever both
  // customers were on the same price, which left the user reported as out of sync on every billing page visit.
  it('removes a cascaded row from another subscription that is on the same price', async () => {
    await updateSubscriptionStateForCustomer({
      userId: 'user-1',
      customerId: 'cus_paying',
      subscriptions: [subscription('sub_new', ['price_pro'])],
    });

    expect(deleteArgs().where).toEqual({
      userId: 'user-1',
      customerId: 'cus_paying',
      NOT: [{ subscriptionId: 'sub_new', priceId: 'price_pro' }],
    });
  });

  // A plan change keeps the same subscription but moves it to a new price, so the old row has to go.
  it('removes the previous row when a plan change moves the subscription to another price', async () => {
    await updateSubscriptionStateForCustomer({
      userId: 'user-1',
      customerId: 'cus_paying',
      subscriptions: [subscription('sub_1', ['price_annual'])],
    });

    expect(deleteArgs().where).toMatchObject({
      NOT: [{ subscriptionId: 'sub_1', priceId: 'price_annual' }],
    });
  });

  // Both rows of a multi-item subscription are pairs Stripe still reports, so neither may be deleted.
  it('keeps every row of a multi-item subscription', async () => {
    await updateSubscriptionStateForCustomer({
      userId: 'user-1',
      customerId: 'cus_paying',
      subscriptions: [subscription('sub_1', ['price_seat', 'price_addon'])],
    });

    expect(deleteArgs().where).toMatchObject({
      NOT: [
        { subscriptionId: 'sub_1', priceId: 'price_seat' },
        { subscriptionId: 'sub_1', priceId: 'price_addon' },
      ],
    });
    expect(prismaMock.subscription.upsert).toHaveBeenCalledTimes(2);
  });

  // `NOT: []` places no constraint, so a customer with nothing left in Stripe still has all of its rows cleared.
  it('clears every row when the customer has no subscriptions left', async () => {
    await updateSubscriptionStateForCustomer({ userId: 'user-1', customerId: 'cus_paying', subscriptions: [] });

    expect(deleteArgs().where).toEqual({ userId: 'user-1', customerId: 'cus_paying', NOT: [] });
    expect(prismaMock.subscription.upsert).not.toHaveBeenCalled();
  });

  // Each identifier on its own is still current here - `sub_1` is a live subscription and `price_legacy` is a
  // live price on `sub_2` - but the pair is not, so the superseded row has to go.
  it('removes a row whose subscription has moved to a price another subscription still holds', async () => {
    await updateSubscriptionStateForCustomer({
      userId: 'user-1',
      customerId: 'cus_paying',
      subscriptions: [subscription('sub_1', ['price_pro']), subscription('sub_2', ['price_legacy'])],
    });

    expect(deleteArgs().where).toMatchObject({
      NOT: [
        { subscriptionId: 'sub_1', priceId: 'price_pro' },
        { subscriptionId: 'sub_2', priceId: 'price_legacy' },
      ],
    });
  });
});

// The team reconciliation mirrors the user-side predicate, and `team_subscription.customerId` cascades on a
// team billing account repoint exactly as its user-side counterpart does.
describe('updateTeamSubscriptionStateForCustomer stale row removal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('removes a cascaded row from another subscription that is on the same price', async () => {
    await updateTeamSubscriptionStateForCustomer({
      teamId: 'team-1',
      customerId: 'cus_paying',
      subscriptions: [subscription('sub_new', ['price_team'])],
    });

    expect(teamDeleteArgs().where).toEqual({
      teamId: 'team-1',
      customerId: 'cus_paying',
      NOT: [{ subscriptionId: 'sub_new', priceId: 'price_team' }],
    });
  });

  it('removes a row whose subscription has moved to a price another subscription still holds', async () => {
    await updateTeamSubscriptionStateForCustomer({
      teamId: 'team-1',
      customerId: 'cus_paying',
      subscriptions: [subscription('sub_1', ['price_team']), subscription('sub_2', ['price_legacy'])],
    });

    expect(teamDeleteArgs().where).toMatchObject({
      NOT: [
        { subscriptionId: 'sub_1', priceId: 'price_team' },
        { subscriptionId: 'sub_2', priceId: 'price_legacy' },
      ],
    });
  });

  it('clears every row when the customer has no subscriptions left', async () => {
    await updateTeamSubscriptionStateForCustomer({ teamId: 'team-1', customerId: 'cus_paying', subscriptions: [] });

    expect(teamDeleteArgs().where).toEqual({ teamId: 'team-1', customerId: 'cus_paying', NOT: [] });
    expect(prismaMock.teamSubscription.upsert).not.toHaveBeenCalled();
  });
});
