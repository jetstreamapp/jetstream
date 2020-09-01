/* eslint-disable @typescript-eslint/camelcase */
import { UserAuthJwt, UserAuthSession, AuthenticationToken, UserProfile } from '@jetstream/types';
import * as express from 'express';
import * as jwt from 'jsonwebtoken';
import * as querystring from 'querystring';
import { NOOP } from '@jetstream/shared/utils';
import { logger } from '../config/logger.config';
import * as request from 'superagent'; // http://visionmedia.github.io/superagent
import { AuthenticationError } from '../utils/error-handler';

interface CognitoUserInfoResponse {
  sub: string;
  name: string;
  email: string;
  username: string; // same as sub
}

const AUTH_SCOPE = 'email openid phone profile aws.cognito.signin.user.admin';

export async function exchangeCodeForAccessToken(code: string): Promise<AuthenticationToken> {
  try {
    // https://docs.aws.amazon.com/cognito/latest/developerguide/token-endpoint.html#post-token-positive-exchanging-client-credentials-for-an-access-token
    const response = await request
      .post(`${process.env.AUTH_BASE_URL}/oauth2/token`)
      .auth(process.env.AUTH_CLIENT_ID, process.env.AUTH_CLIENT_SECRET)
      .type('form')
      .send({
        grant_type: 'authorization_code', // could also be "refresh_token", in which case refresh_token is required to be provided
        client_id: process.env.AUTH_CLIENT_ID,
        code,
        redirect_uri: process.env.AUTH_CALLBACK_URL,
      });

    // TODO: createOrUpdateUser in our local DB (if we decide we want to do this)

    return response.body;
  } catch (ex) {
    throw new AuthenticationError('Unauthorized');
  }
}

export async function refreshAuthToken(refresh_token: string) {
  try {
    // https://docs.aws.amazon.com/cognito/latest/developerguide/token-endpoint.html#post-token-positive-exchanging-a-refresh-token-for-tokens.title
    const response = await request
      .post(`${process.env.AUTH_BASE_URL}/oauth2/token`)
      .auth(process.env.AUTH_CLIENT_ID, process.env.AUTH_CLIENT_SECRET)
      .type('form')
      .send({
        grant_type: 'refresh_token',
        client_id: process.env.AUTH_CLIENT_ID,
        refresh_token,
      });

    return response.body;
  } catch (ex) {
    throw new AuthenticationError('Unauthorized');
  }
}

export function getLoginUrl() {
  const params = {
    client_id: process.env.AUTH_CLIENT_ID,
    response_type: 'code',
    scope: AUTH_SCOPE,
    redirect_uri: process.env.AUTH_CALLBACK_URL,
  };

  return `${process.env.AUTH_BASE_URL}/login?${querystring.stringify(params)}`;
}

export function getLogoutUrl() {
  const params = {
    client_id: process.env.AUTH_CLIENT_ID,
    response_type: 'code',
    scope: AUTH_SCOPE,
    redirect_uri: process.env.AUTH_CALLBACK_URL,
  };

  return `${process.env.AUTH_BASE_URL}/logout?${querystring.stringify(params)}`;
}

export async function getUserDetails(accessToken: string): Promise<UserProfile> {
  try {
    const response = await request.get(`${process.env.AUTH_BASE_URL}/oauth2/userInfo`).set('Authorization', `Bearer ${accessToken}`);

    const cognitoUser = response.body as CognitoUserInfoResponse;

    return {
      id: cognitoUser.sub,
      name: cognitoUser.name,
      email: cognitoUser.email,
      active: true,
      username: cognitoUser.username,
    };
  } catch (ex) {
    throw new AuthenticationError('Unauthorized');
  }
}

export function createOrUpdateSession(req: express.Request, userAuthToken: AuthenticationToken) {
  const userAuthJwt: UserAuthJwt = jwt.decode(userAuthToken.id_token) as UserAuthJwt;

  const userAuthSession: UserAuthSession = {
    access_token: userAuthToken.access_token,
    id_token: userAuthToken.id_token,
    refresh_token: userAuthToken.refresh_token,
    userId: userAuthJwt.sub,
    user: userAuthJwt,
  };

  req.session.auth = userAuthSession;
  // TODO: save something in DB to link session to user so we can destroy sessions
  // the main issue is that pruned values will not get removed from this table....
  // we could use a FK and have the record get deleted if FK is deleted - ON DELETE CASCADE - https://stackoverflow.com/questions/14182079/delete-rows-with-foreign-key-in-postgresql
}

export function destroySession(req: express.Request) {
  try {
    req.session.destroy(NOOP);
  } catch (ex) {
    logger.info('[AUTH][SESSION][DESTROY ERROR]', ex.message);
  }
}
