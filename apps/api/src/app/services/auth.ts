import { AuthResponseError } from '../types/types';

// const { Client } = new Issuer({
//   issuer: ENV.CASDOOR_DOMAIN,
//   authorization_endpoint: `${ENV.CASDOOR_DOMAIN}/login/oauth/authorize`,
//   registration_endpoint: `${ENV.CASDOOR_DOMAIN}/signup/oauth/authorize`,
//   token_endpoint: `${ENV.CASDOOR_DOMAIN}/login/oauth/access_token`,
//   jwks_uri: `${ENV.CASDOOR_DOMAIN}/.well-known/jwks`,
//   userinfo_endpoint: `${ENV.CASDOOR_DOMAIN}/api/userinfo`,
//   introspection_endpoint: `${ENV.CASDOOR_DOMAIN}/api/login/oauth/introspect`,
//   token_endpoint_auth_methods_supported: ['client_secret_basic'],
// });

// export const authClient = new Client({
//   client_id: ENV.CASDOOR_CLIENT_ID,
//   client_secret: ENV.CASDOOR_CLIENT_SECRET,
//   redirect_uris: [`${ENV.JETSTREAM_SERVER_URL}/oauth/callback`],
// });

// export function getAuthorizationUrl(prompt: 'login' | 'signup') {
//   const code_verifier = generators.codeVerifier();
//   // store the code_verifier in your framework's session mechanism, if it is a cookie based solution
//   // it should be httpOnly (not readable by javascript) and encrypted.

//   const code_challenge = generators.codeChallenge(code_verifier);

//   const url = authClient.authorizationUrl({
//     scope: 'openid email profile',
//     // resource: 'https://my.api.example.com/resource/32178',
//     code_challenge,
//     code_challenge_method: 'S256',
//   });
//   if (prompt === 'signup') {
//     return url.replace('/login/', '/signup/');
//   }
//   return url;
// }

export function isCasdoorError(data: unknown): data is AuthResponseError {
  return (data as AuthResponseError).status === 'error';
}

// /**
//  * Handles authentication called from passport strategy and returns profile
//  *
//  * @param accessToken
//  * @param refreshToken
//  * @param profile
//  * @param cb
//  * @returns
//  */
// export function handleCasdoorLogin(
//   accessToken: Maybe<string>,
//   refreshToken: Maybe<string>,
//   profile: null,
//   cb: (error: null | Error, user: null | any) => void
// ) {
//   if (!accessToken) {
//     return cb(new Error('Access token not provided'), null);
//   }
//   logger.info(`LOGGED IN! - ${JSON.stringify({ accessToken, refreshToken, profile, cb })}`);
//   axios
//     .request<TokenIntrospection | AuthResponseError>({
//       baseURL: ENV.CASDOOR_DOMAIN,
//       url: '/api/login/oauth/introspect',
//       method: 'POST',
//       auth: { username: ENV.CASDOOR_CLIENT_ID, password: ENV.CASDOOR_CLIENT_SECRET },
//       data: new URLSearchParams({ token: accessToken, token_type_hint: 'access_token' }),
//     })
//     .then((response) => {
//       if (isCasdoorError(response.data)) {
//         logger.warn('[AUTH][ERROR] Error logging in %o', response);
//         throw new Error(response.data.msg);
//       }
//       if (!response.data.active) {
//         logger.warn('[AUTH][ERROR] Invalid access token %o', response);
//         throw new Error('Invalid access token');
//       }
//       return axios.request<CasdoorUserProfile | AuthResponseError>({
//         baseURL: ENV.CASDOOR_DOMAIN,
//         url: `/api/userinfo?accessToken=${accessToken}`,
//         method: 'GET',
//       });
//     })
//     .then((response) => {
//       if (isCasdoorError(response.data)) {
//         logger.warn('[AUTH][ERROR] Error fetching user info %o', response);
//         throw new Error(response.data.msg);
//       }
//       cb(null, response.data);
//     })
//     .catch((err) => {
//       logger.warn('[AUTH][ERROR] Error validating user %o', err);
//       cb(err, null);
//     });
// }
