import { Maybe, UserProfileServer } from '@jetstream/types';
import { Strategy as OAuth2Strategy } from 'passport-oauth2';
import { ENV } from './env-config';

interface LogtoUser {
  sub: string;
  email: string;
  email_verified: boolean;
  name?: Maybe<string>;
  picture?: Maybe<string>;
  updated_at: number;
  username?: Maybe<string>;
  created_at: number;
}

OAuth2Strategy.prototype.userProfile = async (accessToken, done) => {
  const profilePath = `${ENV.AUTH_DOMAIN}${ENV.AUTH_USERINFO_PATH}`;
  const response = await fetch(profilePath, { method: 'GET', headers: { Authorization: `Bearer ${accessToken}` } });
  if (!response.ok) {
    return done(new Error(`Failed to fetch user profile: ${response.statusText}`));
  }
  const logtoUser: LogtoUser = await response.json();
  // Keep same response to avoid breaking change
  const user: UserProfileServer = {
    provider: 'logto',
    id: logtoUser.sub,
    displayName: logtoUser.name || logtoUser.email,
    emails: [{ value: logtoUser.email }],
    name: logtoUser.name,
    nickname: logtoUser.username || logtoUser.email,
    picture: logtoUser.picture,
    user_id: logtoUser.sub,
    _json: {
      sub: logtoUser.sub,
      nickname: logtoUser.username || logtoUser.email,
      name: logtoUser.name || logtoUser.email,
      picture: logtoUser.picture,
      updated_at: new Date(logtoUser.updated_at).toISOString(),
      email: logtoUser.email,
      email_verified: logtoUser.email_verified,
      // TODO: we should deprecate this in favor of some other featureFlag implementation
      'http://getjetstream.app/app_metadata': {
        featureFlags: { flagVersion: 'V1.4', flags: ['all'], isDefault: false },
      },
    },
    _raw: JSON.stringify(logtoUser),
  };
  return done(null, user);
};

OAuth2Strategy.prototype.authorizationParams = function (options: unknown) {
  if (!options || typeof options !== 'object') {
    return {};
  }

  if ('prompt' in options && typeof options.prompt === 'string') {
    return { first_screen: options.prompt === 'login' ? 'signIn' : 'register' };
  }
  return {};
};

OAuth2Strategy.prototype.tokenParams = function (options: unknown) {
  return {};
};

export { OAuth2Strategy };

// OAuth2Strategy.prototype.parseErrorResponse = function(body, status) {
//   var json = JSON.parse(body);
//   if (json.error) {
//     return new TokenError(json.error_description, json.error, json.error_uri);
//   }
//   return null;
// };
