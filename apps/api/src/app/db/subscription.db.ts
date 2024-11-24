/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { prisma } from '@jetstream/api-config';
import { Prisma } from '@prisma/client';

const SELECT = Prisma.validator<Prisma.SubscriptionSelect>()({
  id: true,
  customerId: true,
  providerId: true,
  status: true,
  planId: true,
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

export const upsertSubscription = async ({
  userId,
  customerId,
  providerId,
  planId,
}: {
  userId: string;
  customerId: string;
  providerId: string;
  planId: string;
}) => {
  return await prisma.subscription.upsert({
    create: { userId, status: 'ACTIVE', customerId, providerId, planId },
    update: { userId, status: 'ACTIVE', customerId, providerId, planId },
    where: { uniqueSubscription: { userId, providerId, planId } },
    select: SELECT,
  });
};

// export const create = async (
//   userId: string,
//   payload: {
//     name: string;
//     description?: Maybe<string>;
//   }
// ) => {
//   return await prisma.subscription.create({
//     select: SELECT,
//     data: {
//       userId,
//       name: payload.name.trim(),
//       description: payload.description?.trim(),
//     },
//   });
// };

// export const update = async (
//   userId,
//   id,
//   payload: {
//     name: string;
//     description?: Maybe<string>;
//   }
// ) => {
//   return await prisma.subscription.update({
//     select: SELECT,
//     where: { userId, id },
//     data: {
//       name: payload.name.trim(),
//       description: payload.description?.trim() ?? null,
//     },
//   });
// };

// export const deleteOrganization = async (userId, id) => {
//   return await prisma.subscription.delete({
//     select: SELECT,
//     where: { userId, id },
//   });
// };
