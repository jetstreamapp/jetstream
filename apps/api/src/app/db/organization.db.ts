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

/**
 * Delete an org group along with every org in it, atomically.
 * Returns the deleted orgs so the caller can record an audit log entry for each one.
 */
export const deleteOrgGroupAndAllOrgs = async (userId: string, id: string) => {
  return await prisma.$transaction(async (tx) => {
    const orgsInGroupWhere = { jetstreamOrganizationId: id, jetstreamUserId2: userId } satisfies Prisma.SalesforceOrgWhereInput;

    const deletedOrgs = await tx.salesforceOrg.findMany({
      select: { uniqueId: true, username: true, label: true, orgName: true, loginUrl: true, instanceUrl: true, orgIsSandbox: true },
      where: orgsInGroupWhere,
    });

    await tx.salesforceOrg.deleteMany({ where: orgsInGroupWhere });

    const orgGroup = await tx.jetstreamOrganization.delete({
      select: SELECT,
      where: { userId, id },
    });

    return { orgGroup, deletedOrgs };
  });
};
