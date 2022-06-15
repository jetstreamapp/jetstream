import { AuthenticationToken, UserProfileAuth0Ui } from '@jetstream/types';
import { createHash, randomBytes } from 'crypto';
import { safeStorage } from 'electron';
import * as fs from 'fs-extra';
import * as jwt from 'jsonwebtoken';
import * as jwksClient from 'jwks-rsa';
import fetch from 'node-fetch';
import { join } from 'path';
import * as querystring from 'querystring';
import { URLSearchParams } from 'url';
import App from '../app';
import { authAudience, authRedirectUri, authStorage } from '../constants';
import logger from './logger';

interface AuthInfo {
  token: AuthenticationToken;
  codeVerifier: string;
  userInfo: UserProfileAuth0Ui;
}

// set when generateAuthUrl() is called
let code_verifier: string;

function getDomainAndClientId() {
  let domain = 'auth.getjetstream.app';
  let clientId = '0lTUFrifw9vkRrRNjqbARR57JsNHvlHS';

  if (App.isDevelopmentMode()) {
    domain = 'getjetstream-dev.us.auth0.com';
    clientId = 'c9JqPleX8t9fDKGc3j3oYVAwvXI5ENtQ';
  }
  return { domain, clientId };
}

/**
 * Read auth token from storage
 */
export function readAuthToken(path: string): AuthInfo {
  let auth: AuthInfo;
  const filePath = join(path, authStorage);
  logger.log('[AUTH][READ]', filePath);
  if (fs.existsSync(filePath)) {
    if (safeStorage.isEncryptionAvailable()) {
      logger.log('[SAFE STORAGE][AVAILABLE]');
      const authInfo = safeStorage.decryptString(fs.readFileSync(filePath));
      auth = JSON.parse(authInfo);
    } else {
      logger.log('[SAFE STORAGE][NOT AVAILABLE]');
      auth = fs.readJsonSync(filePath);
    }
  }
  return auth || { token: null, codeVerifier: null, userInfo: null };
}

/**
 * Write auth token to storage
 */
export function writeAuthToken(path: string, auth: AuthInfo): void {
  logger.log('[AUTH][WRITE]');
  const filePath = join(path, authStorage);

  if (safeStorage.isEncryptionAvailable()) {
    fs.writeFileSync(filePath, safeStorage.encryptString(JSON.stringify(auth)));
  } else {
    fs.writeFileSync(filePath, JSON.stringify(auth));
  }
}

export function clearAuthToken(path: string): void {
  const filePath = join(path, authStorage);
  if (fs.existsSync(filePath)) {
    fs.removeSync(filePath);
  }
}

function verify(accessToken) {
  return new Promise((resolve, reject) => {
    const { domain } = getDomainAndClientId();
    function getKey(header, callback) {
      const client = jwksClient({
        jwksUri: `https://${domain}/.well-known/jwks.json`,
      });

      client.getSigningKey(header.kid, function (err, key) {
        if (err) {
          return callback(err);
        }
        var signingKey = (key as any).publicKey || (key as any).rsaPublicKey;
        callback(null, signingKey);
      });
    }

    jwt.verify(
      accessToken,
      getKey,
      {
        audience: authAudience,
        issuer: `https://${domain}/`,
        algorithms: ['RS256'],
        ignoreExpiration: true,
      },
      (err, token) => {
        if (err) {
          return reject(err);
        }
        resolve(token);
      }
    );
  });
}

export async function verifyToken(savePath: string, { codeVerifier, token, userInfo }: AuthInfo): Promise<boolean> {
  try {
    const tokenInfo = jwt.decode(token.access_token, { json: true });
    // TODO: see if we need to refresh token
    const verificationResults = await verify(token.access_token);

    if (tokenInfo && verificationResults) {
      if (Date.now() >= tokenInfo.exp * 1000) {
        const newToken = await refreshToken(token.refresh_token);
        writeAuthToken(savePath, {
          codeVerifier,
          token: newToken,
          userInfo,
        });
      }
      return true;
    } else {
      throw new Error('Could not validate token');
    }
  } catch (ex) {
    logger.warn('[AUTH][VALIDATION] Could not validate token validity', ex.message);
    return false;
  }
}

function base64URLEncode(str) {
  return str.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest();
}

export function generateAuthUrl(isSignup = false): string {
  const { clientId, domain } = getDomainAndClientId();

  code_verifier = base64URLEncode(randomBytes(32));
  var code_challenge = base64URLEncode(sha256(code_verifier));

  const query = new URLSearchParams({
    audience: authAudience,
    scope: 'openid email profile offline_access',
    response_type: 'code',
    client_id: clientId,
    redirect_uri: authRedirectUri,
    code_challenge,
    code_challenge_method: 'S256',
  });
  if (isSignup) {
    query.append('screen_hint', 'signup');
  }
  const url = `https://${domain}/authorize?${query.toString()}`;
  logger.log('[AUTH][URL]', url);
  return url;
}

export async function exchangeCodeForToken(url: URL): Promise<AuthInfo> {
  logger.log('[AUTH][TOKEN EXCHANGE]');
  const params = url.searchParams;

  const code = params.get('code');
  const error = params.get('error');
  const errorDescription = params.get('error_description');

  const state = querystring.parse(params.get('state'));

  const { clientId, domain } = getDomainAndClientId();

  const token = await (
    await fetch(`https://${domain}/oauth/token`, {
      method: 'POST',
      body: new URLSearchParams({
        audience: authAudience,
        grant_type: 'authorization_code',
        client_id: clientId,
        code_verifier,
        code,
        redirect_uri: 'jetstream://localhost/oauth/callback',
      }),
    })
  ).json();

  logger.log('[AUTH][TOKEN][OBTAINED]');

  const userInfo = await (
    await fetch(`https://${domain}/userinfo`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token.access_token}` },
    })
  ).json();

  logger.log('[AUTH][USER INFO][OBTAINED]');

  return {
    token,
    codeVerifier: code_verifier,
    userInfo: {
      user_id: userInfo.user_id,
      email: userInfo.email,
      email_verified: userInfo.email_verified,
      identities: userInfo.identities,
      name: userInfo.name,
      nickname: userInfo.nickname,
      picture: userInfo.picture,
      app_metadata: userInfo.app_metadata,
      username: userInfo.username,
    },
  };
}

export async function refreshToken(refreshToken: string): Promise<AuthenticationToken> {
  logger.log('[AUTH][REFRESHING TOKEN]');

  const { clientId, domain } = getDomainAndClientId();

  const token = await (
    await fetch(`https://${domain}/oauth/token`, {
      method: 'POST',
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: clientId,
        refresh_token: refreshToken,
      }),
    })
  ).json();

  logger.log('[AUTH][REFRESH TOKEN][OBTAINED]');

  return {
    ...token,
    refresh_token: refreshToken,
  };
}
