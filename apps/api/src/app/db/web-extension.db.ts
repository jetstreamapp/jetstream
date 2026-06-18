import { logger, prisma } from '@jetstream/api-config';
import { OauthProviderType, SsoProviderType, TokenSource, TokenSourceBrowserExtensions, TokenSourceDesktop } from '@jetstream/auth/types';
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
  firstAppVersion: true,
  lastAppVersion: true,
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
    provider?: OauthProviderType | SsoProviderType | 'credentials';
    providerAccountId?: string;
    /** Client app version (X-App-Version). Sets firstAppVersion once on create and lastAppVersion on every login. */
    appVersion?: string;
  },
) => {
  // Pull appVersion out so it isn't spread into the Prisma data (it maps to firstAppVersion/lastAppVersion)
  const { appVersion, ...tokenData } = payload;
  // Encrypt the token before storing and create hash for lookup
  const token = encryptJwtToken(payload.token);
  const tokenHash = hashToken(payload.token);

  return await prisma.webExtensionToken.upsert({
    select: SELECT,
    create: {
      userId,
      ...tokenData,
      token,
      tokenHash,
      firstAppVersion: appVersion ?? null,
      lastAppVersion: appVersion ?? null,
    },
    update: {
      userId,
      ...tokenData,
      token,
      tokenHash,
      // Coerce undefined to null so a re-login with a different auth method doesn't leave stale values
      provider: payload.provider ?? null,
      providerAccountId: payload.providerAccountId ?? null,
      // Refresh lastAppVersion on re-login, but leave firstAppVersion untouched ("set once").
      // `undefined` tells Prisma to skip the column when no version was provided.
      lastAppVersion: appVersion ?? undefined,
    },
    where: {
      type_userId_deviceId: { type: payload.type, userId, deviceId: payload.deviceId },
    },
  });
};

/**
 * Conditionally replace a token only if the current tokenHash matches oldTokenHash.
 * Prevents a race where two concurrent rotation requests both replace the same token,
 * leaving one client with an invalid token.
 * Returns true if the token was replaced, false if it was already rotated by another request.
 */
export const replaceTokenIfCurrent = async (
  userId: string,
  oldTokenHash: string,
  payload: {
    type: TokenType;
    source: TokenSource;
    token: string;
    deviceId: string;
    ipAddress: string;
    userAgent: string;
    expiresAt: Date;
    /** Client app version (X-App-Version) at this refresh — updates lastAppVersion only. */
    appVersion?: string;
  },
): Promise<boolean> => {
  const token = encryptJwtToken(payload.token);
  const tokenHash = hashToken(payload.token);

  const result = await prisma.webExtensionToken.updateMany({
    where: {
      type: payload.type,
      userId,
      deviceId: payload.deviceId,
      tokenHash: oldTokenHash,
    },
    data: {
      token,
      tokenHash,
      source: payload.source,
      ipAddress: payload.ipAddress,
      userAgent: payload.userAgent,
      expiresAt: payload.expiresAt,
      // `undefined` skips the column when no version was provided; never touch firstAppVersion here.
      lastAppVersion: payload.appVersion ?? undefined,
    },
  });

  return result.count > 0;
};

export const deleteByUserIdAndDeviceId = async ({ userId, deviceId, type }: { userId: string; deviceId: string; type: TokenType }) => {
  await prisma.webExtensionToken.deleteMany({
    where: { type, userId, deviceId },
  });
};
