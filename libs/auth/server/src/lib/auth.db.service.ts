import { ENV, logger, prisma } from '@jetstream/api-config';
import {
  AuthenticatedUser,
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
  TwoFactorTypeWithoutEmail,
  UserSession,
  UserSessionAndExtTokensAndActivityWithLocation,
  UserSessionWithLocation,
} from '@jetstream/auth/types';
import { Prisma } from '@jetstream/prisma';
import { decryptString, encryptString } from '@jetstream/shared/node-utils';
import { getErrorMessageAndStackObj } from '@jetstream/shared/utils';
import { Maybe } from '@jetstream/types';
import { addDays, startOfDay } from 'date-fns';
import { addMinutes } from 'date-fns/addMinutes';
import { LRUCache } from 'lru-cache';
import { actionDisplayName, methodDisplayName } from './auth-logging.db.service';
import { DELETE_ACTIVITY_DAYS, DELETE_TOKEN_DAYS, PASSWORD_RESET_DURATION_MINUTES } from './auth.constants';
import {
  InvalidAction,
  InvalidCredentials,
  InvalidOrExpiredResetToken,
  InvalidProvider,
  InvalidRegistration,
  LoginWithExistingIdentity,
} from './auth.errors';
import { ensureAuthError, lookupGeoLocationFromIpAddresses } from './auth.service';
import { checkUserAgentSimilarity, hashPassword, REMEMBER_DEVICE_DAYS, verifyPassword } from './auth.utils';

const LOGIN_CONFIGURATION_CACHE = new LRUCache<string, { value: LoginConfiguration | null }>({
  max: 500,
  // 5 minutes
  ttl: 300_000,
});

const userSelect = Prisma.validator<Prisma.UserSelect>()({
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
});

export async function pruneExpiredRecords() {
  await prisma.loginActivity.deleteMany({
    where: {
      createdAt: { lte: addDays(startOfDay(new Date()), -DELETE_ACTIVITY_DAYS) },
    },
  });
  await prisma.emailActivity.deleteMany({
    where: {
      createdAt: { lte: addDays(startOfDay(new Date()), -DELETE_ACTIVITY_DAYS) },
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
}

async function findUserByProviderId(provider: OauthProviderType, providerAccountId: string) {
  return await prisma.user.findFirst({
    select: userSelect,
    where: {
      identities: { some: { provider, providerAccountId } },
    },
  });
}

async function findUsersByEmail(email: string) {
  email = email.toLowerCase();
  return prisma.user.findMany({
    select: userSelect,
    where: { email },
  });
}

/**
 * This should only be used for internal purposes, such as when a user is already authenticated
 */
export async function findUserById_UNSAFE(id: string) {
  return await prisma.user.findFirstOrThrow({
    select: userSelect,
    where: { id },
  });
}

export async function getLoginConfiguration(email: string): Promise<LoginConfiguration | null> {
  const domain = email?.split('@')[1];
  if (!domain) {
    return null;
  }

  const cachedValue = LOGIN_CONFIGURATION_CACHE.get(domain);
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

export async function setUserEmailVerified(id: string) {
  return prisma.user.update({
    select: userSelect,
    data: { emailVerified: true },
    where: { id },
  });
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
      })
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

export async function toggleEnableDisableAuthFactor(userId: string, type: TwoFactorTypeWithoutEmail, action: 'enable' | 'disable') {
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

export async function deleteAuthFactor(userId: string, type: TwoFactorTypeWithoutEmail) {
  if (!userId) {
    throw new Error('Invalid userId');
  }
  await prisma.authFactors.delete({
    where: { userId_type: { type, userId } },
  });
  return getAuthFactors(userId);
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
      },
      where: {
        sess: {
          path: ['user', 'id'],
          equals: userId,
        },
      },
    })
    .then((sessions) =>
      sessions.map((session): UserSession => {
        const { sid, sess, expire } = session;
        const { ipAddress, loginTime, provider, userAgent } = sess as unknown as SessionData;
        return {
          sessionId: sid,
          expires: expire.toISOString(),
          userAgent,
          ipAddress,
          loginTime: new Date(loginTime).toISOString(),
          provider,
        };
      })
    );

  // Fetch location data and add to each session
  if (!omitLocationData && sessions.length > 0) {
    try {
      return await lookupGeoLocationFromIpAddresses(sessions.map(({ ipAddress }) => ipAddress)).then((locationInfo) =>
        locationInfo.map(
          ({ location }, i): UserSessionWithLocation => ({
            ...sessions[i],
            location,
          })
        )
      );
    } catch (ex) {
      logger.warn({ ...getErrorMessageAndStackObj(ex) }, 'Error fetching location data for sessions');
    }
  }

  return sessions;
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
          })
        )
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
      }))
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
          sess: { path: ['user', 'id'], equals: userId },
          NOT: { sid: exceptId },
        }
      : { sess: { path: ['user', 'id'], equals: userId } },
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

  return prisma.user.update({
    select: userSelect,
    data: { password: await hashPassword(password), passwordUpdatedAt: new Date() },
    where: { id },
  });
}

export const generatePasswordResetToken = async (email: string) => {
  email = email.toLowerCase();
  const users = await prisma.user.findMany({
    where: { email },
    select: { id: true, password: true },
  });

  if (users.length === 0) {
    throw new InvalidAction('User does not exist');
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
    where: { email_token: { email, token } },
  });

  if (!resetToken) {
    throw new InvalidOrExpiredResetToken('Missing reset token');
  }

  // delete token - we don't need it anymore and if we fail later, the user will need to reset again
  await prisma.passwordResetToken.delete({
    where: { email_token: { email, token: resetToken.token } },
  });

  if (resetToken.expiresAt < new Date()) {
    throw new InvalidOrExpiredResetToken(`Expired at ${resetToken.expiresAt.toISOString()}`);
  }

  const hashedPassword = await hashPassword(password);

  await prisma.user.update({
    data: {
      password: hashedPassword,
      passwordUpdatedAt: new Date(),
    },
    where: {
      id: resetToken.userId,
    },
  });

  await revokeAllUserSessions(resetToken.userId);

  return resetToken.userId;
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

  return prisma.user.update({
    select: userSelect,
    data: { password: null, passwordUpdatedAt: new Date() },
    where: { id },
  });
};

async function getUserAndVerifyPassword(email: string, password: string) {
  email = email.toLowerCase();
  const UNSAFE_userWithPassword = await prisma.user.findFirst({
    select: { id: true, password: true },
    where: { email, password: { not: null } },
  });

  if (!UNSAFE_userWithPassword) {
    return { error: new InvalidCredentials('Incorrect email or password') };
  }

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  if (await verifyPassword(password, UNSAFE_userWithPassword.password!)) {
    return {
      error: null,
      user: await prisma.user.findFirstOrThrow({
        select: userSelect,
        where: { id: UNSAFE_userWithPassword.id },
      }),
    };
  }
  return { error: new InvalidCredentials('Incorrect email or password', { userId: UNSAFE_userWithPassword.id }) };
}

async function addIdentityToUser(userId: string, providerUser: ProviderUser, provider: OauthProviderType) {
  await prisma.authIdentity.create({
    data: {
      userId,
      type: 'oauth',
      provider: provider,
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
  return prisma.user.findFirstOrThrow({
    select: userSelect,
    where: { id: userId },
  });
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

  return prisma.user.findFirstOrThrow({
    select: userSelect,
    where: { id: userId },
  });
}

async function createUserFromProvider(providerUser: ProviderUser, provider: OauthProviderType) {
  const email = providerUser.email?.toLowerCase();
  return prisma.user.create({
    select: userSelect,
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
      entitlements: { create: { chromeExtension: false, recordSync: false, googleDrive: false } },
      identities: {
        create: {
          type: 'oauth',
          provider: provider,
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
    },
  });
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
                provider: provider,
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
          provider: provider,
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

async function createUserFromUserInfo(email: string, name: string, password: string) {
  email = email.toLowerCase();
  const passwordHash = await hashPassword(password);
  return prisma.$transaction(async (tx) => {
    // Create initial user
    const user = await tx.user.create({
      select: userSelect,
      data: {
        email,
        userId: `jetstream|${email}`, // this is temporary, we will update this after the user is created
        name,
        emailVerified: false,
        password: passwordHash,
        passwordUpdatedAt: new Date(),
        lastLoggedIn: new Date(),
        preferences: { create: { skipFrontdoorLogin: false } },
        entitlements: { create: { chromeExtension: false, recordSync: false, googleDrive: false } },
        authFactors: {
          create: {
            type: '2fa-email',
            enabled: ENV.JETSTREAM_AUTH_2FA_EMAIL_DEFAULT_VALUE,
          },
        },
      },
    });

    // FIXME: do we really need a userId? Should be able to drop after Auth0 migration
    // update userId to include the DB id as the second part of the userId instead of the email
    return await tx.user.update({
      data: { userId: `jetstream|${user.id}` },
      where: { id: user.id },
      select: userSelect,
    });
  });
}

export async function handleSignInOrRegistration(
  payload:
    | {
        providerType: ProviderTypeOauth;
        provider: OauthProviderType;
        providerUser: ProviderUser;
      }
    | {
        providerType: ProviderTypeCredentials;
        action: 'login';
        email: string;
        password: string;
      }
    | {
        providerType: ProviderTypeCredentials;
        action: 'register';
        email: string;
        name: string;
        password: string;
      }
): Promise<{
  user: AuthenticatedUser;
  providerType: ProviderTypeOauth | ProviderTypeCredentials;
  provider: OauthProviderType | 'credentials';
  isNewUser: boolean;
  verificationRequired: {
    email: boolean;
    twoFactor: {
      type: string;
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
    let provider: OauthProviderType | 'credentials' = 'credentials';

    /**
     * Flow for Oauth - we allow both login and registration in one flow
     *
     * * attempt to find a user by the provider type + provider id
     * * If no match, find user by email address
     *
     */
    const { providerType } = payload;
    if (providerType === 'oauth') {
      const { providerUser } = payload;
      provider = payload.provider;
      // Check for existing user
      user = await findUserByProviderId(provider, providerUser.id);
      if (!user) {
        const usersWithEmail = await findUsersByEmail(providerUser.email);
        if (usersWithEmail.length > 1) {
          // throw error or return error?
          // tell user to login with existing account and link this identity
          // TODO: we should try to prevent duplicate email addresses to avoid this complexity
          throw new LoginWithExistingIdentity();
        }
        if (usersWithEmail.length === 1) {
          if (!usersWithEmail[0].emailVerified || !providerUser.emailVerified) {
            // return error - cannot link since email addresses are not verified
            throw new LoginWithExistingIdentity();
          }
          // TODO: should we allow auto-linking accounts, or reject and make user login and link?
          user = await addIdentityToUser(usersWithEmail[0].id, providerUser, provider);
        }
      } else {
        // Update provider information
        await updateIdentityAttributesFromProvider(user.id, providerUser, provider);
      }
      if (!user) {
        /**
         * Create user with identity
         */
        user = await createUserFromProvider(providerUser, provider);
        isNewUser = true;
      }
    } else if (providerType === 'credentials') {
      const { action, password } = payload;
      const email = payload.email.toLowerCase();

      if (!password) {
        throw new InvalidCredentials('Missing Password');
      }

      if (action === 'login') {
        const userOrError = await getUserAndVerifyPassword(email, password);
        if (userOrError.error) {
          throw userOrError.error;
        } else if (!userOrError.user) {
          throw new InvalidCredentials('User not found');
        }
        user = userOrError.user;
      } else if (action === 'register') {
        const usersWithEmail = await findUsersByEmail(email);
        if (usersWithEmail.length > 0) {
          throw new InvalidRegistration('Email address is in use');
        }
        user = await createUserFromUserInfo(payload.email, payload.name, password);
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

    await setLastLoginDate(user.id);

    return {
      user,
      isNewUser,
      providerType,
      provider,
      verificationRequired: {
        email: !user.emailVerified,
        twoFactor: user.authFactors
          .filter(({ enabled }) => enabled)
          .sort((a, b) => {
            const priority = {
              '2fa-otp': 1,
              '2fa-email': 2,
              email: 3,
            } as Record<string, number>;
            return (priority[a.type] || 4) - (priority[b.type] || 4);
          }),
      },
    };
  } catch (ex) {
    throw ensureAuthError(ex, new InvalidCredentials('Unexpected error'));
  }
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
    const existingUser = await prisma.user.findFirstOrThrow({ select: userSelect, where: { id: userId } });
    const existingProviderUser = await findUserByProviderId(provider, providerUser.id);
    if (existingProviderUser && existingProviderUser.id !== userId) {
      // TODO: is this the correct error message? some other user already has this identity linked
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
