/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { ENV, prisma } from '@jetstream/api-config';
import { decryptString, encryptString, hexToBase64 } from '@jetstream/shared/node-utils';
import { Maybe, SalesforceOrgUi } from '@jetstream/types';
import { Prisma, SalesforceOrg } from '@prisma/client';
import { parseISO } from 'date-fns/parseISO';
import isUndefined from 'lodash/isUndefined';
import { NotFoundError } from '../utils/error-handler';

const SELECT = Prisma.validator<Prisma.SalesforceOrgSelect>()({
  jetstreamOrganizationId: true,
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

export const SALESFORCE_ORG_SELECT = SELECT;

const findUniqueOrg = ({ userId, uniqueId }: { userId: string; uniqueId: string }) => {
  return Prisma.validator<Prisma.SalesforceOrgWhereUniqueInput>()({
    uniqueOrg: {
      jetstreamUserId2: userId,
      jetstreamUrl: ENV.JETSTREAM_SERVER_URL,
      uniqueId: uniqueId,
    },
  });
};

const findUsersOrgs = ({ userId }: { userId: string }) => {
  return Prisma.validator<Prisma.SalesforceOrgWhereInput>()({
    jetstreamUserId2: userId,
    jetstreamUrl: ENV.JETSTREAM_SERVER_URL,
  });
};

export function encryptAccessToken(accessToken: string, refreshToken: string) {
  return encryptString(`${accessToken} ${refreshToken}`, hexToBase64(ENV.SFDC_CONSUMER_SECRET));
}

export function decryptAccessToken(encryptedAccessToken: string) {
  // FIXME: we should use a dedicated encryption key for this
  // TODO: if org is not used for X timeperiod, we should auto-expire the token
  return decryptString(encryptedAccessToken, hexToBase64(ENV.SFDC_CONSUMER_SECRET)).split(' ');
}

/**
 * Finds by unique id and returns all fields
 * This is unsafe to send to the browser and should only be used internally
 *
 * @param userId
 * @param uniqueId
 * @returns
 */
export async function findByUniqueId_UNSAFE(userId: string, uniqueId: string) {
  return await prisma.salesforceOrg.findUnique({
    where: findUniqueOrg({ userId, uniqueId }),
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

export async function findByUniqueId(userId: string, uniqueId: string) {
  return await prisma.salesforceOrg.findUnique({
    select: SELECT,
    where: findUniqueOrg({ userId, uniqueId }),
  });
}

export async function findByUserId(userId: string) {
  return await prisma.salesforceOrg.findMany({
    select: SELECT,
    where: findUsersOrgs({ userId }),
  });
}

export async function createOrUpdateSalesforceOrg(userId: string, salesforceOrgUi: Partial<SalesforceOrgUi>) {
  const userWithOrgs = await prisma.user.findFirstOrThrow({
    where: { id: userId },
    select: { id: true, userId: true, salesforceOrgs: true },
  });
  const existingOrg = userWithOrgs.salesforceOrgs.find((org) => org.uniqueId === salesforceOrgUi.uniqueId);

  if (!salesforceOrgUi.uniqueId) {
    throw new Error('uniqueId is required');
  }

  let orgToDelete: Maybe<{ id: number }>;
  /**
   * After a sandbox refresh, the orgId will change but the username will remain the same
   * There cannot be two different orgs with the same username since this is globally unique on Salesforce
   * After a user does a sandbox refresh, this deletes the old org no matter how the user initiated the connection
   */
  if (salesforceOrgUi.organizationId && salesforceOrgUi.username) {
    orgToDelete = userWithOrgs.salesforceOrgs.find(
      ({ uniqueId, username, jetstreamUrl }) =>
        uniqueId !== salesforceOrgUi.uniqueId && username === salesforceOrgUi.username && jetstreamUrl === ENV.JETSTREAM_SERVER_URL
    );
  }

  if (existingOrg) {
    const data: Prisma.XOR<Prisma.SalesforceOrgUpdateInput, Prisma.SalesforceOrgUncheckedUpdateInput> = {
      jetstreamOrganizationId: salesforceOrgUi.jetstreamOrganizationId ?? existingOrg.jetstreamOrganizationId,
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
        jetstreamUserId2: userWithOrgs.id,
        jetstreamUserId: userWithOrgs.userId,
        jetstreamUrl: ENV.JETSTREAM_SERVER_URL,
        jetstreamOrganizationId: salesforceOrgUi.jetstreamOrganizationId,
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

export async function updateSalesforceOrg(userId: string, uniqueId: string, data: { label: string; color?: string | null }) {
  const existingOrg = await prisma.salesforceOrg.findUnique({
    select: { id: true, username: true, label: true, orgName: true, color: true },
    where: findUniqueOrg({ userId, uniqueId }),
  });

  if (!existingOrg) {
    throw new NotFoundError('An org does not exist with the provided input');
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

export async function moveSalesforceOrg(userId: string, uniqueId: string, data: { jetstreamOrganizationId?: Maybe<string> }) {
  const existingOrg = await prisma.salesforceOrg.findUnique({
    select: { id: true },
    where: findUniqueOrg({ userId, uniqueId }),
  });

  if (!existingOrg) {
    throw new NotFoundError('An org does not exist with the provided input');
  }

  return await prisma.salesforceOrg.update({
    select: SELECT,
    where: { id: existingOrg.id },
    data: {
      jetstreamOrganizationId: data.jetstreamOrganizationId ?? null,
    },
  });
}

export async function deleteSalesforceOrg(userId: string, uniqueId: string) {
  const existingOrg = await prisma.salesforceOrg.findUnique({
    select: { id: true, username: true, label: true, orgName: true },
    where: findUniqueOrg({ userId, uniqueId }),
  });

  if (!existingOrg) {
    throw new NotFoundError('An org does not exist with the provided input');
  }

  await prisma.salesforceOrg.delete({
    select: { id: true },
    where: { id: existingOrg.id },
  });
}
