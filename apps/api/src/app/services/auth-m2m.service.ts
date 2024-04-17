import { ENV, logger } from '@jetstream/api-config';
import { LogToUserProfile, SocialConnector_UNSAFE, UserProfileServer } from '@jetstream/types';
import { addSeconds, isBefore } from 'date-fns';
import { UserFacingError } from '../utils/error-handler';

const accessTokenCache = {
  token: null as string | null,
  expiresAt: new Date(),
};

interface TokenResponse {
  access_token: string;
  expires_in: number;
  token_type: 'Bearer';
}

async function initAuthorizationToken(user: UserProfileServer) {
  if (isBefore(new Date(), addSeconds(accessTokenCache.expiresAt, -60))) {
    logger.info({ userId: user.id }, 'Using Cached M2M access token');
    return accessTokenCache.token;
  }
  logger.info({ userId: user.id }, 'Fetching new M2M access token');

  const response = await fetch(`${ENV.AUTH_DOMAIN}${ENV.AUTH_TOKEN_PATH}`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${ENV.AUTH_M2M_CLIENT_ID}:${ENV.AUTH_M2M_CLIENT_SECRET}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      resource: ENV.AUTH_M2M_API_RESOURCE,
      scope: 'all',
    }).toString(),
  });
  if (!response.ok) {
    throw new UserFacingError('Failed to fetch user profile');
  }
  const tokenResponse: TokenResponse = await response.json();
  accessTokenCache.token = tokenResponse.access_token;
  accessTokenCache.expiresAt = addSeconds(new Date(), tokenResponse.expires_in);
  return accessTokenCache.token;
}

export async function getUser(user: UserProfileServer): Promise<LogToUserProfile> {
  const accessToken = await initAuthorizationToken(user);
  const response = await fetch(`${ENV.AUTH_DOMAIN}/api/users/${user.id}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    logger.info({ userId: user.id, response: await response.text() }, 'Failed to fetch user profile');
    throw new UserFacingError('Failed to fetch user profile');
  }
  return (await response.json()) as LogToUserProfile;
}

// mxe7szv2c4e0airrlq19o google
// ii8w0d0e4qfrmr09hcjaa sfdc

export async function getSocialConnectors(user: UserProfileServer): Promise<SocialConnector_UNSAFE[]> {
  const accessToken = await initAuthorizationToken(user);

  const response = await fetch(`${ENV.AUTH_DOMAIN}/api/connectors`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    logger.error({ userId: user.id, response: await response.text() }, '[AUTH][LINK] Failed to fetch connections');
    throw new UserFacingError('Failed to obtain social connections');
  }
  return (await response.json()) as SocialConnector_UNSAFE[];
}

export async function getConnectorAuthorizationUrl(
  user: UserProfileServer,
  connectorName: 'google' | 'salesforce' | 'github',
  state: string,
  redirectUri: string
): Promise<{ redirectTo: string }> {
  const accessToken = await initAuthorizationToken(user);

  const connectors = await getSocialConnectors(user);
  const connector = connectors.find(({ target }) => target.toLowerCase() === connectorName.toLowerCase());
  if (!connector) {
    throw new UserFacingError('Invalid connection');
  }

  const response = await fetch(`${ENV.AUTH_DOMAIN}/api/connectors/${connector.id}/authorization-uri`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ state, redirectUri }),
  });

  if (!response.ok) {
    logger.error({ userId: user.id, response: await response.text() }, '[AUTH][LINK] Failed to get authorization uri');
    throw new UserFacingError('Failed to get authorization url');
  }
  return (await response.json()) as { redirectTo: string };
}
