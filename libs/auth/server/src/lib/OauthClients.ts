import { ENV, logger } from '@jetstream/api-config';
import type * as oauth from 'oauth4webapi';

const oauthPromise = import('oauth4webapi');

export interface OauthClientProvider {
  authorizationServer: oauth.AuthorizationServer;
  client: oauth.Client;
}

export class OauthClients {
  private static instance: OauthClients | null = null;
  private static initPromise: Promise<OauthClients> | null = null;

  public google!: OauthClientProvider;
  public salesforce!: OauthClientProvider;

  private providers = {
    salesforce: new URL('https://login.salesforce.com'),
    google: new URL('https://accounts.google.com'),
  } as const;

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  private constructor() {}

  static getInstance(): Promise<OauthClients> {
    if (!OauthClients.instance) {
      if (!OauthClients.initPromise) {
        const instance = new OauthClients();
        OauthClients.initPromise = instance.init().then(() => {
          OauthClients.instance = instance;
          return instance;
        });
      }
      return OauthClients.initPromise;
    }
    return Promise.resolve(OauthClients.instance);
  }

  private async init() {
    const oauth = await oauthPromise;
    const [salesforceClient, googleClient] = await Promise.all([
      oauth
        .discoveryRequest(this.providers.salesforce)
        .then((response) => oauth.processDiscoveryResponse(this.providers.salesforce, response))
        .then((authorizationServer) => this.getClient(authorizationServer, ENV.AUTH_SFDC_CLIENT_ID, ENV.AUTH_SFDC_CLIENT_SECRET)),
      oauth
        .discoveryRequest(this.providers.google)
        .then((response) => oauth.processDiscoveryResponse(this.providers.google, response))
        .then((authorizationServer) => this.getClient(authorizationServer, ENV.AUTH_GOOGLE_CLIENT_ID, ENV.AUTH_GOOGLE_CLIENT_SECRET)),
    ]);
    this.salesforce = salesforceClient;
    this.google = googleClient;
  }

  private getClient(authorizationServer: oauth.AuthorizationServer, clientId: string, clientSecret: string): OauthClientProvider {
    // test
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

// eager init
OauthClients.getInstance().catch((err) => {
  logger.error('FATAL INIT ERROR - could not load oauth clients', err);
  process.exit(1);
});
