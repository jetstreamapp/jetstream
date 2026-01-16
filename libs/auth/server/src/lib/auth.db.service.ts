import { ENV, logger, prisma } from '@jetstream/api-config';
import {
  AuthenticatedUser,
  AuthenticatedUserSchema,
  ExternalTokenSessionWithLocation,
  LoginActivityUserFacing,
  LoginConfiguration,
  LoginConfigurationSchema,
  OauthProviderType,
  ProviderTypeCredentials,
  ProviderTypeOauth,
  ProviderUser,
  SessionData,
  TokenSource,
  TwoFactorType,
  TwoFactorTypeOtp,
  TwoFactorTypeWithoutEmail,
  UserProfileSession,
  UserSession,
  UserSessionAndExtTokensAndActivityWithLocation,
  UserSessionWithLocation,
  UserSessionWithLocationAndUser,
} from '@jetstream/auth/types';
import { Prisma } from '@jetstream/prisma';
import { decryptString, encryptString } from '@jetstream/shared/node-utils';
import {
  ACCOUNT_LOCKOUT_DURATION_MINUTES,
  getErrorMessageAndStackObj,
  groupByFlat,
  MAX_FAILED_LOGIN_ATTEMPTS,
  PASSWORD_HISTORY_COUNT,
} from '@jetstream/shared/utils';
import { Maybe, TEAM_MEMBER_STATUS_ACTIVE } from '@jetstream/types';
import { addDays, startOfDay } from 'date-fns';
import { addMinutes } from 'date-fns/addMinutes';
import clamp from 'lodash/clamp';
import { LRUCache } from 'lru-cache';
import { actionDisplayName, methodDisplayName } from './auth-logging.db.service';
import {
  DELETE_AUTH_ACTIVITY_DAYS,
  DELETE_EMAIL_ACTIVITY_DAYS,
  DELETE_TOKEN_DAYS,
  PASSWORD_RESET_DURATION_MINUTES,
} from './auth.constants';
import {
  AccountLocked,
  IdentityLinkingNotAllowed,
  InactiveUser,
  InvalidAction,
  InvalidCredentials,
  InvalidOrExpiredResetToken,
  InvalidProvider,
  LoginWithExistingIdentity,
  PasswordResetRequired,
  PasswordReused,
  ProviderEmailNotVerified,
  ProviderNotAllowed,
} from './auth.errors';
import { ensureAuthError, lookupGeoLocationFromIpAddresses } from './auth.service';
import { checkUserAgentSimilarity, hashPassword, REMEMBER_DEVICE_DAYS, verifyPassword } from './auth.utils';

// This is potentially accessed multiple times in a transaction for a user, cache data to avoid DB access
const LOGIN_CONFIGURATION_CACHE = new LRUCache<string, { value: LoginConfiguration | null }>({
  max: 500,
  // 1 minute
  ttl: 1000 * 60,
});

export const PLACEHOLDER_USER_ID = '00000000-0000-0000-0000-000000000000';
export const PLACEHOLDER_USER = AuthenticatedUserSchema.parse({
  id: PLACEHOLDER_USER_ID,
  userId: `invalid|${PLACEHOLDER_USER_ID}`,
  name: 'Invalid User',
  email: 'invalid@invalid.com',
  emailVerified: false,
  authFactors: [],
  teamMembership: null,
} satisfies AuthenticatedUser);

// Mirrors AuthenticatedUserSchema
const AuthenticatedUserSelect = {
  id: true,
  userId: true,
  name: true,
  email: true,
  emailVerified: true,
  appMetadata: false,
  authFactors: {
    select: {
      type: true,
      enabled: true,
      secret: false,
    },
  },
  teamMembership: {
    select: {
      teamId: true,
      role: true,
      status: true,
    },
    where: {
      team: {
        status: 'ACTIVE',
      },
    },
  },
} satisfies Prisma.UserSelect;

export async function pruneExpiredRecords() {
  await prisma.loginActivity.deleteMany({
    where: {
      createdAt: { lte: addDays(startOfDay(new Date()), -DELETE_AUTH_ACTIVITY_DAYS) },
    },
  });
  await prisma.emailActivity.deleteMany({
    where: {
      createdAt: { lte: addDays(startOfDay(new Date()), -DELETE_EMAIL_ACTIVITY_DAYS) },
    },
  });
  await prisma.passwordResetToken.deleteMany({
    where: {
      expiresAt: { lte: addDays(startOfDay(new Date()), -DELETE_TOKEN_DAYS) },
    },
  });
  await prisma.rememberedDevice.deleteMany({
    where: {
      expiresAt: { lte: addDays(startOfDay(new Date()), -DELETE_TOKEN_DAYS) },
    },
  });
  await prisma.webExtensionToken.deleteMany({
    where: {
      expiresAt: { lte: addDays(startOfDay(new Date()), -DELETE_TOKEN_DAYS) },
    },
  });
}

async function findUserByProviderId(provider: OauthProviderType, providerAccountId: string) {
  return await prisma.user
    .findFirst({
      select: AuthenticatedUserSelect,
      where: {
        identities: { some: { provider, providerAccountId } },
      },
    })
    .then((user) => {
      if (!user) {
        return user;
      }
      return AuthenticatedUserSchema.parse(user);
    });
}

async function findUsersByEmail(email: string) {
  email = email.toLowerCase();
  return prisma.user
    .findMany({
      select: AuthenticatedUserSelect,
      where: { email },
    })
    .then((user) => AuthenticatedUserSchema.array().parse(user));
}

/**
 * This should only be used for internal purposes, such as when a user is already authenticated
 */
export async function findUserById_UNSAFE(id: string) {
  return await prisma.user
    .findFirstOrThrow({
      select: AuthenticatedUserSelect,
      where: { id },
    })
    .then((user) => AuthenticatedUserSchema.parse(user));
}

export function clearLoginConfigurationCacheItem(key: string) {
  LOGIN_CONFIGURATION_CACHE.delete(key);
}

export async function getLoginConfiguration(
  options: { email: string; skipCache?: boolean } | { teamId: string; skipCache?: false },
): Promise<LoginConfiguration | null> {
  const { skipCache = false } = options;

  if ('teamId' in options) {
    const { teamId } = options;
    return prisma.team
      .findFirst({
        select: {
          loginConfig: {
            select: {
              id: true,
              allowedMfaMethods: true,
              allowedProviders: true,
              requireMfa: true,
              allowIdentityLinking: true,
              autoAddToTeam: true,
              team: {
                select: {
                  id: true,
                },
              },
            },
          },
        },
        where: { id: teamId },
      })
      .then((team) => {
        const config = team?.loginConfig;
        if (!config) {
          return null;
        }
        const value = LoginConfigurationSchema.parse(config);
        return value;
      });
  } else {
    // TODO: after we launch teams, deprecate login config which is not used by a team
    const { email } = options;
    const domain = email?.split('@')[1]?.toLowerCase();

    if (!domain) {
      return null;
    }

    const cachedValue = skipCache ? undefined : LOGIN_CONFIGURATION_CACHE.get(domain);
    if (cachedValue) {
      return cachedValue.value;
    }

    return prisma.loginConfiguration
      .findFirst({
        select: {
          id: true,
          allowedMfaMethods: true,
          allowedProviders: true,
          requireMfa: true,
          allowIdentityLinking: true,
          autoAddToTeam: true,
          team: {
            select: {
              id: true,
            },
          },
        },
        where: { domains: { has: domain } },
      })
      .then((config) => {
        if (!config) {
          return null;
        }
        const value = LoginConfigurationSchema.parse(config);
        LOGIN_CONFIGURATION_CACHE.set(domain, { value });
        return value;
      });
  }
}

export async function setUserEmailVerified(id: string) {
  return prisma.user
    .update({
      select: AuthenticatedUserSelect,
      data: { emailVerified: true },
      where: { id },
    })
    .then((user) => AuthenticatedUserSchema.parse(user));
}

export async function createRememberDevice({
  deviceId,
  ipAddress,
  userId,
  userAgent,
}: {
  userId: string;
  deviceId: string;
  ipAddress: string;
  userAgent?: Maybe<string>;
}) {
  return prisma.rememberedDevice.create({
    select: { id: true },
    data: {
      userId,
      deviceId,
      ipAddress,
      userAgent,
      expiresAt: addDays(new Date(), REMEMBER_DEVICE_DAYS),
    },
  });
}

export async function hasRememberDeviceRecord({
  deviceId,
  ipAddress,
  userId,
  userAgent = null,
}: {
  userId: string;
  deviceId: string;
  ipAddress: string;
  userAgent?: Maybe<string>;
}) {
  try {
    const rememberMe = await prisma.rememberedDevice.findFirst({
      select: {
        id: true,
        deviceId: true,
        userAgent: true,
        ipAddress: true,
        expiresAt: true,
      },
      where: {
        userId,
        deviceId,
        expiresAt: { gte: new Date() },
      },
    });

    if (!rememberMe) {
      return false;
    }

    if (rememberMe.userAgent && userAgent) {
      const isSimilar = checkUserAgentSimilarity(rememberMe.userAgent, userAgent);
      if (!isSimilar) {
        logger.warn({ deviceId, userId }, `User agent mismatch for remembered device: ${rememberMe.userAgent} !== ${userAgent}`);
        return false;
      }
    }

    // refresh the expiration date
    await prisma.rememberedDevice.update({
      data: {
        expiresAt: addDays(new Date(), REMEMBER_DEVICE_DAYS),
        ipAddress: ipAddress || rememberMe.ipAddress,
        userAgent: userAgent || rememberMe.userAgent,
      },
      where: { id: rememberMe.id },
    });

    return true;
  } catch (ex) {
    logger.error({ ...getErrorMessageAndStackObj(ex), deviceId, userId }, 'Error checking for remember device record');
    return false;
  }
}

export async function getAuthFactors(userId: string) {
  return prisma.authFactors.findMany({
    select: {
      type: true,
      enabled: true,
      createdAt: true,
      updatedAt: true,
    },
    where: { userId },
  });
}

export async function getTotpAuthenticationFactor(userId: string) {
  return prisma.authFactors
    .findFirstOrThrow({
      select: {
        type: true,
        enabled: true,
        secret: true,
      },
      where: { userId, type: '2fa-otp', enabled: true, secret: { not: null } },
    })
    .then((factor) => {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const secret = decryptString(factor.secret!, ENV.JETSTREAM_AUTH_OTP_SECRET);
      return { type: '2fa-otp', enabled: factor.enabled, secret };
    });
}

export async function createOrUpdateOtpAuthFactor(userId: string, secretPlainText: string) {
  const secret = encryptString(secretPlainText, ENV.JETSTREAM_AUTH_OTP_SECRET);

  const factors = await prisma.authFactors.findMany({
    select: { type: true, userId: true },
    where: { userId, type: { not: '2fa-email' } },
  });
  await prisma.$transaction([
    // Set all others to disabled
    ...factors.map(({ type, userId }) =>
      prisma.authFactors.update({
        data: { enabled: false },
        where: { userId_type: { type, userId } },
      }),
    ),
    // Save the new one
    prisma.authFactors.upsert({
      create: {
        userId,
        type: '2fa-otp',
        enabled: true,
        secret,
      },
      update: {
        type: '2fa-otp',
        enabled: true,
        secret,
      },
      where: { userId_type: { userId, type: '2fa-otp' } },
    }),
  ]);
  return getAuthFactors(userId);
}

/**
 * Checks the login configuration to ensure the action is allowed based on the login configuration
 * If adding a factor, ensure it is allowed
 * If removing/deleting a factor, ensure that a remaining factor still exists if required
 */
async function checkMfaActionAllowedOrThrow(
  user: Pick<UserProfileSession, 'id' | 'email' | 'teamMembership'>,
  type: TwoFactorTypeWithoutEmail,
  action: 'enable' | 'disable' | 'delete',
) {
  const userId = user.id;

  const loginConfiguration = user.teamMembership?.teamId
    ? await getLoginConfiguration({ teamId: user.teamMembership.teamId })
    : await getLoginConfiguration({ email: user.email, skipCache: true });

  if (!loginConfiguration) {
    return null;
  }

  if (action === 'enable' && loginConfiguration.allowedMfaMethods?.has(type) === false) {
    throw new InvalidAction(`MFA factor ${type} is not allowed`);
  }

  if (action !== 'enable' && loginConfiguration.requireMfa) {
    const alternativeActiveAuthFactors = await prisma.authFactors.findMany({
      select: { type: true },
      where: { userId, enabled: true, type: { not: type } },
    });

    const hasOtherAllowedMfaMethods = new Set(loginConfiguration.allowedMfaMethods);
    hasOtherAllowedMfaMethods.delete(type);

    const hasValidAlternativeFactor = alternativeActiveAuthFactors.some(({ type }) =>
      hasOtherAllowedMfaMethods.has(type as TwoFactorTypeWithoutEmail),
    );

    if (!hasValidAlternativeFactor) {
      throw new InvalidAction(`You must have at least one allowed MFA factor enabled`);
    }
  }

  return loginConfiguration;
}

export async function toggleEnableDisableAuthFactor(
  user: Pick<UserProfileSession, 'id' | 'email' | 'teamMembership'>,
  type: TwoFactorTypeWithoutEmail,
  action: 'enable' | 'disable',
) {
  if (!user?.id || !user?.email) {
    throw new Error('Invalid user');
  }

  const userId = user.id;

  await checkMfaActionAllowedOrThrow(user, type, action);

  await prisma.$transaction(async (tx) => {
    // When enabling, ensure all others are disabled
    if (action === 'enable') {
      // For non-totp, ensure we have a record (totp setup is handled separately)
      if (type !== '2fa-otp') {
        await prisma.authFactors.upsert({
          create: { type, userId, enabled: true },
          update: { enabled: true },
          where: { userId_type: { type, userId } },
        });
      } else {
        await tx.authFactors.update({
          data: { enabled: true },
          where: { userId_type: { userId, type } },
        });
      }
    } else {
      await tx.authFactors.update({
        data: { enabled: false },
        where: { userId_type: { userId, type } },
      });
    }
  });
  return getAuthFactors(userId);
}

export async function deleteAuthFactor(user: Pick<UserProfileSession, 'id' | 'email' | 'teamMembership'>, type: TwoFactorTypeWithoutEmail) {
  if (!user?.id || !user?.email) {
    throw new Error('Invalid user');
  }

  await checkMfaActionAllowedOrThrow(user, type, 'delete');

  await prisma.authFactors.delete({
    where: { userId_type: { type, userId: user.id } },
  });
  return getAuthFactors(user.id);
}

export async function getAllSessions(userId: string, currentSessionId: string) {
  if (!userId) {
    throw new Error('Invalid userId');
  }
  const sessions = await getUserSessions(userId);
  const webTokenSessions = await getUserWebExtensionSessions(userId);
  const loginActivity = await getUserActivity(userId);
  const output: UserSessionAndExtTokensAndActivityWithLocation = {
    currentSessionId,
    sessions,
    webTokenSessions,
    loginActivity,
  };
  return output;
}

export async function getUserSessions(userId: string, omitLocationData?: boolean): Promise<UserSessionWithLocation[]> {
  if (!userId) {
    throw new Error('Invalid userId');
  }
  const sessions: UserSessionWithLocation[] = await prisma.sessions
    .findMany({
      select: {
        sid: true,
        sess: true,
        expire: true,
        createdAt: true,
        userId: true,
      },
      where: {
        sess: {
          path: ['user', 'id'],
          equals: userId,
        },
      },
    })
    .then((sessions) => sessions.map(convertSessionToUserSession));

  // Fetch location data and add to each session
  if (!omitLocationData && sessions.length > 0) {
    try {
      return await lookupGeoLocationFromIpAddresses(sessions.map(({ ipAddress }) => ipAddress)).then((locationInfo) =>
        locationInfo.map(
          ({ location }, i): UserSessionWithLocation => ({
            ...sessions[i],
            location,
          }),
        ),
      );
    } catch (ex) {
      logger.warn({ ...getErrorMessageAndStackObj(ex) }, 'Error fetching location data for sessions');
    }
  }

  return sessions;
}

/**
 * Return all user sessions for a team, including location data if available.
 */
export async function getTeamUserSessions({
  teamId,
  omitLocationData,
  limit,
  cursor,
}: {
  teamId: string;
  omitLocationData?: boolean;
  limit?: number;
  cursor?: { sid: string };
}): Promise<UserSessionWithLocationAndUser[]> {
  if (!teamId) {
    throw new Error('Invalid teamId');
  }

  const users = await prisma.teamMember
    .findMany({
      where: { teamId },
      select: {
        userId: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })
    .then((teamMember) => teamMember.map(({ user }) => user));

  const usersById = groupByFlat(users, 'id');
  const userIds = users.map(({ id }) => id);

  const sessions = await prisma.sessions
    .findMany({
      select: { sid: true, sess: true, expire: true, createdAt: true, userId: true },
      orderBy: [{ createdAt: 'desc' }, { sid: 'desc' }],
      where: {
        userId: { in: userIds },
      },
      cursor,
      take: clamp(limit ?? 25, 1, 100),
      skip: cursor ? 1 : 0, // Skip the cursor
    })
    .then((sessions) =>
      sessions.map((session): UserSessionWithLocationAndUser => {
        const userSessionWithLocation = convertSessionToUserSession(session);
        return {
          ...userSessionWithLocation,
          user: usersById[userSessionWithLocation.userId],
        };
      }),
    );

  // Fetch location data and add to each session
  if (!omitLocationData && sessions.length > 0) {
    try {
      return await lookupGeoLocationFromIpAddresses(sessions.map(({ ipAddress }) => ipAddress)).then((locationInfo) =>
        locationInfo.map(
          ({ location }, i): UserSessionWithLocationAndUser => ({
            ...sessions[i],
            location,
          }),
        ),
      );
    } catch (ex) {
      logger.warn({ ...getErrorMessageAndStackObj(ex) }, 'Error fetching location data for sessions');
    }
  }

  return sessions;
}

export async function revokeTeamUserSession({ sessionId, teamId }: { teamId: string; sessionId: string }) {
  if (!teamId) {
    throw new Error('Invalid teamId');
  }

  if (!sessionId) {
    throw new Error('Invalid sessionId');
  }

  const session = await prisma.sessions.findFirst({
    select: { sid: true, userId: true },
    where: {
      sid: sessionId,
    },
  });

  if (!session) {
    throw new Error('Session not found');
  }

  const isValidSession = await prisma.teamMember
    .count({
      where: { teamId, userId: session.userId },
    })
    .then((count) => count === 1);

  if (!isValidSession) {
    throw new Error('Invalid sessionId');
  }

  await prisma.sessions.delete({
    where: { sid: sessionId },
  });
}

export async function getUserWebExtensionSessions(userId: string, omitLocationData?: boolean): Promise<ExternalTokenSessionWithLocation[]> {
  if (!userId) {
    throw new Error('Invalid userId');
  }
  const webTokenSessions = await prisma.webExtensionToken
    .findMany({
      select: {
        id: true,
        source: true,
        createdAt: true,
        expiresAt: true,
        ipAddress: true,
        userAgent: true,
      },
      where: { userId, type: 'AUTH_TOKEN' },
    })
    .then((token) => {
      return token.map((token) => ({
        id: token.id,
        source: token.source as TokenSource,
        createdAt: token.createdAt.toISOString(),
        expiresAt: token.expiresAt.toISOString(),
        ipAddress: token.ipAddress,
        userAgent: token.userAgent,
      }));
    });

  if (!omitLocationData && webTokenSessions.length > 0) {
    try {
      return await lookupGeoLocationFromIpAddresses(webTokenSessions.map(({ ipAddress }) => ipAddress)).then((locationInfo) =>
        locationInfo.map(
          ({ location }, i): ExternalTokenSessionWithLocation => ({
            ...webTokenSessions[i],
            location,
          }),
        ),
      );
    } catch (ex) {
      logger.warn({ ...getErrorMessageAndStackObj(ex) }, 'Error fetching location data for webTokens');
    }
  }

  return webTokenSessions;
}

export async function getUserActivity(userId: string) {
  if (!userId) {
    throw new Error('Invalid userId');
  }
  const recentActivity: LoginActivityUserFacing[] = await prisma.loginActivity
    .findMany({
      select: {
        id: true,
        action: true,
        createdAt: true,
        errorMessage: true,
        ipAddress: true,
        method: true,
        success: true,
        userAgent: true,
      },
      where: { userId, method: { notIn: ['OAUTH_INIT', 'DELETE_ACCOUNT'] } },
      take: 25,
      orderBy: { createdAt: 'desc' },
    })
    .then((records) =>
      records.map((record) => ({
        ...record,
        action: actionDisplayName[record.action] || record.action,
        method: (record.method ? methodDisplayName[record.method] : record.method) || record.method,
        createdAt: record.createdAt.toISOString(),
      })),
    );

  try {
    // mutate records to add location property if there is an associated ip address
    const activityWithIpAddress = recentActivity.filter((item) => item.ipAddress);
    await lookupGeoLocationFromIpAddresses(activityWithIpAddress.map(({ ipAddress }) => ipAddress) as string[]).then((locationInfo) => {
      activityWithIpAddress.forEach((activityWithIpAddress, i) => {
        activityWithIpAddress.location = locationInfo[i].location;
      });
    });
  } catch (ex) {
    logger.warn({ ...getErrorMessageAndStackObj(ex) }, 'Error fetching location data for recent activity');
  }

  return recentActivity;
}

export async function getTeamUserActivity({ teamId, limit, cursor }: { teamId: string; limit?: number; cursor?: { id: number } }) {
  if (!teamId) {
    throw new Error('Invalid teamId');
  }

  const userIds = await prisma.teamMember
    .findMany({ where: { teamId }, select: { userId: true } })
    .then((teamMember) => teamMember.map(({ userId }) => userId));

  const recentActivity: LoginActivityUserFacing[] = await prisma.loginActivity
    .findMany({
      select: {
        id: true,
        action: true,
        createdAt: true,
        errorMessage: true,
        ipAddress: true,
        method: true,
        success: true,
        userAgent: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      where: { userId: { in: userIds }, method: { notIn: ['OAUTH_INIT', 'DELETE_ACCOUNT'] } },
      cursor,
      take: clamp(limit ?? 25, 1, 100),
      skip: cursor ? 1 : 0, // Skip the cursor
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    })
    .then((records) =>
      records.map((record) => ({
        ...record,
        action: actionDisplayName[record.action] || record.action,
        method: (record.method ? methodDisplayName[record.method] : record.method) || record.method,
        createdAt: record.createdAt.toISOString(),
      })),
    );

  try {
    // mutate records to add location property if there is an associated ip address
    const activityWithIpAddress = recentActivity.filter((item) => item.ipAddress);
    await lookupGeoLocationFromIpAddresses(activityWithIpAddress.map(({ ipAddress }) => ipAddress) as string[]).then((locationInfo) => {
      activityWithIpAddress.forEach((activityWithIpAddress, i) => {
        activityWithIpAddress.location = locationInfo[i].location;
      });
    });
  } catch (ex) {
    logger.warn({ ...getErrorMessageAndStackObj(ex) }, 'Error fetching location data for recent activity');
  }

  return recentActivity;
}

export async function revokeUserSession(userId: string, sessionId: string) {
  if (!userId || !sessionId) {
    throw new Error('Invalid parameters');
  }
  await prisma.sessions.delete({
    where: {
      sess: {
        path: ['user', 'id'],
        equals: userId,
      },
      sid: sessionId,
    },
  });
}

export async function revokeExternalSession(userId: string, sessionId: string) {
  if (!userId || !sessionId) {
    throw new Error('Invalid parameters');
  }
  await prisma.webExtensionToken.delete({
    where: { id: sessionId },
  });
}

export async function revokeAllUserSessions(userId: string, exceptId?: Maybe<string>) {
  if (!userId) {
    throw new Error('Invalid parameters');
  }
  await prisma.sessions.deleteMany({
    where: exceptId
      ? {
          userId: { equals: userId },
          NOT: { sid: exceptId },
        }
      : { userId },
  });
  await prisma.webExtensionToken.deleteMany({
    where: exceptId ? { userId, NOT: { id: exceptId } } : { userId },
  });
}

export async function setPasswordForUser(id: string, password: string) {
  const UNSAFE_userWithPassword = await prisma.user.findUnique({
    select: { id: true, password: true, email: true },
    where: { id },
  });

  if (!UNSAFE_userWithPassword) {
    return { error: new InvalidCredentials(`User not found with id ${id}`) };
  }

  // FIXME: this is kinda dumb since the user can remove the password then re-add it
  if (UNSAFE_userWithPassword.password) {
    return { error: new Error('Cannot set password when already set, you must go through the password reset flow') };
  }

  const usersWithSamesEmail = await prisma.user.findFirst({
    select: { id: true, email: true, hasPasswordSet: true },
    where: { id: { not: id }, email: UNSAFE_userWithPassword.email },
  });

  if (usersWithSamesEmail && usersWithSamesEmail.hasPasswordSet) {
    return { error: new Error('Cannot set password, another user with the same email address already has a password set') };
  }

  await changeUserPassword(id, password);

  return prisma.user
    .findFirstOrThrow({
      select: AuthenticatedUserSelect,
      where: { id },
    })
    .then((user) => AuthenticatedUserSchema.parse(user));
}

export const generatePasswordResetToken = async (email: string) => {
  email = email.toLowerCase();
  const users = await prisma.user.findMany({
    where: { email },
    select: { id: true, password: true, teamMembership: { select: { status: true } } },
  });

  if (users.length === 0) {
    throw new InvalidAction('User does not exist');
  }

  if (users[0].teamMembership && users[0].teamMembership.status !== TEAM_MEMBER_STATUS_ACTIVE) {
    throw new InvalidAction('User is inactive and their password cannot be reset');
  }

  const usersWithPasswordSet = users.filter((user) => user.password !== null);

  if (users.length === 1 || usersWithPasswordSet.length === 1) {
    const targetUser = usersWithPasswordSet.length === 1 ? usersWithPasswordSet[0] : users[0];

    // Delete existing token if present
    await prisma.passwordResetToken.deleteMany({
      where: { email },
    });

    const passwordResetToken = await prisma.passwordResetToken.create({
      data: {
        userId: targetUser.id,
        email,
        expiresAt: addMinutes(new Date(), PASSWORD_RESET_DURATION_MINUTES),
      },
    });

    return passwordResetToken;
  }

  if (usersWithPasswordSet.length === 0) {
    throw new InvalidAction('No users with a password set for this email');
  }

  throw new InvalidAction('Multiple users with the same email address and a password set');
};

export const resetUserPassword = async (email: string, token: string, password: string) => {
  email = email.toLowerCase();

  const resetToken = await prisma.passwordResetToken.findUnique({
    select: {
      userId: true,
      expiresAt: true,
      user: {
        select: { teamMembership: { select: { status: true } } },
      },
    },
    where: { email_token: { email, token } },
  });

  if (!resetToken) {
    throw new InvalidOrExpiredResetToken('Missing reset token');
  }

  const { expiresAt, user, userId } = resetToken;
  const { teamMembership } = user;

  // Used only if password re-use caused the failure
  async function restoreResetTokenOnPasswordReuse() {
    // Re-create the token since we failed to reset the password - we want to let the user try again
    await prisma.passwordResetToken.create({
      data: { userId, email, token, expiresAt },
    });
  }

  // delete token - we don't need it anymore and if we fail later, the user will need to reset again
  await prisma.passwordResetToken.delete({
    where: { email_token: { email, token } },
  });

  if (teamMembership && teamMembership.status !== TEAM_MEMBER_STATUS_ACTIVE) {
    throw new InvalidOrExpiredResetToken('User is inactive and their password cannot be reset');
  }

  if (expiresAt < new Date()) {
    throw new InvalidOrExpiredResetToken(`Expired at ${expiresAt.toISOString()}`);
  }

  await changeUserPassword(userId, password, restoreResetTokenOnPasswordReuse);

  await revokeAllUserSessions(userId);

  return userId;
};

export const removePasswordFromUser = async (id: string) => {
  const UNSAFE_userWithPassword = await prisma.user.findUniqueOrThrow({
    select: { id: true, password: true, identities: { select: { provider: true, type: true } } },
    where: { id },
  });

  if (!UNSAFE_userWithPassword.password) {
    return { error: new Error('Password is not set') };
  }

  // FIXME: should we allow using magic link to login? in which case we can remove the password without oauth provider
  if (UNSAFE_userWithPassword.identities.some(({ type }) => type !== 'oauth')) {
    return { error: new Error('Your password cannot be removed without an alternative login method, such as a social provider') };
  }

  return prisma.user
    .update({
      select: AuthenticatedUserSelect,
      data: { password: null, passwordUpdatedAt: new Date() },
      where: { id },
    })
    .then((user) => AuthenticatedUserSchema.parse(user));
};

function convertSessionToUserSession(session: { sid: string; sess: unknown; expire: Date; createdAt: Date; userId: string }): UserSession {
  const { sid, sess, expire, createdAt, userId } = session;
  const { ipAddress, loginTime, provider, userAgent } = sess as unknown as SessionData;
  return {
    userId,
    sessionId: sid,
    expires: expire.toISOString(),
    userAgent,
    ipAddress,
    loginTime: new Date(loginTime).toISOString(),
    provider,
    createdAt: createdAt.toISOString(),
  };
}

async function getUserAndVerifyPassword(email: string, password: string) {
  email = email.toLowerCase();
  const UNSAFE_userWithPassword = await prisma.user.findFirst({
    select: { id: true, password: true },
    where: { email, password: { not: null } },
  });

  if (!UNSAFE_userWithPassword) {
    return { error: new InvalidCredentials('Incorrect email or password') };
  }

  // Check if account is locked
  const lockStatus = await isAccountLocked(UNSAFE_userWithPassword.id);
  if (lockStatus.isLocked) {
    return {
      error: new AccountLocked(
        `Account is locked due to too many failed login attempts. Please try again later or reset your password.`,
        lockStatus.lockedUntil,
      ),
    };
  }

  // Check if password reset is required
  const resetRequired = await isPasswordResetRequired(UNSAFE_userWithPassword.id);
  if (resetRequired.required) {
    return {
      error: new PasswordResetRequired(resetRequired.reason || 'Password reset required'),
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  if (await verifyPassword(password, UNSAFE_userWithPassword.password!)) {
    // Success - reset failed login attempts
    await resetFailedLoginAttempts(UNSAFE_userWithPassword.id);

    return {
      error: null,
      user: await prisma.user
        .findFirstOrThrow({
          select: AuthenticatedUserSelect,
          where: { id: UNSAFE_userWithPassword.id },
        })
        .then((user) => AuthenticatedUserSchema.parse(user)),
    };
  }

  // Failed login - record attempt
  const failedAttempt = await recordFailedLoginAttempt(UNSAFE_userWithPassword.id);

  if (failedAttempt.isLocked) {
    return {
      error: new AccountLocked(
        `Account has been locked due to too many failed login attempts. Please try again in ${ACCOUNT_LOCKOUT_DURATION_MINUTES} minutes or reset your password.`,
      ),
    };
  }

  return {
    error: new InvalidCredentials(`Incorrect email or password. Your account will be locked after too many failed attempts.`, {
      userId: UNSAFE_userWithPassword.id,
    }),
  };
}

async function addIdentityToUser(userId: string, providerUser: ProviderUser, provider: OauthProviderType) {
  await prisma.authIdentity.create({
    data: {
      userId,
      type: 'oauth',
      provider,
      providerAccountId: providerUser.id,
      email: providerUser.email,
      name: providerUser.name,
      emailVerified: providerUser.emailVerified,
      username: providerUser.username,
      familyName: providerUser.familyName,
      givenName: providerUser.givenName,
      picture: providerUser.picture,
    },
  });
  return prisma.user
    .findFirstOrThrow({
      select: AuthenticatedUserSelect,
      where: { id: userId },
    })
    .then((user) => AuthenticatedUserSchema.parse(user));
}

export async function removeIdentityFromUser(userId: string, provider: OauthProviderType, providerAccountId: string) {
  const { hasPasswordSet, identities } = await prisma.user.findFirstOrThrow({
    where: { id: userId },
    select: {
      hasPasswordSet: true,
      identities: {
        select: {
          provider: true,
          providerAccountId: true,
        },
      },
    },
  });

  if (identities.length === 1 && !hasPasswordSet) {
    throw new Error('Cannot remove the last identity without a password set');
  }

  await prisma.authIdentity.delete({
    where: {
      userId,
      provider_providerAccountId: { provider, providerAccountId },
    },
  });

  return prisma.user
    .findFirstOrThrow({
      select: AuthenticatedUserSelect,
      where: { id: userId },
    })
    .then((user) => AuthenticatedUserSchema.parse(user));
}

async function createUserFromProvider(
  providerUser: ProviderUser,
  provider: OauthProviderType,
  loginConfiguration: Maybe<LoginConfiguration>,
) {
  const email = providerUser.email?.toLowerCase();
  const user = await prisma.user
    .create({
      select: AuthenticatedUserSelect,
      data: {
        email,
        // TODO: do we really get any benefit from storing this userId like this?
        // TODO: only reason I can think of is user migration since the id is a UUID so we need to different identifier
        // TODO: this is nice as we can identify which identity is primary without joining the identity table - could solve in other ways
        userId: `${provider}|${providerUser.id}`,
        name: providerUser.name,
        emailVerified: providerUser.emailVerified,
        // picture: providerUser.picture,
        lastLoggedIn: new Date(),
        preferences: { create: { skipFrontdoorLogin: false } },
        entitlements: { create: { chromeExtension: false, recordSync: false, googleDrive: false, desktop: false } },
        identities: {
          create: {
            type: 'oauth',
            provider,
            providerAccountId: providerUser.id,
            email,
            name: providerUser.name,
            emailVerified: providerUser.emailVerified,
            username: providerUser.username,
            isPrimary: true,
            familyName: providerUser.familyName,
            givenName: providerUser.givenName,
            picture: providerUser.picture,
          },
        },
        authFactors: {
          create: {
            type: '2fa-email',
            enabled: ENV.JETSTREAM_AUTH_2FA_EMAIL_DEFAULT_VALUE,
          },
        },
        teamMembership:
          !!loginConfiguration?.autoAddToTeam && loginConfiguration.team?.id
            ? {
                create: {
                  teamId: loginConfiguration.team.id,
                  role: 'MEMBER',
                  status: 'ACTIVE',
                },
              }
            : undefined,
      },
    })
    .then((user) => AuthenticatedUserSchema.parse(user));

  // delete any pending invitations if they exist (user was auto-added to team based on config and no invite was needed)
  if (user.teamMembership?.teamId) {
    await prisma.teamMemberInvitation.deleteMany({
      where: {
        teamId: user.teamMembership.teamId,
        email: user.email,
      },
    });
  }

  return user;
}

async function updateIdentityAttributesFromProvider(userId: string, providerUser: ProviderUser, provider: OauthProviderType) {
  try {
    const email = providerUser.email?.toLowerCase();
    const existingProfile = await prisma.authIdentity.findUniqueOrThrow({
      select: {
        isPrimary: true,
        provider: true,
        providerAccountId: true,
        email: true,
        name: true,
        emailVerified: true,
        username: true,
        familyName: true,
        givenName: true,
        picture: true,
      },
      where: {
        userId,
        provider_providerAccountId: { provider, providerAccountId: providerUser.id },
      },
    });

    const skipUpdate =
      existingProfile.email === email &&
      existingProfile.name === providerUser.name &&
      existingProfile.emailVerified === providerUser.emailVerified &&
      existingProfile.username === providerUser.username &&
      existingProfile.familyName === providerUser.familyName &&
      existingProfile.givenName === providerUser.givenName &&
      existingProfile.picture === providerUser.picture;

    if (skipUpdate) {
      return;
    }

    if (existingProfile.isPrimary && existingProfile.name !== providerUser.name) {
      // TODO: what if email changed?
      await prisma.user.update({
        data: {
          name: providerUser.name,
          identities: {
            update: {
              data: {
                provider,
                providerAccountId: providerUser.id,
                email,
                name: providerUser.name,
                emailVerified: providerUser.emailVerified,
                username: providerUser.username,
                familyName: providerUser.familyName,
                givenName: providerUser.givenName,
                picture: providerUser.picture,
              },
              where: {
                provider_providerAccountId: { provider, providerAccountId: providerUser.id },
              },
            },
          },
        },
        where: {
          id: userId,
        },
      });
    } else {
      await prisma.authIdentity.update({
        data: {
          provider,
          providerAccountId: providerUser.id,
          email,
          name: providerUser.name,
          emailVerified: providerUser.emailVerified,
          username: providerUser.username,
          familyName: providerUser.familyName,
          givenName: providerUser.givenName,
          picture: providerUser.picture,
        },
        where: {
          userId,
          provider_providerAccountId: { provider, providerAccountId: providerUser.id },
        },
      });
    }
  } catch (ex) {
    logger.error({ ...getErrorMessageAndStackObj(ex) }, 'Error updating identity attributes from provider');
  }
}

async function createUserFromUserInfo(email: string, name: string, password: string, loginConfiguration: Maybe<LoginConfiguration>) {
  email = email.toLowerCase();

  const passwordHash = await hashPassword(password);
  const user = await prisma.$transaction(async (tx) => {
    // Create initial user
    const user = await tx.user
      .create({
        select: AuthenticatedUserSelect,
        data: {
          email,
          userId: `jetstream|${email}`, // this is temporary, we will update this after the user is created
          name,
          emailVerified: false,
          password: passwordHash,
          passwordUpdatedAt: new Date(),
          lastLoggedIn: new Date(),
          preferences: { create: { skipFrontdoorLogin: false } },
          entitlements: { create: { chromeExtension: false, recordSync: false, googleDrive: false, desktop: false } },
          authFactors: {
            create: {
              type: '2fa-email',
              enabled: ENV.JETSTREAM_AUTH_2FA_EMAIL_DEFAULT_VALUE,
            },
          },
          teamMembership:
            !!loginConfiguration?.autoAddToTeam && loginConfiguration.team?.id
              ? {
                  create: {
                    teamId: loginConfiguration.team.id,
                    role: 'MEMBER',
                    status: 'ACTIVE',
                  },
                }
              : undefined,
        },
      })
      .then((user) => AuthenticatedUserSchema.parse(user));

    // Add password to history
    await tx.passwordHistory.create({
      data: {
        userId: user.id,
        password: passwordHash,
      },
    });

    // FIXME: do we really need a userId? Should be able to drop after Auth0 migration
    // update userId to include the DB id as the second part of the userId instead of the email
    return await tx.user
      .update({
        data: { userId: `jetstream|${user.id}` },
        where: { id: user.id },
        select: AuthenticatedUserSelect,
      })
      .then((user) => AuthenticatedUserSchema.parse(user));
  });

  // delete any pending invitations if they exist (user was auto-added to team based on config and no invite was needed)
  if (user.teamMembership?.teamId) {
    await prisma.teamMemberInvitation.deleteMany({
      where: {
        teamId: user.teamMembership.teamId,
        email: user.email,
      },
    });
  }

  return user;
}

function throwIfInactiveUser(user: AuthenticatedUser | null) {
  if (user?.teamMembership?.status === 'INACTIVE') {
    throw new InactiveUser();
  }
}

async function getTeamInviteConfiguration({ email, teamInvite }: { email: string; teamInvite: Maybe<{ token: string; teamId: string }> }) {
  if (!teamInvite || !email) {
    return null;
  }
  // const email = providerType === 'oauth' ? payload.providerUser.email : payload.email.toLowerCase();
  const invite = await prisma.teamMemberInvitation.findFirst({
    select: {
      id: true,
      email: true,
      role: true,
      features: true,
      createdById: true,
      team: {
        select: {
          id: true,
          name: true,
          loginConfig: {
            select: {
              id: true,
              allowedMfaMethods: true,
              allowedProviders: true,
              allowIdentityLinking: true,
              autoAddToTeam: true,
              domains: true,
              requireMfa: true,
              team: { select: { id: true } },
            },
          },
        },
      },
    },
    where: { teamId: teamInvite.teamId, email, token: teamInvite.token, expiresAt: { gte: new Date() } },
  });
  if (!invite) {
    return null;
  }
  return {
    ...invite,
    loginConfiguration: LoginConfigurationSchema.parse(invite.team.loginConfig),
  };
}

export async function handleSignInOrRegistration(
  payload:
    | {
        providerType: ProviderTypeOauth;
        provider: OauthProviderType;
        providerUser: ProviderUser;
        teamInvite: Maybe<{ token: string; teamId: string }>;
      }
    | {
        providerType: ProviderTypeCredentials;
        action: 'login';
        email: string;
        password: string;
        teamInvite: Maybe<{ token: string; teamId: string }>;
      }
    | {
        providerType: ProviderTypeCredentials;
        action: 'register';
        email: string;
        name: string;
        password: string;
        teamInvite: Maybe<{ token: string; teamId: string }>;
      },
): Promise<{
  user: AuthenticatedUser;
  sessionDetails?: SessionData['sessionDetails'];
  providerType: ProviderTypeOauth | ProviderTypeCredentials;
  provider: OauthProviderType | 'credentials';
  isNewUser: boolean;
  teamInviteResponse: Awaited<ReturnType<typeof getTeamInviteConfiguration>>;
  mfaEnrollmentRequired:
    | {
        factor: TwoFactorTypeOtp;
      }
    | false;
  verificationRequired: {
    email: boolean;
    twoFactor: {
      type: TwoFactorType;
      enabled: boolean;
    }[];
  };
}> {
  try {
    // see if user exists, optionally create
    // potentially auto-link identities if email is verified and matches - else return error
    // see if email address needs to be verified and return info if so
    // else see if 2fa is enabled, if so then generate tokens and return info

    let isNewUser = false;
    let user: AuthenticatedUser | null = null;
    let provider: OauthProviderType | 'credentials' = payload.providerType === 'oauth' ? payload.provider : 'credentials';
    let mfaEnrollmentRequired: { factor: TwoFactorTypeOtp } | false = false;

    /**
     * Flow for Oauth - we allow both login and registration in one flow
     *
     * * attempt to find a user by the provider type + provider id
     * * If no match, find user by email address
     *
     */
    const { providerType, teamInvite } = payload;
    // get preliminary team invite configuration if there is a team invite - returns null if there is not a pending invite
    const teamInviteResponse = await getTeamInviteConfiguration({
      email: providerType === 'oauth' ? payload.providerUser.email : payload.email.toLowerCase(),
      teamInvite,
    });

    // Don't allow login/register if login configuration disallows it
    // this will be checked again in case there is a team without domains configured
    let loginConfiguration =
      teamInviteResponse?.loginConfiguration ||
      (providerType === 'oauth'
        ? await getLoginConfiguration({ email: payload.providerUser.email })
        : await getLoginConfiguration({ email: payload.email }));

    if (loginConfiguration && !loginConfiguration.allowedProviders.has(provider)) {
      throw new ProviderNotAllowed();
    }

    if (providerType === 'oauth') {
      const { providerUser } = payload;
      provider = payload.provider;
      // Check for existing user
      user = await findUserByProviderId(provider, providerUser.id);
      throwIfInactiveUser(user);

      if (!user) {
        // FIXME:
        /**
         * 1. see if new user can be auto-added to team based on domain
         * 2. ensure provider is allowed, based on team membership or email domain
         * 3. see if users with this email domain can sign up on their own (based on login configuration, domain may not allow users to sign up outside their team)
         */

        const usersWithEmail = await findUsersByEmail(providerUser.email);
        if (usersWithEmail.length > 1) {
          // throw error or return error?
          // tell user to login with existing account and link this identity
          // TODO: we should try to prevent duplicate email addresses to avoid this complexity
          logger.warn(
            { email: providerUser.email, providerId: providerUser.id, existingUserId: usersWithEmail[0]?.id },
            'Cannot auto-link account because there are multiple users with the same email address',
          );
          throw new LoginWithExistingIdentity();
        }
        if (usersWithEmail.length === 1) {
          const [existingUser] = usersWithEmail;
          if (!existingUser.emailVerified || !providerUser.emailVerified) {
            // return error - cannot link since email addresses are not verified
            logger.warn(
              { email: providerUser.email, providerId: providerUser.id, existingUserId: existingUser?.id },
              'Cannot auto-link account because email addresses are not verified',
            );
            throw new LoginWithExistingIdentity();
          }

          // Get correct loginConfiguration based on the target user if user is part of team
          if (existingUser.teamMembership) {
            loginConfiguration = await getLoginConfiguration({ teamId: existingUser.teamMembership.teamId });
          }

          if (loginConfiguration && !loginConfiguration.allowIdentityLinking) {
            logger.warn(
              { email: providerUser.email, providerId: providerUser.id, existingUserId: existingUser?.id },
              'Cannot auto-link account because login configuration disallows it',
            );
            throw new IdentityLinkingNotAllowed();
          }

          // TODO: should we allow auto-linking accounts, or reject and make user login and link?
          user = await addIdentityToUser(existingUser.id, providerUser, provider);
        }
      } else {
        // Update provider information
        await updateIdentityAttributesFromProvider(user.id, providerUser, provider);
      }
      if (!user) {
        /**
         * Create user with identity
         */
        if (!providerUser.emailVerified) {
          throw new ProviderEmailNotVerified();
        }
        user = await createUserFromProvider(providerUser, provider, loginConfiguration);
        isNewUser = true;
      }
    } else if (providerType === 'credentials') {
      const { action, password } = payload;
      const email = payload.email.toLowerCase();

      if (!password) {
        throw new InvalidCredentials('Missing Password');
      }

      const loginConfiguration = await getLoginConfiguration({ email });

      if (action === 'login') {
        const userOrError = await getUserAndVerifyPassword(email, password);
        if (userOrError.error) {
          throw userOrError.error;
        } else if (!userOrError.user) {
          throw new InvalidCredentials('User not found');
        }
        user = userOrError.user;
        throwIfInactiveUser(user);
      } else if (action === 'register') {
        const usersWithEmail = await findUsersByEmail(email);
        // Email already in use - go to verification flow with placeholder user, user will never be able to complete the process
        if (usersWithEmail.length > 0) {
          logger.warn(
            { email },
            'Cannot register new user, email already in use - sending to verification flow before revealing the conflict',
          );
          return {
            user: { ...PLACEHOLDER_USER, email, userId: `invalid|${email}` },
            sessionDetails: { isTemporary: true },
            isNewUser: false,
            providerType,
            provider,
            mfaEnrollmentRequired: false,
            teamInviteResponse: null,
            verificationRequired: {
              email: true,
              twoFactor: [],
            },
          };
        }

        // FIXME:
        /**
         * 1. see if new user can be auto-added to team based on domain
         * 2. ensure provider is allowed, based on team membership or email domain
         * 3. see if users with this email domain can sign up on their own (based on login configuration, domain may not allow users to sign up outside their team)
         */

        user = await createUserFromUserInfo(payload.email, payload.name, password, loginConfiguration);
        isNewUser = true;
      } else {
        throw new InvalidAction(action);
      }
    } else {
      throw new InvalidProvider(providerType);
    }

    if (!user) {
      throw new InvalidCredentials('User not initialized');
    }

    loginConfiguration =
      teamInviteResponse?.loginConfiguration ||
      (user.teamMembership?.teamId
        ? await getLoginConfiguration({ teamId: user.teamMembership.teamId })
        : await getLoginConfiguration({ email: user.email }));

    /**
     * Check if login is allowed for the provider
     * If user is part of a team without domains configured, we need to re-check the login configuration
     * as we would not have enough information previously to determine if the provider was allowed
     */
    if (loginConfiguration && !loginConfiguration.allowedProviders.has(provider)) {
      throw new ProviderNotAllowed();
    }

    if (loginConfiguration?.requireMfa) {
      // if email is allowed, then we don't need to force enrollment - but we will force email verification
      if (!loginConfiguration.allowedMfaMethods.has('2fa-email')) {
        const isEnrolledInRequiredFactor = user.authFactors.find(({ enabled, type }) => enabled && type == '2fa-otp');
        if (!isEnrolledInRequiredFactor) {
          mfaEnrollmentRequired = {
            factor: '2fa-otp',
          };
        }
      }
    }

    await setLastLoginDate(user.id);

    const twoFactor = user.authFactors
      .filter(({ enabled }) => enabled)
      .sort((a, b) => {
        const priority = {
          '2fa-otp': 1,
          '2fa-email': 2,
          email: 3,
        } as Record<string, number>;
        return (priority[a.type] || 4) - (priority[b.type] || 4);
      });

    // if mfa is required, ensure it is included in verification
    if (loginConfiguration?.requireMfa && !mfaEnrollmentRequired && !twoFactor.length) {
      twoFactor.push({ enabled: true, type: '2fa-email' });
    }

    /**
     * TODO: ideally this code would live in team.db.ts but the code needs to move around
     * since that is in API application and this is in another library
     */
    if (teamInviteResponse?.team) {
      user = (await acceptInviteAndAddUserToTeam(user.id, teamInviteResponse)) || user;
    }

    return {
      user,
      isNewUser,
      providerType,
      provider,
      mfaEnrollmentRequired,
      teamInviteResponse,
      verificationRequired: {
        email: !user.emailVerified,
        twoFactor,
      },
    };
  } catch (ex) {
    logger.error({ ...getErrorMessageAndStackObj(ex) }, 'Error handling sign in or registration');
    throw ensureAuthError(ex, new InvalidCredentials('Unexpected error'));
  }
}

async function acceptInviteAndAddUserToTeam(
  userId: string,
  teamInviteResponse: NonNullable<Awaited<ReturnType<typeof getTeamInviteConfiguration>>>,
) {
  try {
    return await prisma
      .$transaction([
        prisma.teamMemberInvitation.delete({
          where: { id: teamInviteResponse.id },
        }),
        prisma.teamMember.create({
          select: { role: true, status: true, teamId: true, userId: true },
          data: {
            teamId: teamInviteResponse.team.id,
            userId,
            role: teamInviteResponse.role,
            status: TEAM_MEMBER_STATUS_ACTIVE,
            features: teamInviteResponse.features,
            createdById: teamInviteResponse.createdById,
            updatedById: teamInviteResponse.createdById,
          },
        }),
      ])
      .then(() =>
        prisma.user
          .findFirstOrThrow({
            select: AuthenticatedUserSelect,
            where: { id: userId },
          })
          .then((user) => AuthenticatedUserSchema.parse(user)),
      );
  } catch (ex) {
    logger.error(
      {
        userId,
        teamId: teamInviteResponse.team.id,
        inviteId: teamInviteResponse.id,
        ...getErrorMessageAndStackObj(ex),
      },
      'Error adding user to team from invite',
    );
  }
  return null;
}

export async function setLastLoginDate(userId: string) {
  await prisma.user.update({
    select: { id: true },
    data: { lastLoggedIn: new Date() },
    where: { id: userId },
  });
}

/**
 * This is called when a logged in user authenticates a new identity from the user profile page
 */
export async function linkIdentityToUser({
  userId,
  provider,
  providerUser,
}: {
  userId: string;
  provider: OauthProviderType;
  providerUser: ProviderUser;
}) {
  try {
    // Check for existing user
    const existingUser = await prisma.user
      .findFirstOrThrow({ select: AuthenticatedUserSelect, where: { id: userId } })
      .then((user) => AuthenticatedUserSchema.parse(user));
    const existingProviderUser = await findUserByProviderId(provider, providerUser.id);
    if (existingProviderUser && existingProviderUser.id !== userId) {
      // FIXME: This error is never presented to the user, it silently fails
      // TODO: is this the correct error message? some other user already has this identity linked
      logger.warn(
        { newUserId: userId, existingUserId: existingProviderUser.id },
        'Cannot link account, Provider identity already linked to another user',
      );
      throw new LoginWithExistingIdentity('Provider identity already linked to another user');
    } else if (existingProviderUser) {
      // identity is already linked to this user - NO_OP
      return existingUser;
    }
    return await addIdentityToUser(userId, providerUser, provider);
  } catch (ex) {
    throw ensureAuthError(ex, new InvalidCredentials());
  }
}

/**
 * Password Security Functions
 */

export const changeUserPassword = async (userId: string, password: string, onReusedPassword?: () => Promise<void>) => {
  const hashedPassword = await hashPassword(password);

  await prisma.$transaction(async (tx) => {
    if (await isPasswordInHistory(userId, password, tx)) {
      if (onReusedPassword) {
        await onReusedPassword();
      }
      throw new PasswordReused('You cannot reuse a recent password. Please choose a different password.');
    }

    // Update user password
    await prisma.user.update({
      data: {
        password: hashedPassword,
        passwordUpdatedAt: new Date(),
        forcePasswordReset: false,
        passwordResetReason: null,
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
      where: { id: userId },
    });

    // Add new password to history
    await tx.passwordHistory.create({
      data: {
        userId,
        password: hashedPassword,
      },
    });

    // Get all password history records for this user
    const allPasswords = await tx.passwordHistory.findMany({
      select: { id: true },
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    // Delete old passwords beyond the limit
    if (allPasswords.length > PASSWORD_HISTORY_COUNT) {
      const idsToDelete = allPasswords.slice(PASSWORD_HISTORY_COUNT).map(({ id }) => id);
      await tx.passwordHistory.deleteMany({
        where: { id: { in: idsToDelete } },
      });
    }
  });
};

/**
 * Checks if a password has been used recently (in password history)
 */
export async function isPasswordInHistory(userId: string, password: string, tx?: Prisma.TransactionClient): Promise<boolean> {
  const recentPasswords = await (tx || prisma).passwordHistory.findMany({
    select: { password: true },
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: PASSWORD_HISTORY_COUNT,
  });

  for (const record of recentPasswords) {
    const matches = await verifyPassword(password, record.password);
    if (matches) {
      return true;
    }
  }

  return false;
}

/**
 * Checks if a user account is currently locked due to failed login attempts
 */
export async function isAccountLocked(userId: string): Promise<{ isLocked: boolean; lockedUntil?: Date }> {
  const user = await prisma.user.findUnique({
    select: { lockedUntil: true, failedLoginAttempts: true },
    where: { id: userId },
  });

  if (!user) {
    return { isLocked: false };
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    return { isLocked: true, lockedUntil: user.lockedUntil };
  }

  // Note: we do not reset the lockout count if the expiration has passed but the user is locked out,
  // which means that the user will get exactly one attempt after the lockout period expires since they are already over the limit.
  // This is probably acceptable, but could be re-evaluated in the future.
  return { isLocked: false };
}

/**
 * Increments failed login attempts and locks account if threshold is reached
 */
export async function recordFailedLoginAttempt(userId: string): Promise<{ isLocked: boolean; attemptsRemaining: number }> {
  return await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      select: { failedLoginAttempts: true, lockedUntil: true },
      where: { id: userId },
    });

    if (!user) {
      throw new InvalidCredentials('User not found');
    }

    const newAttempts = (user.failedLoginAttempts || 0) + 1;
    const shouldLock = newAttempts >= MAX_FAILED_LOGIN_ATTEMPTS;

    const { failedLoginAttempts } = await tx.user.update({
      select: { failedLoginAttempts: true },
      data: {
        failedLoginAttempts: { increment: 1 },
        lockedUntil: shouldLock ? addMinutes(new Date(), ACCOUNT_LOCKOUT_DURATION_MINUTES) : undefined,
      },
      where: { id: userId },
    });

    return {
      isLocked: shouldLock,
      attemptsRemaining: Math.max(0, MAX_FAILED_LOGIN_ATTEMPTS - failedLoginAttempts),
    };
  });
}

/**
 * Resets failed login attempts after successful login
 */
export async function resetFailedLoginAttempts(userId: string): Promise<void> {
  await prisma.user.update({
    data: {
      failedLoginAttempts: 0,
      lockedUntil: null,
    },
    where: { id: userId },
  });
}

/**
 * Checks if a user is required to reset their password
 */
export async function isPasswordResetRequired(userId: string): Promise<{ required: boolean; reason?: string }> {
  const user = await prisma.user.findUnique({
    select: { forcePasswordReset: true, passwordResetReason: true },
    where: { id: userId },
  });

  if (!user) {
    return { required: false };
  }

  if (user.forcePasswordReset) {
    return {
      required: true,
      reason: user.passwordResetReason || 'Password reset required by administrator',
    };
  }

  return { required: false };
}

/**
 * Sets the force password reset flag for a user
 */
export async function setForcePasswordReset(userId: string, reason?: string): Promise<void> {
  await prisma.user.update({
    data: {
      forcePasswordReset: true,
      passwordResetReason: reason,
    },
    where: { id: userId },
  });
}

/**
 * Clears the force password reset flag after user has reset their password
 */
export async function clearForcePasswordReset(userId: string): Promise<void> {
  await prisma.user.update({
    data: {
      forcePasswordReset: false,
      passwordResetReason: null,
    },
    where: { id: userId },
  });
}
