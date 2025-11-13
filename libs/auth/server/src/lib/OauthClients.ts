import { ENV, logger } from '@jetstream/api-config';
import { getErrorMessageAndStackObj } from '@jetstream/shared/utils';
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
      this.discoveryRequestWithRetry(oauth, this.providers.salesforce)
        .then((response) => oauth.processDiscoveryResponse(this.providers.salesforce, response))
        .then((authorizationServer) => this.getClient(authorizationServer, ENV.AUTH_SFDC_CLIENT_ID, ENV.AUTH_SFDC_CLIENT_SECRET))
        .catch((err) => {
          logger.error(getErrorMessageAndStackObj(err), 'FATAL INIT ERROR - could not load salesforce oauth client');
          throw err;
        }),
      this.discoveryRequestWithRetry(oauth, this.providers.google)
        .then((response) => oauth.processDiscoveryResponse(this.providers.google, response))
        .then((authorizationServer) => this.getClient(authorizationServer, ENV.AUTH_GOOGLE_CLIENT_ID, ENV.AUTH_GOOGLE_CLIENT_SECRET))
        .catch((err) => {
          logger.error(getErrorMessageAndStackObj(err), 'FATAL INIT ERROR - could not load google oauth client');
          throw err;
        }),
    ]);
    this.salesforce = salesforceClient;
    this.google = googleClient;
  }

  private async discoveryRequestWithRetry(oauth: typeof import('oauth4webapi'), provider: URL, maxRetries = 3): Promise<any> {
    let lastError: Error;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        logger.info({ provider: provider.toString(), attempt }, 'Attempting OAuth discovery request');
        const response = await oauth.discoveryRequest(provider);
        logger.info({ provider: provider.toString(), attempt }, 'OAuth discovery request successful');
        return response;
      } catch (error) {
        lastError = error as Error;
        logger.warn(
          {
            provider: provider.toString(),
            attempt,
            maxRetries,
            error: lastError.message,
            stack: lastError.stack,
          },
          'OAuth discovery request failed, retrying...',
        );

        if (attempt < maxRetries) {
          // Exponential backoff: 1s, 2s, 4s
          await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt - 1) * 1000));
        }
      }
    }

    throw lastError! || new Error('OAuth discovery request failed after maximum retries');
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

// eager init, skip in jest tests
if (!process.env.JEST_WORKER_ID) {
  OauthClients.getInstance().catch((err) => {
    logger.error(getErrorMessageAndStackObj(err), 'FATAL INIT ERROR - could not load oauth clients');
    process.exit(1);
  });
}
