import { ENV } from '@jetstream/api-config';
import type * as oauth from 'oauth4webapi';

export interface OauthClientProvider {
  authorizationServer: oauth.AuthorizationServer;
  client: oauth.Client;
}

export class OauthClients {
  private static instance: OauthClients | null = null;

  public google!: OauthClientProvider;
  public salesforce!: OauthClientProvider;

  private constructor() {
    this.google = this.getClient(getGoogleAuthServer(), ENV.AUTH_GOOGLE_CLIENT_ID, ENV.AUTH_GOOGLE_CLIENT_SECRET);
    this.salesforce = this.getClient(getSalesforceAuthServer(), ENV.AUTH_SFDC_CLIENT_ID, ENV.AUTH_SFDC_CLIENT_SECRET);
  }

  static getInstance(): OauthClients {
    if (!OauthClients.instance) {
      OauthClients.instance = new OauthClients();
    }
    return OauthClients.instance;
  }

  private getClient(authorizationServer: oauth.AuthorizationServer, clientId: string, clientSecret: string): OauthClientProvider {
    return {
      authorizationServer,
      client: {
        client_id: clientId,
        client_secret: clientSecret,
        token_endpoint_auth_method: authorizationServer['token_endpoint_auth_method'],
        id_token_signed_response_alg: authorizationServer['id_token_signed_response_alg'],
        authorization_signed_response_alg: authorizationServer['authorization_signed_response_alg'],
        require_auth_time: authorizationServer['require_auth_time'],
        userinfo_signed_response_alg: authorizationServer['userinfo_signed_response_alg'],
        introspection_signed_response_alg: authorizationServer['introspection_signed_response_alg'],
        default_max_age: authorizationServer['default_max_age'],
        use_mtls_endpoint_aliases: authorizationServer['use_mtls_endpoint_aliases'],
      } as oauth.Client,
    };
  }
}

function getGoogleAuthServer(): oauth.AuthorizationServer {
  /**
   * To avoid having to callout to Google's discovery endpoint,
   * https://accounts.google.com/.well-known/openid-configuration
   */
  const authServer: oauth.AuthorizationServer = {
    issuer: 'https://accounts.google.com',
    authorization_endpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
    device_authorization_endpoint: 'https://oauth2.googleapis.com/device/code',
    token_endpoint: 'https://oauth2.googleapis.com/token',
    userinfo_endpoint: 'https://openidconnect.googleapis.com/v1/userinfo',
    revocation_endpoint: 'https://oauth2.googleapis.com/revoke',
    jwks_uri: 'https://www.googleapis.com/oauth2/v3/certs',
    response_types_supported: ['code', 'token', 'id_token', 'code token', 'code id_token', 'token id_token', 'code token id_token', 'none'],
    response_modes_supported: ['query', 'fragment', 'form_post'],
    subject_types_supported: ['public'],
    id_token_signing_alg_values_supported: ['RS256'],
    scopes_supported: ['openid', 'email', 'profile'],
    token_endpoint_auth_methods_supported: ['client_secret_post', 'client_secret_basic'],
    claims_supported: ['aud', 'email', 'email_verified', 'exp', 'family_name', 'given_name', 'iat', 'iss', 'name', 'picture', 'sub'],
    code_challenge_methods_supported: ['plain', 'S256'],
    grant_types_supported: [
      'authorization_code',
      'refresh_token',
      'urn:ietf:params:oauth:grant-type:device_code',
      'urn:ietf:params:oauth:grant-type:jwt-bearer',
    ],
  };

  return authServer;
}

function getSalesforceAuthServer(): oauth.AuthorizationServer {
  /**
   * To avoid having to callout to Salesforce's discovery endpoint,
   * https://login.salesforce.com/.well-known/openid-configuration
   */
  const authServer: oauth.AuthorizationServer = {
    issuer: 'https://login.salesforce.com',
    authorization_endpoint: 'https://login.salesforce.com/services/oauth2/authorize',
    token_endpoint: 'https://login.salesforce.com/services/oauth2/token',
    revocation_endpoint: 'https://login.salesforce.com/services/oauth2/revoke',
    userinfo_endpoint: 'https://login.salesforce.com/services/oauth2/userinfo',
    jwks_uri: 'https://login.salesforce.com/id/keys',
    registration_endpoint: 'https://login.salesforce.com/services/oauth2/register',
    introspection_endpoint: 'https://login.salesforce.com/services/oauth2/introspect',
    scopes_supported: [
      'cdp_ingest_api',
      'custom_permissions',
      'cdp_segment_api',
      'content',
      'cdp_api',
      'chatbot_api',
      'cdp_identityresolution_api',
      'interaction_api',
      'wave_api',
      'web',
      'cdp_calculated_insight_api',
      'einstein_gpt_api',
      'offline_access',
      'id',
      'api',
      'eclair_api',
      'email',
      'pardot_api',
      'lightning',
      'visualforce',
      'cdp_query_api',
      'sfap_api',
      'address',
      'openid',
      'profile',
      'scrt_api',
      'cdp_profile_api',
      'refresh_token',
      'phone',
      'user_registration_api',
      'pwdless_login_api',
      'chatter_api',
      'mcp_api',
      'full',
      'forgot_password',
    ],
    response_types_supported: ['code', 'token', 'token id_token'],
    subject_types_supported: ['public'],
    id_token_signing_alg_values_supported: ['RS256'],
    display_values_supported: ['page', 'popup', 'touch'],
    token_endpoint_auth_methods_supported: ['client_secret_post', 'client_secret_basic', 'private_key_jwt'],
    claims_supported: [
      'active',
      'address',
      'email',
      'email_verified',
      'family_name',
      'given_name',
      'is_app_installed',
      'language',
      'locale',
      'name',
      'nickname',
      'organization_id',
      'phone_number',
      'phone_number_verified',
      'photos',
      'picture',
      'preferred_username',
      'profile',
      'sub',
      'updated_at',
      'urls',
      'user_id',
      'user_type',
      'zoneinfo',
    ],
  };

  return authServer;
}
