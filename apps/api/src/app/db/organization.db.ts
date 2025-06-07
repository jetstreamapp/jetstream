/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { prisma } from '@jetstream/api-config';
import { Prisma } from '@jetstream/prisma';
import { Maybe } from '@jetstream/types';

const SELECT = Prisma.validator<Prisma.JetstreamOrganizationSelect>()({
  id: true,
  orgs: {
    select: { uniqueId: true },
  },
  name: true,
  description: true,
  createdAt: true,
  updatedAt: true,
});

export const findByUserId = async ({ userId }: { userId: string }) => {
  return await prisma.jetstreamOrganization.findMany({ where: { userId }, select: SELECT });
};

export const findById = async ({ id, userId }: { id: string; userId: string }) => {
  return await prisma.jetstreamOrganization.findFirstOrThrow({ where: { id, userId }, select: SELECT });
};

export const create = async (
  userId: string,
  payload: {
    name: string;
    description?: Maybe<string>;
  }
) => {
  return await prisma.jetstreamOrganization.create({
    select: SELECT,
    data: {
      userId,
      name: payload.name.trim(),
      description: payload.description?.trim(),
    },
  });
};

export const update = async (
  userId,
  id,
  payload: {
    name: string;
    description?: Maybe<string>;
  }
) => {
  return await prisma.jetstreamOrganization.update({
    select: SELECT,
    where: { userId, id },
    data: {
      name: payload.name.trim(),
      description: payload.description?.trim() ?? null,
    },
  });
};

export const deleteOrganization = async (userId, id) => {
  return await prisma.jetstreamOrganization.delete({
    select: SELECT,
    where: { userId, id },
  });
};
