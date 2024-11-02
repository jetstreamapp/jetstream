import { ENV, logger, prisma } from '@jetstream/api-config';
import {
  AuthenticatedUser,
  OauthProviderType,
  ProviderTypeCredentials,
  ProviderTypeOauth,
  ProviderUser,
  SessionData,
  SessionIpData,
  TwoFactorTypeWithoutEmail,
  UserSession,
  UserSessionWithLocation,
} from '@jetstream/auth/types';
import { decryptString, encryptString } from '@jetstream/shared/node-utils';
import { getErrorMessageAndStackObj } from '@jetstream/shared/utils';
import { Maybe } from '@jetstream/types';
import { Prisma } from '@prisma/client';
import { addDays, startOfDay } from 'date-fns';
import { addMinutes } from 'date-fns/addMinutes';
import { InvalidAction, InvalidCredentials, InvalidOrExpiredResetToken, InvalidProvider, LoginWithExistingIdentity } from './auth.errors';
import { ensureAuthError } from './auth.service';
import { hashPassword, verifyPassword } from './auth.utils';

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
      createdAt: { lte: addDays(startOfDay(new Date()), -30) },
    },
  });
  await prisma.emailActivity.deleteMany({
    where: {
      createdAt: { lte: addDays(startOfDay(new Date()), -30) },
    },
  });
  await prisma.passwordResetToken.deleteMany({
    where: {
      expiresAt: { lte: addDays(startOfDay(new Date()), -3) },
    },
  });
  await prisma.rememberedDevice.deleteMany({
    where: {
      expiresAt: { lte: addDays(startOfDay(new Date()), -3) },
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
      expiresAt: addDays(new Date(), 30),
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
    const matchingRecords = await prisma.rememberedDevice.count({
      where: {
        userId,
        deviceId,
        ipAddress,
        userAgent,
        expiresAt: { gte: new Date() },
      },
    });
    return matchingRecords > 0;
  } catch (ex) {
    logger.error({ ...getErrorMessageAndStackObj(ex) }, 'Error checking for remember device record');
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
  await prisma.authFactors.delete({
    where: { userId_type: { type, userId } },
  });
  return getAuthFactors(userId);
}

export async function getUserSessions(userId: string, omitLocationData?: boolean): Promise<UserSessionWithLocation[]> {
  const sessions = await prisma.sessions
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
        const { ipAddress, loginTime, provider, user, userAgent } = sess as unknown as SessionData;
        return {
          sessionId: sid,
          expires: expire.toISOString(),
          userAgent: userAgent,
          ipAddress: ipAddress,
          loginTime: new Date(loginTime).toISOString(),
          provider: provider,
          // TODO: last activity?
        };
      })
    );

  // Fetch location data and add to each session
  if (!omitLocationData && ENV.IP_API_KEY && sessions.length > 0) {
    try {
      const ipAddresses = sessions.map((session) => session.ipAddress);

      const params = new URLSearchParams({
        fields: 'status,country,countryCode,region,regionName,city,isp,query',
        key: ENV.IP_API_KEY,
      });

      const response = await fetch(`https://pro.ip-api.com/batch?${params.toString()}`, {
        method: 'POST',
        body: JSON.stringify(ipAddresses),
      });

      if (response.ok) {
        const locations = (await response.json()) as SessionIpData[];
        return sessions.map(
          (session, i): UserSessionWithLocation => ({
            ...session,
            location: locations[i],
          })
        );
      }
    } catch (ex) {
      logger.warn({ ...getErrorMessageAndStackObj(ex) }, 'Error fetching location data for sessions');
    }
  }

  return sessions;
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
  return getUserSessions(userId);
}

export async function revokeAllUserSessions(userId: string, exceptId?: Maybe<string>) {
  if (!userId) {
    throw new Error('Invalid parameters');
  }
  await prisma.sessions.deleteMany({
    where: exceptId
      ? {
          sess: {
            path: ['user', 'id'],
            equals: userId,
          },
          NOT: { sid: exceptId },
        }
      : {
          sess: {
            path: ['user', 'id'],
            equals: userId,
          },
        },
  });
  return getUserSessions(userId);
}

export async function setPasswordForUser(id: string, password: string) {
  const UNSAFE_userWithPassword = await prisma.user.findFirst({
    select: { id: true, password: true },
    where: { id },
  });
  if (!UNSAFE_userWithPassword) {
    return { error: new InvalidCredentials() };
  }
  if (UNSAFE_userWithPassword.password) {
    return { error: new Error('Cannot set password when already set, you must go through the password reset flow') };
  }
  return prisma.user.update({
    select: userSelect,
    data: { password: await hashPassword(password), passwordUpdatedAt: new Date() },
    where: { id },
  });
}

export const generatePasswordResetToken = async (email: string) => {
  const user = await prisma.user.findFirst({
    where: { email },
  });

  if (!user) {
    throw new InvalidAction();
  }

  // if there is an existing token, delete it
  const existingToken = await prisma.passwordResetToken.findFirst({
    where: { email },
  });

  if (existingToken) {
    await prisma.passwordResetToken.delete({
      where: { email_token: { email, token: existingToken.token } },
    });
  }

  const passwordResetToken = await prisma.passwordResetToken.create({
    data: {
      email,
      expiresAt: addMinutes(new Date(), 10),
    },
  });

  return passwordResetToken;
};

export const resetUserPassword = async (email: string, token: string, password: string) => {
  // if there is an existing token, delete it
  const existingToken = await prisma.passwordResetToken.findUnique({
    where: { email_token: { email, token } },
  });

  if (!existingToken) {
    throw new InvalidOrExpiredResetToken();
  }

  // delete token - we don't need it anymore and if we fail later, the user will need to reset again
  await prisma.passwordResetToken.delete({
    where: { email_token: { email, token: existingToken.token } },
  });

  if (existingToken.expiresAt < new Date()) {
    throw new InvalidOrExpiredResetToken();
  }

  const user = await prisma.user.findFirst({
    where: { email },
  });

  if (!user) {
    throw new InvalidOrExpiredResetToken();
  }

  const hashedPassword = await hashPassword(password);

  await prisma.user.update({
    data: {
      password: hashedPassword,
      passwordUpdatedAt: new Date(),
    },
    where: {
      id: user.id,
    },
  });

  await revokeAllUserSessions(user.id);
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
  const UNSAFE_userWithPassword = await prisma.user.findFirst({
    select: { id: true, password: true },
    where: { email, password: { not: null } },
  });
  if (!UNSAFE_userWithPassword) {
    return { error: new InvalidCredentials() };
  }
  if (await verifyPassword(password, UNSAFE_userWithPassword.password!)) {
    return {
      error: null,
      user: await prisma.user.findFirstOrThrow({
        select: userSelect,
        where: { id: UNSAFE_userWithPassword.id },
      }),
    };
  }
  return { error: new InvalidCredentials() };
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
  return prisma.user.create({
    select: userSelect,
    data: {
      email: providerUser.email,
      // TODO: do we really get any benefit from storing this userId like this?
      // TODO: only reason I can think of is user migration since the id is a UUID so we need to different identifier
      userId: `${provider}|${providerUser.id}`,
      name: providerUser.name,
      emailVerified: providerUser.emailVerified,
      // picture: providerUser.picture,
      lastLoggedIn: new Date(),
      preferences: { create: { skipFrontdoorLogin: false } },
      identities: {
        create: {
          type: 'oauth',
          provider: provider,
          providerAccountId: providerUser.id,
          email: providerUser.email,
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
          enabled: true,
        },
      },
    },
  });
}

async function updateIdentityAttributesFromProvider(userId: string, providerUser: ProviderUser, provider: OauthProviderType) {
  try {
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
      existingProfile.email === providerUser.email &&
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
                email: providerUser.email,
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
          email: providerUser.email,
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
        authFactors: {
          create: {
            type: '2fa-email',
            enabled: true,
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
      const { action, email, password } = payload;
      if (!password) {
        throw new InvalidCredentials();
      }

      if (action === 'login') {
        const userOrError = await getUserAndVerifyPassword(email, password);
        if (userOrError.error) {
          throw userOrError.error;
        } else if (!userOrError.user) {
          throw new InvalidCredentials();
        }
        user = userOrError.user;
      } else if (action === 'register') {
        const usersWithEmail = await findUsersByEmail(email);
        if (usersWithEmail.length > 0) {
          throw new InvalidCredentials();
        }
        user = await createUserFromUserInfo(payload.email, payload.name, password);
        isNewUser = true;
      } else {
        throw new InvalidAction();
      }
    } else {
      throw new InvalidProvider();
    }

    if (!user) {
      throw new InvalidCredentials();
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
    throw ensureAuthError(ex, new InvalidCredentials());
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
      throw new LoginWithExistingIdentity();
    } else if (existingProviderUser) {
      // identity is already linked to this user - NO_OP
      return existingUser;
    }
    return await addIdentityToUser(userId, providerUser, provider);
  } catch (ex) {
    throw ensureAuthError(ex, new InvalidCredentials());
  }
}
