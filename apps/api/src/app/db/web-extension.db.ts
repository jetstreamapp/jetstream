import { logger, prisma } from '@jetstream/api-config';
import { TokenSource, TokenSourceBrowserExtensions, TokenSourceDesktop } from '@jetstream/auth/types';
import { Prisma } from '@jetstream/prisma';
import { getErrorMessage } from '@jetstream/shared/utils';
import { addDays } from 'date-fns';
import { encryptJwtToken, hashToken, isTokenEncrypted } from '../services/jwt-token-encryption.service';

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
  tokenHash: true,
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

/**
 * Upgrade a legacy token (plaintext) to encrypted format
 * This is called automatically when we encounter an old token during migration
 */
async function upgradeLegacyToken(recordId: string, plaintextToken: string): Promise<void> {
  try {
    const encryptedToken = encryptJwtToken(plaintextToken);
    const tokenHash = hashToken(plaintextToken);

    await prisma.webExtensionToken.update({
      where: { id: recordId },
      data: {
        token: encryptedToken,
        tokenHash,
      },
    });
  } catch (error) {
    logger.error({ error: getErrorMessage(error) }, 'Failed to upgrade legacy token');
  }
}

export const findByAccessTokenAndDeviceId = async ({ token, deviceId, type }: { token: string; deviceId: string; type: TokenType }) => {
  const tokenHashValue = hashToken(token);

  const record = await prisma.webExtensionToken.findUnique({
    where: {
      type_tokenHash_deviceId: { type, deviceId, tokenHash: tokenHashValue },
      expiresAt: { gt: new Date() },
    },
    select: SELECT,
  });

  // TEMPORARY: This is here to prevent breaking changes during migration
  // Ticket to resolve: #1494
  // After all tokens have been encrypted, we can remove this block
  // Auto-upgrade legacy tokens to encrypted format
  if (record && !isTokenEncrypted(record.token)) {
    await upgradeLegacyToken(record.id, token).catch((err) => {
      logger.error({ error: getErrorMessage(err) }, 'Failed to upgrade legacy token');
    });
  }

  return record;
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
  // Encrypt the token before storing and create hash for lookup
  const token = encryptJwtToken(payload.token);
  const tokenHash = hashToken(payload.token);

  return await prisma.webExtensionToken.upsert({
    select: SELECT,
    create: { userId, ...payload, token, tokenHash },
    update: { userId, ...payload, token, tokenHash },
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
