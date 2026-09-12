import { beforeEach, describe, expect, it, vi } from 'vitest';
import { updateSubscriptionStateForCustomer } from '../subscription.db';

const prismaMock = vi.hoisted(() => ({
  $transaction: vi.fn(async () => []),
  subscription: {
    deleteMany: vi.fn((args: unknown) => ({ __op: 'deleteMany', args })),
    upsert: vi.fn((args: unknown) => ({ __op: 'upsert', args })),
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
      OR: [{ subscriptionId: { notIn: ['sub_new'] } }, { priceId: { notIn: ['price_pro'] } }],
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
      OR: [{ subscriptionId: { notIn: ['sub_1'] } }, { priceId: { notIn: ['price_annual'] } }],
    });
  });

  // Both rows of a multi-item subscription share a current subscriptionId and a current priceId, so neither
  // arm of the OR may match them.
  it('keeps every row of a multi-item subscription', async () => {
    await updateSubscriptionStateForCustomer({
      userId: 'user-1',
      customerId: 'cus_paying',
      subscriptions: [subscription('sub_1', ['price_seat', 'price_addon'])],
    });

    expect(deleteArgs().where).toMatchObject({
      OR: [{ subscriptionId: { notIn: ['sub_1'] } }, { priceId: { notIn: ['price_seat', 'price_addon'] } }],
    });
    expect(prismaMock.subscription.upsert).toHaveBeenCalledTimes(2);
  });

  // `notIn: []` matches every row, so a customer with nothing left in Stripe still has all of its rows cleared.
  it('clears every row when the customer has no subscriptions left', async () => {
    await updateSubscriptionStateForCustomer({ userId: 'user-1', customerId: 'cus_paying', subscriptions: [] });

    expect(deleteArgs().where).toEqual({
      userId: 'user-1',
      customerId: 'cus_paying',
      OR: [{ subscriptionId: { notIn: [] } }, { priceId: { notIn: [] } }],
    });
    expect(prismaMock.subscription.upsert).not.toHaveBeenCalled();
  });
});
