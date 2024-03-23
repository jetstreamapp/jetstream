import { ENV, logger } from '@jetstream/api-config';
import { UserProfileAuth0Identity, UserProfileAuth0Ui, UserProfileServer, UserProfileUiWithIdentities } from '@jetstream/types';
import axios, { AxiosError } from 'axios';
import { addHours, addSeconds, formatISO, isBefore } from 'date-fns';
import * as userDb from '../db/user.db';
import { UserFacingError } from '../utils/error-handler';

interface TokenResponse {
  access_token: string;
  scope: string;
  expires_in: number;
  token_type: 'Bearer';
}

const USER_FIELDS = ['user_id', 'email', 'email_verified', 'identities', 'name', 'nickname', 'picture', 'app_metadata', 'username'];

const BASE_URL = `https://${ENV.AUTH0_M2M_DOMAIN}`;

const axiosAuth0 = axios.create({
  baseURL: `https://${ENV.AUTH0_M2M_DOMAIN}/`,
});

let _accessToken: string;
let _expires: Date;

async function initAuthorizationToken(user: UserProfileServer) {
  try {
    if (_accessToken && _expires && isBefore(new Date(), _expires)) {
      logger.info( { userId: user.id }, '[AUTH0] Using existing M2M token',);
      return;
    }

    logger.info('[AUTH0][M2M] Obtaining auth token');
    const response = await axiosAuth0.post<TokenResponse>(`/oauth/token`, {
      grant_type: 'client_credentials',
      client_id: ENV.AUTH0_MGMT_CLIENT_ID,
      client_secret: ENV.AUTH0_MGMT_CLIENT_SECRET,
      audience: `${BASE_URL}/api/v2/`,
    });

    _accessToken = response.data.access_token;
    _expires = addHours(addSeconds(new Date(), response.data.expires_in), -1);
    axiosAuth0.defaults.headers.common['Authorization'] = `Bearer ${_accessToken}`;
  } catch (ex) {
    logger.error( { userId: user.id }, '[AUTH0][M2M][ERROR] Obtaining token %s', ex.message,);
    if (ex.isAxiosError) {
      const error: AxiosError = ex;
      if (error.response) {
        logger.error( { userId: user.id }, '[AUTH0][M2M][ERROR][RESPONSE] %o', error.response.data,);
      } else if (error.request) {
        logger.error( { userId: user.id }, '[AUTH0][M2M][ERROR][REQUEST] %s', error.message || 'An unknown error has occurred.',);
      }
    }
    throw new UserFacingError('An unknown error has occurred');
  }
}

export async function getUser(user: UserProfileServer): Promise<UserProfileAuth0Ui> {
  await initAuthorizationToken(user);
  const response = await axiosAuth0.get<UserProfileAuth0Ui>(`/api/v2/users/${user.id}`, {
    params: {
      fields: USER_FIELDS.join(','),
      include_fields: true,
    },
  });

  return response.data;
}

export async function updateUserLastActivity(user: UserProfileServer, lastActivity: Date): Promise<UserProfileAuth0Ui> {
  await initAuthorizationToken(user);
  return (
    await axiosAuth0.patch<UserProfileAuth0Ui>(`/api/v2/users/${user.id}`, {
      app_metadata: { lastActivity: formatISO(lastActivity, { representation: 'date' }) },
    })
  ).data;
}

export async function updateUser(user: UserProfileServer, userProfile: UserProfileUiWithIdentities): Promise<UserProfileAuth0Ui> {
  await initAuthorizationToken(user);

  if (user.displayName !== userProfile.name) {
    // update on Auth0 if name changed (not allowed for OAuth connections)
    await axiosAuth0.patch<UserProfileAuth0Ui>(`/api/v2/users/${user.id}`, { name: userProfile.name });
  }
  // update locally
  await userDb.updateUser(user, userProfile);
  // re-fetch user from Auth0
  return await getUser(user);
}

export async function deleteUser(user: UserProfileServer): Promise<void> {
  await initAuthorizationToken(user);
  await axiosAuth0.delete<void>(`/api/v2/users/${user.id}`);
}

/**
 * Link two accounts
 * This should only be called after successful authorization of the second identity
 */
export async function linkIdentity(user: UserProfileServer, newUserId: string): Promise<UserProfileAuth0Ui> {
  await initAuthorizationToken(user);

  const [provider, user_id] = newUserId.split('|');
  logger.info({ userId: user.id, provider, secondaryUserId: user_id }, '[AUTH0][IDENTITY][LINK] %s', newUserId);
  await axiosAuth0.post<UserProfileAuth0Identity>(`/api/v2/users/${user.id}/identities`, { provider, user_id });

  return await getUser(user);
}

export async function unlinkIdentity(
  user: UserProfileServer,
  { provider, userId }: { provider: string; userId: string }
): Promise<UserProfileAuth0Ui> {
  await initAuthorizationToken(user);

  // TODO: handle better if one step fails
  logger.info({ userId: user.id, provider, unlinkedUserId: userId }, '[AUTH0][IDENTITY][UNLINK+DELETING]');
  await axiosAuth0.delete<UserProfileAuth0Identity>(`/api/v2/users/${user.id}/identities/${provider}/${userId}`);

  const userIdToDelete = `${provider}|${userId}`;
  await axiosAuth0.delete<void>(`/api/v2/users/${userIdToDelete}`);

  return await getUser(user);
}

export async function resendVerificationEmail(user: UserProfileServer, { provider, userId }: { provider: string; userId: string }) {
  await initAuthorizationToken(user);

  await axiosAuth0.post<UserProfileAuth0Identity>(`/api/v2/jobs/verification-email`, {
    user_id: user.user_id,
    client_id: ENV.AUTH0_CLIENT_ID,
    identity: { provider, user_id: userId },
  });
}
