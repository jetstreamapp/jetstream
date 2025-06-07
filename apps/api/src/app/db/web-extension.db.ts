import { prisma } from '@jetstream/api-config';
import { Prisma } from '@jetstream/prisma';

export type TokenTypeAuthToken = 'AUTH_TOKEN';
export type TokenType = TokenTypeAuthToken;

export const TOKEN_TYPE_AUTH: TokenTypeAuthToken = 'AUTH_TOKEN';

const SELECT = Prisma.validator<Prisma.WebExtensionTokenSelect>()({
  id: true,
  userId: true,
  user: {
    select: {
      entitlements: { select: { chromeExtension: true, googleDrive: true, recordSync: true, desktop: true } },
    },
  },
  type: true,
  token: true,
  deviceId: true,
  ipAddress: true,
  userAgent: true,
  expiresAt: true,
  createdAt: true,
  updatedAt: true,
});

export const findByUserIdAndDeviceId = async ({ userId, deviceId, type }: { userId: string; deviceId: string; type: TokenType }) => {
  return await prisma.webExtensionToken.findUnique({
    where: {
      type_userId_deviceId: { type, userId, deviceId },
      expiresAt: { lt: new Date() },
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
    token: string;
    deviceId: string;
    ipAddress: string;
    userAgent: string;
    expiresAt: Date;
  }
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
