/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { prisma } from '@jetstream/api-config';
import { Prisma } from '@jetstream/prisma';
import { EntitlementsAccess, EntitlementsAccessSchema } from '@jetstream/types';
import Stripe from 'stripe';

const SELECT = Prisma.validator<Prisma.SubscriptionSelect>()({
  id: true,
  customerId: true,
  subscriptionId: true,
  status: true,
  priceId: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});

export const findByUserId = async (userId: string) => {
  return await prisma.subscription.findMany({ where: { userId, status: 'ACTIVE' }, select: SELECT });
};

export const findById = async ({ id, userId }: { id: string; userId: string }) => {
  return await prisma.subscription.findUniqueOrThrow({ where: { id, userId }, select: SELECT });
};

export const findSubscriptionsByCustomerId = async ({
  customerId,
  status,
}: {
  customerId: string;
  status?: 'ACTIVE' | 'CANCELED' | 'PAST_DUE' | 'PAUSED';
}) => {
  return await prisma.subscription.findMany({ where: { customerId, status }, select: SELECT });
};

export const updateUserEntitlements = async (customerId: string, entitlementAccessUntrusted: EntitlementsAccess) => {
  const entitlementAccess = EntitlementsAccessSchema.parse(entitlementAccessUntrusted);
  const user = await prisma.user.findFirstOrThrow({
    where: { billingAccount: { customerId } },
    select: { id: true },
  });

  await prisma.entitlement.upsert({
    create: {
      userId: user.id,
      ...entitlementAccess,
    },
    update: entitlementAccess,
    where: { userId: user.id },
  });
};

/**
 * Given a customer's current subscriptions, cancel all other subscriptions, create any needed subscriptions, and update the subscription state
 * In addition, entitlements are also updated to reflect the user's current subscription state
 */
export const updateSubscriptionStateForCustomer = async ({
  userId,
  customerId,
  subscriptions,
}: {
  userId: string;
  customerId: string;
  subscriptions: Stripe.Subscription[];
}) => {
  const priceIds = subscriptions.flatMap((subscription) => subscription.items.data.map((item) => item.price.id));

  await prisma.$transaction([
    // Delete all subscriptions that are no longer active in Stripe
    prisma.subscription.deleteMany({
      where: { userId, customerId, priceId: { notIn: priceIds } },
    }),
    // Create/Update all current subscriptions from Stripe
    ...subscriptions.flatMap((subscription) =>
      subscription.items.data.map((item) =>
        prisma.subscription.upsert({
          create: {
            userId,
            subscriptionId: subscription.id,
            status: subscription.status.toUpperCase(),
            customerId,
            priceId: item.price.id,
          },
          update: { status: subscription.status.toUpperCase() },
          where: { uniqueSubscription: { userId, subscriptionId: subscription.id, priceId: item.price.id } },
        })
      )
    ),
  ]);
};

export const cancelAllSubscriptionsForUser = async ({ customerId }: { customerId: string }) => {
  await prisma.subscription.updateMany({
    where: { customerId },
    data: { status: 'CANCELED' },
  });
};
