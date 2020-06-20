/* eslint-disable @typescript-eslint/camelcase */
import { FusionAuthClient, AccessToken } from '@fusionauth/typescript-client';
// FIXME: https://github.com/FusionAuth/fusionauth-typescript-client/issues/27
import ClientResponse from '@fusionauth/typescript-client/build/src/ClientResponse';
import { UserAuthJwt, UserAuthSession } from '@jetstream/types';
import * as express from 'express';
import * as jwt from 'jsonwebtoken';
import * as querystring from 'querystring';
import { NOOP } from '@jetstream/shared/utils';
import { logger } from '../config/logger.config';

const FUSIONAUTH_SCOPE = 'openid offline_access';

let _client: FusionAuthClient;

function getAuthClient() {
  _client =
    _client ||
    new FusionAuthClient(process.env.JETSTREAM_AUTH_API_KEY, process.env.JETSTREAM_AUTH_SERVER_URL, process.env.JETSTREAM_AUTH_TENANT_ID);
  return _client;
}

function getLoginRedirectUrl() {
  return `${process.env.JETSTREAM_SERVER_URL}/oauth/callback`;
}

function returnResponseOrThrow<T>(clientResponse: ClientResponse<T>, errorLogText: string) {
  const { statusCode, response, exception } = clientResponse;
  const success = statusCode >= 200 && statusCode < 300;

  if (!success) {
    logger.info('[AUTH] %s', errorLogText);
    throw exception;
  }

  return response;
}

export async function getUserDetails(userId: string) {
  return returnResponseOrThrow(await getAuthClient().retrieveUser(userId), 'retrieveUser');
}

export function getLogoutUrl() {
  const params = {
    client_id: process.env.JETSTREAM_AUTH_CLIENT_ID,
    post_logout_redirect_uri: `${process.env.JETSTREAM_SERVER_URL}`, // root page - TODO: fix for localhost
    tenantId: process.env.JETSTREAM_AUTH_TENANT_ID,
  };

  return `${process.env.JETSTREAM_AUTH_SERVER_URL}/oauth2/logout?${querystring.stringify(params)}`;
}

export function createOrUpdateSession(req: express.Request, userAuthToken: AccessToken) {
  const userAuthJwt: UserAuthJwt = jwt.decode(userAuthToken.access_token) as UserAuthJwt;

  const userAuthSession: UserAuthSession = {
    access_token: userAuthToken.access_token,
    id_token: userAuthToken.id_token,
    refresh_token: userAuthToken.refresh_token, // TODO: do we actually need this?
    userId: userAuthToken.userId,
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

/**
 * Generate login URL for Jetstream OAuth
 * @param options
 */
export function getLoginUrl(options: { deviceDescription?: string; locale?: string } = { locale: 'en' }) {
  options = options || {};
  options.deviceDescription = options.deviceDescription || 'unknown';
  options.locale = options.locale || 'en';
  const { deviceDescription, locale } = options;

  const queryParams = {
    client_id: process.env.JETSTREAM_AUTH_CLIENT_ID,
    redirect_uri: getLoginRedirectUrl(),
    response_type: 'code',
    tenantId: process.env.JETSTREAM_AUTH_TENANT_ID,
    scope: FUSIONAUTH_SCOPE,
    'metaData.device.description': deviceDescription,
    state: 'state',
    locale,
  };

  return `${process.env.JETSTREAM_AUTH_SERVER_URL}/oauth2/authorize?${querystring.stringify(queryParams)}`;
}

export async function exchangeOAuthCodeForAccessToken(code: string) {
  return returnResponseOrThrow(
    await getAuthClient().exchangeOAuthCodeForAccessToken(
      code,
      process.env.JETSTREAM_AUTH_CLIENT_ID,
      process.env.JETSTREAM_AUTH_CLIENT_SECRET,
      getLoginRedirectUrl()
    ),
    'exchangeOAuthCodeForAccessToken'
  );
}

export async function refreshAuthToken(refresh_token: string) {
  // TODO: submit PR to fix optional properties with request
  // https://github.com/FusionAuth/fusionauth-typescript-client/issues/29
  return returnResponseOrThrow(
    await getAuthClient().exchangeRefreshTokenForAccessToken(
      refresh_token,
      process.env.JETSTREAM_AUTH_CLIENT_ID,
      process.env.JETSTREAM_AUTH_CLIENT_SECRET,
      FUSIONAUTH_SCOPE,
      undefined
    ),
    'exchangeRefreshTokenForAccessToken'
  );
}
