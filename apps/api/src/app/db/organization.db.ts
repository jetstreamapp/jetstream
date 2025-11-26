import { prisma } from '@jetstream/api-config';
import { Prisma } from '@jetstream/prisma';
import { Maybe } from '@jetstream/types';

const SELECT = {
  id: true,
  orgs: {
    select: { uniqueId: true },
  },
  name: true,
  description: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.JetstreamOrganizationSelect;

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
  },
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
  },
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

export const deleteOrgGroup = async (userId, id) => {
  return await prisma.jetstreamOrganization.delete({
    select: SELECT,
    where: { userId, id },
  });
};

export const deleteOrgGroupAndAllOrgs = async (userId: string, id: string) => {
  // First get the organization to get all org IDs
  const organization = await prisma.jetstreamOrganization.findFirstOrThrow({
    where: { userId, id },
    select: { id: true, orgs: { select: { id: true, uniqueId: true } } },
  });

  // Delete all salesforce orgs associated with this organization
  await prisma.salesforceOrg.deleteMany({
    where: {
      id: { in: organization.orgs.map((org) => org.id) },
      jetstreamUserId2: userId,
    },
  });

  // Delete the organization
  return await prisma.jetstreamOrganization.delete({
    select: SELECT,
    where: { userId, id },
  });
};
