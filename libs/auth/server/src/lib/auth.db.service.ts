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
import { DELETE_ACTIVITY_DAYS, DELETE_TOKEN_DAYS, PASSWORD_RESET_DURATION_MINUTES } from './auth.constants';
import {
  InvalidAction,
  InvalidCredentials,
  InvalidOrExpiredResetToken,
  InvalidProvider,
  InvalidRegistration,
  LoginWithExistingIdentity,
} from './auth.errors';
import { ensureAuthError, verifyAuth0CredentialsOrThrow_MIGRATION_TEMPORARY } from './auth.service';
import { checkUserAgentSimilarity, hashPassword, REMEMBER_DEVICE_DAYS, verifyPassword } from './auth.utils';

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
        const { ipAddress, loginTime, provider, userAgent } = sess as unknown as SessionData;
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
  if (!omitLocationData && sessions.length > 0) {
    try {
      let response: Awaited<ReturnType<typeof fetch>> | null = null;
      const ipAddresses = sessions.map((session) => session.ipAddress);
      if (ENV.IP_API_SERVICE === 'LOCAL' && ENV.GEO_IP_API_USERNAME && ENV.GEO_IP_API_PASSWORD && ENV.GEO_IP_API_HOSTNAME) {
        response = await fetch(`${ENV.GEO_IP_API_HOSTNAME}/api/lookup`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Basic ${Buffer.from(`${ENV.GEO_IP_API_USERNAME}:${ENV.GEO_IP_API_PASSWORD}`, 'utf-8').toString('base64')}`,
          },
          body: JSON.stringify({ ips: ipAddresses }),
        });
        if (response?.ok) {
          const locations = (await response.json()) as
            | { success: true; results: SessionIpData[] }
            | { success: false; message: string; details?: string };

          if (locations.success) {
            return sessions.map(
              (session, i): UserSessionWithLocation => ({
                ...session,
                location: locations.results[i],
              })
            );
          }
        }
      } else if (ENV.IP_API_KEY) {
        const params = new URLSearchParams({
          fields: 'status,country,countryCode,region,regionName,city,isp,lat,lon,query',
          key: ENV.IP_API_KEY,
        });

        response = await fetch(`https://pro.ip-api.com/batch?${params.toString()}`, {
          method: 'POST',
          body: JSON.stringify(ipAddresses),
        });
        if (response?.ok) {
          const locations = (await response.json()) as SessionIpData[];
          return sessions.map(
            (session, i): UserSessionWithLocation => ({
              ...session,
              location: locations[i],
            })
          );
        }
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
  // if there is an existing token, delete it
  const restToken = await prisma.passwordResetToken.findUnique({
    where: { email_token: { email, token } },
  });

  if (!restToken) {
    throw new InvalidOrExpiredResetToken('Missing reset token');
  }

  // delete token - we don't need it anymore and if we fail later, the user will need to reset again
  await prisma.passwordResetToken.delete({
    where: { email_token: { email, token: restToken.token } },
  });

  if (restToken.expiresAt < new Date()) {
    throw new InvalidOrExpiredResetToken(`Expired at ${restToken.expiresAt.toISOString()}`);
  }

  const hashedPassword = await hashPassword(password);

  await prisma.user.update({
    data: {
      password: hashedPassword,
      passwordUpdatedAt: new Date(),
    },
    where: {
      id: restToken.userId,
    },
  });

  await revokeAllUserSessions(restToken.userId);
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

  // There is not a user with the email address that has a password set
  if (!UNSAFE_userWithPassword) {
    // FIXME: TEMPORARY This is temporary just to handle the users that signed up after we exported data
    try {
      const updatedUser = await migratePasswordFromAuth0(email, password);
      return {
        error: null,
        user: updatedUser,
      };
    } catch (ex) {
      return { error: new InvalidCredentials('Could not migrate from Auth0') };
    }

    // Use this after code above is removed
    // if (!UNSAFE_userWithPassword) {
    //   return { error: new InvalidCredentials() };
    // }
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
  return { error: new InvalidCredentials('Incorrect email or password') };
}

async function migratePasswordFromAuth0(email: string, password: string) {
  email = email.toLowerCase();
  // If the user has a linked social identity, we have no way to confirm 100% that this is the correct account
  // since we allowed same email on multiple accounts with Auth0
  const userWithoutSocialIdentities = await prisma.user.findFirst({
    select: { id: true, identities: true },
    where: { email, password: null, identities: { none: {} } },
  });

  if (!userWithoutSocialIdentities || userWithoutSocialIdentities.identities.length > 0) {
    logger.warn({ email }, 'Cannot migrate password on the fly from Auth0, user has linked social identity');
    throw new InvalidCredentials('Could not migrate from Auth0');
  }

  await verifyAuth0CredentialsOrThrow_MIGRATION_TEMPORARY({ email, password });

  return await prisma.user.update({
    select: userSelect,
    data: { password: await hashPassword(password), passwordUpdatedAt: new Date() },
    where: { id: userWithoutSocialIdentities.id },
  });
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
