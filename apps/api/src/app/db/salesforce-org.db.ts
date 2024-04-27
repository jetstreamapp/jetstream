/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { ENV, prisma } from '@jetstream/api-config';
import { decryptString, encryptString, hexToBase64 } from '@jetstream/shared/node-utils';
import { Maybe, SalesforceOrgUi } from '@jetstream/types';
import { Prisma, SalesforceOrg } from '@prisma/client';
import { parseISO } from 'date-fns/parseISO';
import isUndefined from 'lodash/isUndefined';

const SELECT = Prisma.validator<Prisma.SalesforceOrgSelect>()({
  uniqueId: true,
  label: true,
  filterText: true,
  instanceUrl: true,
  loginUrl: true,
  userId: true,
  email: true,
  organizationId: true,
  username: true,
  displayName: true,
  thumbnail: true,
  apiVersion: true,
  orgName: true,
  orgCountry: true,
  orgOrganizationType: true,
  orgInstanceName: true,
  orgIsSandbox: true,
  orgLanguageLocaleKey: true,
  orgNamespacePrefix: true,
  orgTrialExpirationDate: true,
  color: true,
  connectionError: true,
  createdAt: true,
  updatedAt: true,
});

/**
 * TODO: add better error handling with non-db error messages!
 */

const findUniqueOrg = ({ jetstreamUserId, uniqueId }: { jetstreamUserId: string; uniqueId: string }) => {
  return Prisma.validator<Prisma.SalesforceOrgWhereUniqueInput>()({
    uniqueOrg: {
      jetstreamUserId,
      jetstreamUrl: ENV.JETSTREAM_SERVER_URL!,
      uniqueId: uniqueId,
    },
  });
};

const findUsersOrgs = ({ jetstreamUserId }: { jetstreamUserId: string }) => {
  return Prisma.validator<Prisma.SalesforceOrgWhereInput>()({
    jetstreamUserId,
    jetstreamUrl: ENV.JETSTREAM_SERVER_URL,
  });
};

export function encryptAccessToken(accessToken: string, refreshToken: string) {
  return encryptString(`${accessToken} ${refreshToken}`, hexToBase64(ENV.SFDC_CONSUMER_SECRET!));
}

export function decryptAccessToken(encryptedAccessToken: string) {
  return decryptString(encryptedAccessToken, hexToBase64(ENV.SFDC_CONSUMER_SECRET!)).split(' ');
}

/**
 * Finds by unique id and returns all fields
 * This is unsafe to send to the browser and should only be used internally
 *
 * @param jetstreamUserId
 * @param uniqueId
 * @returns
 */
export async function findByUniqueId_UNSAFE(jetstreamUserId: string, uniqueId: string) {
  return await prisma.salesforceOrg.findUnique({
    where: findUniqueOrg({ jetstreamUserId, uniqueId }),
  });
}

export async function updateAccessToken_UNSAFE(org: SalesforceOrg, accessToken: string, refreshToken: string) {
  return await prisma.salesforceOrg.update({
    where: { id: org.id },
    data: {
      accessToken: encryptAccessToken(accessToken, refreshToken),
    },
  });
}

export async function updateOrg_UNSAFE(org: SalesforceOrg, data: Partial<SalesforceOrg>) {
  return await prisma.salesforceOrg.update({
    where: { id: org.id },
    data: data,
  });
}

export async function findByUniqueId(jetstreamUserId: string, uniqueId: string) {
  return await prisma.salesforceOrg.findUnique({
    select: SELECT,
    where: findUniqueOrg({ jetstreamUserId, uniqueId }),
  });
}

export async function findByUserId(jetstreamUserId: string) {
  return await prisma.salesforceOrg.findMany({
    select: SELECT,
    where: findUsersOrgs({ jetstreamUserId }),
  });
}

export async function createOrUpdateSalesforceOrg(jetstreamUserId: string, salesforceOrgUi: Partial<SalesforceOrgUi>) {
  const existingOrg = await prisma.salesforceOrg.findUnique({
    where: findUniqueOrg({ jetstreamUserId, uniqueId: salesforceOrgUi.uniqueId! }),
  });

  let orgToDelete: Maybe<{ id: number }>;
  /**
   * After a sandbox refresh, the orgId will change but the username will remain the same
   * There cannot be two different orgs with the same username since this is globally unique on Salesforce
   * After a user does a sandbox refresh, this deletes the old org no matter how the user initiated the connection
   */
  if (salesforceOrgUi.organizationId && salesforceOrgUi.username) {
    orgToDelete = await prisma.salesforceOrg.findFirst({
      select: { id: true },
      where: {
        jetstreamUserId: { equals: jetstreamUserId },
        jetstreamUrl: { equals: ENV.JETSTREAM_SERVER_URL! },
        username: { equals: salesforceOrgUi.username },
        uniqueId: { not: { equals: salesforceOrgUi.uniqueId! } },
      },
    });
  }

  if (existingOrg) {
    const data: Prisma.SalesforceOrgUpdateInput = {
      uniqueId: salesforceOrgUi.uniqueId ?? existingOrg.uniqueId,
      accessToken: salesforceOrgUi.accessToken ?? existingOrg.accessToken,
      instanceUrl: salesforceOrgUi.instanceUrl ?? existingOrg.instanceUrl,
      loginUrl: salesforceOrgUi.loginUrl ?? existingOrg.loginUrl,
      userId: salesforceOrgUi.userId ?? existingOrg.userId,
      email: salesforceOrgUi.email ?? existingOrg.email,
      label: salesforceOrgUi.label ?? existingOrg.label,
      organizationId: salesforceOrgUi.organizationId ?? existingOrg.organizationId,
      username: salesforceOrgUi.username ?? existingOrg.username,
      displayName: salesforceOrgUi.displayName ?? existingOrg.displayName,
      thumbnail: salesforceOrgUi.thumbnail ?? existingOrg.thumbnail,
      apiVersion: salesforceOrgUi.apiVersion ?? existingOrg.apiVersion,
      orgName: salesforceOrgUi.orgName ?? existingOrg.orgName,
      orgCountry: salesforceOrgUi.orgCountry ?? existingOrg.orgCountry,
      orgOrganizationType: salesforceOrgUi.orgOrganizationType ?? existingOrg.orgOrganizationType,
      orgInstanceName: salesforceOrgUi.orgInstanceName ?? existingOrg.orgInstanceName,
      orgIsSandbox: salesforceOrgUi.orgIsSandbox ?? existingOrg.orgIsSandbox,
      orgLanguageLocaleKey: salesforceOrgUi.orgLanguageLocaleKey ?? existingOrg.orgLanguageLocaleKey,
      orgNamespacePrefix: salesforceOrgUi.orgNamespacePrefix ?? existingOrg.orgNamespacePrefix,
      orgTrialExpirationDate: salesforceOrgUi.orgTrialExpirationDate
        ? parseISO(salesforceOrgUi.orgTrialExpirationDate)
        : existingOrg.orgTrialExpirationDate,
      connectionError: null,
    };
    data.label = data.label || data.username;
    data.filterText = `${data.username}${data.orgName}${data.label}`;
    // update existing
    const org = await prisma.salesforceOrg.update({
      select: SELECT,
      where: { id: existingOrg.id },
      data,
    });
    if (orgToDelete) {
      await prisma.salesforceOrg.delete({ where: { id: orgToDelete.id } });
    }
    return org;
  } else {
    // create new
    const org = await prisma.salesforceOrg.create({
      select: SELECT,
      data: {
        jetstreamUserId,
        jetstreamUrl: ENV.JETSTREAM_SERVER_URL,
        label: salesforceOrgUi.label || salesforceOrgUi.username,
        uniqueId: salesforceOrgUi.uniqueId!,
        accessToken: salesforceOrgUi.accessToken!,
        instanceUrl: salesforceOrgUi.instanceUrl!,
        loginUrl: salesforceOrgUi.loginUrl!,
        userId: salesforceOrgUi.userId!,
        email: salesforceOrgUi.email!,
        organizationId: salesforceOrgUi.organizationId!,
        username: salesforceOrgUi.username!,
        displayName: salesforceOrgUi.displayName!,
        thumbnail: salesforceOrgUi.thumbnail,
        apiVersion: salesforceOrgUi.apiVersion,
        orgName: salesforceOrgUi.orgName,
        orgCountry: salesforceOrgUi.orgCountry,
        orgOrganizationType: salesforceOrgUi.orgOrganizationType,
        orgInstanceName: salesforceOrgUi.orgInstanceName,
        orgIsSandbox: salesforceOrgUi.orgIsSandbox,
        orgLanguageLocaleKey: salesforceOrgUi.orgLanguageLocaleKey,
        orgNamespacePrefix: salesforceOrgUi.orgNamespacePrefix,
        orgTrialExpirationDate: salesforceOrgUi.orgTrialExpirationDate && parseISO(salesforceOrgUi.orgTrialExpirationDate),
        connectionError: null,
        filterText: `${salesforceOrgUi.username}${salesforceOrgUi.orgName}${salesforceOrgUi.label}`,
      },
    });
    if (orgToDelete) {
      await prisma.salesforceOrg.delete({ where: { id: orgToDelete.id } });
    }
    return org;
  }
}

export async function updateSalesforceOrg(jetstreamUserId: string, uniqueId: string, data: { label: string; color?: string | null }) {
  const existingOrg = await prisma.salesforceOrg.findUnique({
    select: { id: true, username: true, label: true, orgName: true, color: true },
    where: findUniqueOrg({ jetstreamUserId, uniqueId }),
  });

  if (!existingOrg) {
    throw new Error('An org does not exist with the provided input');
  }

  const label = data.label || existingOrg.username;
  const color = isUndefined(data.color) ? existingOrg.color : data.color;

  return await prisma.salesforceOrg.update({
    select: SELECT,
    where: { id: existingOrg.id },
    data: {
      label,
      color,
      filterText: `${existingOrg.username}${existingOrg.orgName}${label}`,
    },
  });
}

export async function deleteSalesforceOrg(jetstreamUserId: string, uniqueId: string) {
  const existingOrg = await prisma.salesforceOrg.findUnique({
    select: { id: true, username: true, label: true, orgName: true },
    where: findUniqueOrg({ jetstreamUserId, uniqueId }),
  });

  if (!existingOrg) {
    throw new Error('An org does not exist with the provided input');
  }

  await prisma.salesforceOrg.delete({
    select: { id: true },
    where: { id: existingOrg.id },
  });
}
