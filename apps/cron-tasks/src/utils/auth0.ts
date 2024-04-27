import { getExceptionLog } from '@jetstream/api-config';
import type { Auth0PaginatedResponse, UserProfileAuth0, UserProfileAuth0Ui } from '@jetstream/types';
import axios, { AxiosError } from 'axios';
import { addHours, addSeconds, isBefore } from 'date-fns';
import { ENV } from '../config/env-config';
import { logger } from '../config/logger.config';
// import * as userDb from '../db/user.db';

interface TokenResponse {
  access_token: string;
  scope: string;
  expires_in: number;
  token_type: 'Bearer';
}

// const USER_FIELDS = ['user_id', 'email', 'email_verified', 'identities', 'name', 'nickname', 'picture', 'app_metadata', 'username'];

const BASE_URL = `https://${ENV.AUTH0_M2M_DOMAIN}`;

const axiosAuth0 = axios.create({
  baseURL: `https://${ENV.AUTH0_M2M_DOMAIN}/`,
});

let _accessToken: string;
let _expires: Date;

async function initAuthorizationToken() {
  try {
    if (_accessToken && _expires && isBefore(new Date(), _expires)) {
      logger.info('[AUTH0] Using existing M2M token');
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
    logger.error(getExceptionLog(ex), '[AUTH0][M2M][ERROR] Obtaining token');
    if (ex.isAxiosError) {
      const error: AxiosError = ex;
      if (error.response) {
        logger.error(getExceptionLog(error), '[AUTH0][M2M][ERROR][RESPONSE] %o', error.response.data);
      } else if (error.request) {
        logger.error(getExceptionLog(error), '[AUTH0][M2M][ERROR][REQUEST] %s', error.message || 'An unknown error has occurred.');
      }
    }
    throw new Error('An unknown error has occurred');
  }
}

// https://auth0.com/docs/api/management/v2#!/Users/get_users
export async function searchUsersPaginateAll<T = UserProfileAuth0>(params: any = {}): Promise<T[]> {
  await initAuthorizationToken();
  let done = false;
  let currPage = 0;
  params.page = currPage;
  params.per_page = 50;
  params.include_totals = 'true';

  let users: T[] = [];
  while (!done) {
    const response = await axiosAuth0.get<Auth0PaginatedResponse<'users', T>>(`/api/v2/users`, { params });
    const { length, limit, users: _users } = response.data;
    users = users.concat(_users);
    currPage++;
    params.page = currPage;
    if (length < limit) {
      done = true;
    }
  }

  return users;
}

// export async function getUser(user: UserProfileServer): Promise<UserProfileAuth0Ui> {
//   await initAuthorizationToken(user);
//   const response = await axiosAuth0.get<UserProfileAuth0Ui>(`/api/v2/users/${user.id}`, {
//     params: {
//       fields: USER_FIELDS.join(','),
//       include_fields: true,
//     },
//   });

//   return response.data;
// }

export async function updateUser(userId: string, userProfile: { app_metadata: { accountDeletionDate: string } }): Promise<void> {
  await initAuthorizationToken();
  // update on Auth0
  await axiosAuth0.patch<UserProfileAuth0Ui>(`/api/v2/users/${userId}`, userProfile);
  // update locally
  // await userDb.updateUser(user, userProfile);
  // re-fetch user from Auth0
  // return await getUser(user);
}

export async function deleteUser(userId: string): Promise<void> {
  await initAuthorizationToken();
  await axiosAuth0.delete<void>(`/api/v2/users/${userId}`);
}
