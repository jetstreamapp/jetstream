import { prisma } from '@jetstream/api-config';
import { TokenSource, TokenSourceBrowserExtensions, TokenSourceDesktop } from '@jetstream/auth/types';
import { Prisma } from '@jetstream/prisma';
import { addDays } from 'date-fns';

export type TokenTypeAuthToken = 'AUTH_TOKEN';
export type TokenType = TokenTypeAuthToken;

export const TOKEN_TYPE_AUTH: TokenTypeAuthToken = 'AUTH_TOKEN';

export const TOKEN_SOURCE_BROWSER_EXTENSION: TokenSourceBrowserExtensions = 'BROWSER_EXTENSION';
export const TOKEN_SOURCE_DESKTOP: TokenSourceDesktop = 'DESKTOP';

const SELECT = {
  id: true,
  userId: true,
  user: {
    select: {
      entitlements: { select: { chromeExtension: true, googleDrive: true, recordSync: true, desktop: true } },
      teamMembership: {
        select: {
          status: true,
          team: {
            select: {
              entitlements: { select: { chromeExtension: true, googleDrive: true, recordSync: true, desktop: true } },
            },
          },
        },
      },
    },
  },
  type: true,
  source: true,
  token: true,
  deviceId: true,
  ipAddress: true,
  userAgent: true,
  expiresAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.WebExtensionTokenSelect;

export const findByUserIdAndDeviceId = async ({
  userId,
  deviceId,
  type,
  expiresAtBufferDays = 0,
}: {
  userId: string;
  deviceId: string;
  type: TokenType;
  /**
   * Optional buffer in days to check for token expiration.
   * e.g. only return token if it is valid for at least this many days.
   * This is useful to avoid returning tokens that are about to expire and instead auto-refresh them.
   * Defaults to 0, meaning it will only return tokens that are not expired.
   */
  expiresAtBufferDays?: number;
}) => {
  const expiresAt = addDays(new Date(), expiresAtBufferDays);
  return await prisma.webExtensionToken.findUnique({
    where: {
      type_userId_deviceId: { type, userId, deviceId },
      expiresAt: { gt: expiresAt },
    },
    select: SELECT,
  });
};

export const findByAccessTokenAndDeviceId = async ({ token, deviceId, type }: { token: string; deviceId: string; type: TokenType }) => {
  return await prisma.webExtensionToken.findUnique({
    where: {
      type_token_deviceId: { type, deviceId, token },
      expiresAt: { gt: new Date() },
    },
    select: SELECT,
  });
};

export const create = async (
  userId: string,
  payload: {
    type: TokenType;
    source: TokenSource;
    token: string;
    deviceId: string;
    ipAddress: string;
    userAgent: string;
    expiresAt: Date;
  },
) => {
  return await prisma.webExtensionToken.upsert({
    select: SELECT,
    create: { userId, ...payload },
    update: { userId, ...payload },
    where: {
      type_userId_deviceId: { type: payload.type, userId, deviceId: payload.deviceId },
    },
  });
};

export const deleteByUserIdAndDeviceId = async ({ userId, deviceId, type }: { userId: string; deviceId: string; type: TokenType }) => {
  await prisma.webExtensionToken.deleteMany({
    where: { type, userId, deviceId },
  });
};
