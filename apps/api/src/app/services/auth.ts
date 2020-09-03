/* eslint-disable @typescript-eslint/camelcase */
import { UserAuthJwt, UserAuthSession, AuthenticationToken, UserProfile } from '@jetstream/types';
import * as express from 'express';
import * as jwt from 'jsonwebtoken';
import * as querystring from 'querystring';
import { NOOP } from '@jetstream/shared/utils';
import { logger } from '../config/logger.config';
import * as request from 'superagent'; // http://visionmedia.github.io/superagent
import { AuthenticationError } from '../utils/error-handler';

interface OAuth2UserInfoResponse {
  email: string;
  email_verified: boolean;
  family_name: string;
  given_name: string;
  locale: string;
  name: string;
  preferred_username: string;
  sub: string;
  updated_at: number;
  zoneinfo: string;
}

const OAUTH_SCOPE = 'email openid profile offline_access';

export async function exchangeCodeForAccessToken(code: string): Promise<AuthenticationToken> {
  try {
    // https://docs.aws.amazon.com/cognito/latest/developerguide/token-endpoint.html#post-token-positive-exchanging-client-credentials-for-an-access-token
    const response = await request
      .post(`${process.env.AUTH_BASE_URL}/token`)
      .auth(process.env.AUTH_CLIENT_ID, process.env.AUTH_CLIENT_SECRET)
      .type('form')
      .send({
        grant_type: 'authorization_code', // could also be "refresh_token", in which case refresh_token is required to be provided
        // client_id: process.env.AUTH_CLIENT_ID,
        code,
        redirect_uri: process.env.AUTH_CALLBACK_URL,
      });

    // TODO: createOrUpdateUser in our local DB (if we decide we want to do this)

    return response.body;
  } catch (ex) {
    if (ex.response && ex.response.body) {
      logger.error('[AUTH ERROR][exchangeCodeForAccessToken()]', ex.response.body);
    }
    throw new AuthenticationError('Unauthorized');
  }
}

export async function refreshAuthToken(refresh_token: string) {
  try {
    const response = await request
      .post(`${process.env.AUTH_BASE_URL}/token`)
      .auth(process.env.AUTH_CLIENT_ID, process.env.AUTH_CLIENT_SECRET)
      .type('form')
      .send({
        grant_type: 'refresh_token',
        client_id: process.env.AUTH_CLIENT_ID,
        refresh_token,
      });

    return response.body;
  } catch (ex) {
    if (ex.response && ex.response.body) {
      logger.error('[AUTH ERROR][refreshAuthToken()]', ex.response.body);
    }
    throw new AuthenticationError('Unauthorized');
  }
}

export function getLoginUrl() {
  const params = {
    client_id: process.env.AUTH_CLIENT_ID,
    response_type: 'code',
    scope: OAUTH_SCOPE,
    redirect_uri: process.env.AUTH_CALLBACK_URL,
    state: 'test',
  };

  return `${process.env.AUTH_BASE_URL}/authorize?${querystring.stringify(params)}`;
}

export function getLogoutUrl(id_token: string) {
  const params = {
    client_id: process.env.AUTH_CLIENT_ID,
    id_token_hint: id_token,
    post_logout_redirect_uri: process.env.JETSTREAM_LANDING_URL || 'https://getjetstream.app',
  };

  return `${process.env.AUTH_BASE_URL}/logout?${querystring.stringify(params)}`;
}

// TODO: this should be obtained and stored on the session and not here
// then could be passed to the front-end in a different cookie (or via API - but just directly return the data instead of fetching on each load)
// right now we have to fetch on every page reload, which is wasteful
export async function getUserDetails(accessToken: string): Promise<UserProfile> {
  try {
    const response = await request.get(`${process.env.AUTH_BASE_URL}/userinfo`).set('Authorization', `Bearer ${accessToken}`);

    const userInfo = response.body as OAuth2UserInfoResponse;

    return {
      id: userInfo.sub,
      email: userInfo.email,
      emailVerified: userInfo.email_verified,
      username: userInfo.preferred_username,
      name: userInfo.name,
      familyName: userInfo.family_name,
      givenName: userInfo.given_name,
      locale: userInfo.locale,
      timezone: userInfo.zoneinfo,
    };
  } catch (ex) {
    if (ex.response && ex.response.body) {
      logger.error('[AUTH ERROR][getUserDetails()]', ex.response.body);
    }
    throw new AuthenticationError('Unauthorized');
  }
}

export function createOrUpdateSession(req: express.Request, userAuthToken: AuthenticationToken, user: UserProfile) {
  const userAuth: UserAuthJwt = jwt.decode(userAuthToken.id_token) as UserAuthJwt;

  const userAuthSession: UserAuthSession = {
    access_token: userAuthToken.access_token,
    id_token: userAuthToken.id_token,
    refresh_token: userAuthToken.refresh_token,
    userId: userAuth.sub,
    username: userAuth.preferred_username || userAuth.email || userAuth.sub,
    userAuth,
    user,
  };

  req.session.auth = userAuthSession;
  // TODO: save something in DB to link session to user so we can destroy sessions
  // the main issue is that pruned values will not get removed from this table....
  // we could use a FK and have the record get deleted if FK is deleted - ON DELETE CASCADE - https://stackoverflow.com/questions/14182079/delete-rows-with-foreign-key-in-postgresql
}

/**
 * Revoke an access or refresh token
 * @param tokenType
 * @param token
 */
export async function revokeAuthToken(tokenType: 'access_token' | 'refresh_token', token: string) {
  try {
    await request
      .post(`${process.env.AUTH_BASE_URL}/revoke`)
      .auth(process.env.AUTH_CLIENT_ID, process.env.AUTH_CLIENT_SECRET)
      .type('form')
      .send({
        grant_type: 'refresh_token',
        client_id: process.env.AUTH_CLIENT_ID,
        token_type_hint: tokenType,
        token,
      });
  } catch (ex) {
    if (ex.response && ex.response.body) {
      logger.error('[AUTH ERROR][SILENT FAILURE][revokeAuthToken()]', ex.response.body);
    }
  }
}

export function destroySession(req: express.Request) {
  try {
    req.session.destroy(NOOP);
  } catch (ex) {
    logger.info('[AUTH][SESSION][DESTROY ERROR]', ex.message);
  }
}
