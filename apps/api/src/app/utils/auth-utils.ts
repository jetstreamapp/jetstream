import * as Auth0Strategy from 'passport-auth0';

interface AuthorizationParamsOptions {
  audience?: string;
  connection?: string;
  prompt?: string;
  screen_hint?: string;
  connection_scope?: string;
  login_hint?: string;
  acr_values?: string;
  maxAge?: number;
  nonce?: string;
}

// Monkey Patch Auth0Strategy to allow directing a user to the login page
// :sob: - https://github.com/auth0/passport-auth0/issues/53
// https://auth0.com/docs/universal-login/new-experience#signup
// https://github.com/auth0/passport-auth0/blob/096f789bea36a45a18d1a06accdd73decfb65131/lib/index.js#L99
(Auth0Strategy as any).prototype.authorizationParams = function (options: AuthorizationParamsOptions) {
  options = options || {};

  const params: any = {};
  if (options.connection && typeof options.connection === 'string') {
    params.connection = options.connection;

    if (options.connection_scope && typeof options.connection_scope === 'string') {
      params.connection_scope = options.connection_scope;
    }
  }

  if (options.audience && typeof options.audience === 'string') {
    params.audience = options.audience;
  }

  if (options.prompt && typeof options.prompt === 'string') {
    params.prompt = options.prompt;
  }

  if (options.login_hint && typeof options.login_hint === 'string') {
    params.login_hint = options.login_hint;
  }

  // This was added - now screen_hint can be passed as an Passport option
  if (options.screen_hint && typeof options.screen_hint === 'string') {
    params.screen_hint = options.screen_hint;
  }

  if (options.acr_values && typeof options.acr_values === 'string') {
    params.acr_values = options.acr_values;
  }

  const strategyOptions = this.options;
  if (strategyOptions && typeof strategyOptions.maxAge === 'number') {
    params.max_age = strategyOptions.maxAge;
  }

  if (this.authParams && typeof this.authParams.nonce === 'string') {
    params.nonce = this.authParams.nonce;
  }

  return params;
};
