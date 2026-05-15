import { ApiApex } from './api-apex';
import { ApiBinaryDownload } from './api-binary-download';
import { ApiBulk } from './api-bulk';
import { ApiBulkQuery20 } from './api-bulk-query-2.0';
import { ApiMetadata } from './api-metadata';
import { ApiOrg } from './api-org';
import { ApiQuery } from './api-query';
import { ApiRequest } from './api-request';
import { ApiSObject } from './api-sobject';
import { getApiRequestFactoryFn, RefreshedTokens, RefreshTokensFn } from './callout-adapter';
import { Logger, SessionInfo } from './types';

export interface ApiConnectionOptions {
  apiRequestAdapter: ReturnType<typeof getApiRequestFactoryFn>;
  userId: string;
  organizationId: string;
  instanceUrl: string;
  accessToken: string;
  refreshToken?: string;
  apiVersion: string;
  callOptions?: Record<string, string | boolean | number>;
  enableLogging?: boolean;
  sfdcClientId?: string;
  sfdcClientSecret?: string;
  logger: Logger;
  /**
   * Caller-supplied refresh orchestrator. Owns cross-process coordination (advisory lock,
   * in-memory check), the optimistic re-read, the Salesforce token exchange, and persistence.
   * Wrapped in a per-process single-flight cache inside the adapter so that N concurrent 401s
   * collapse to a single Salesforce call.
   */
  refreshTokens?: RefreshTokensFn;
  /**
   * Defense-in-depth fallback for the legacy refresh path. Almost never fires when
   * `refreshTokens` is wired up. Kept for safety while we migrate all callers.
   */
  getFreshTokens?: () => Promise<RefreshedTokens | null>;
}

export class ApiConnection {
  logger: Logger;
  sessionInfo: SessionInfo;
  apiRequest: ReturnType<ReturnType<typeof getApiRequestFactoryFn>>;
  refreshCallback: ((accessToken: string, refreshToken: string) => Promise<void> | void) | undefined;
  onConnectionError: ((error: string) => void) | undefined;

  org: ApiOrg;
  apex: ApiApex;
  binary: ApiBinaryDownload;
  bulk: ApiBulk;
  bulkQuery20: ApiBulkQuery20;
  metadata: ApiMetadata;
  query: ApiQuery;
  sobject: ApiSObject;
  request: ApiRequest;

  constructor(
    {
      apiRequestAdapter,
      userId,
      organizationId,
      instanceUrl,
      apiVersion,
      accessToken,
      refreshToken,
      callOptions,
      enableLogging = false,
      sfdcClientId,
      sfdcClientSecret,
      logger,
      refreshTokens,
      getFreshTokens,
    }: ApiConnectionOptions,
    refreshCallback?: (accessToken: string, refreshToken: string) => Promise<void> | void,
    onConnectionError?: (error: string) => void,
  ) {
    this.logger = logger;
    this.refreshCallback = refreshCallback;
    this.onConnectionError = onConnectionError;
    this.sessionInfo = {
      userId,
      organizationId,
      instanceUrl,
      accessToken,
      refreshToken,
      apiVersion,
      callOptions,
      sfdcClientId,
      sfdcClientSecret,
    };
    this.apiRequest = apiRequestAdapter({
      logger,
      // Legacy hook — preserved while callers without `refreshTokens` finish migrating. Once
      // `refreshTokens` is wired up, the adapter mutates sessionInfo directly and this callback
      // is unused for the primary path; it still fires from the `getFreshTokens` fallback.
      onRefresh: this.handleRefresh.bind(this),
      onConnectionError: this.handleConnectionError.bind(this),
      enableLogging,
      getFreshTokens,
      refreshTokens,
    });

    this.apex = new ApiApex(this);
    this.binary = new ApiBinaryDownload(this);
    this.bulk = new ApiBulk(this);
    this.bulkQuery20 = new ApiBulkQuery20(this);
    this.metadata = new ApiMetadata(this);
    this.org = new ApiOrg(this);
    this.query = new ApiQuery(this);
    this.request = new ApiRequest(this);
    this.sobject = new ApiSObject(this);
  }

  public updateSessionInfo({
    accessToken,
    apiVersion,
    callOptions,
    instanceUrl,
    organizationId,
    refreshToken,
    sfdcClientId,
    sfdcClientSecret,
    userId,
  }: Partial<
    Pick<
      ApiConnectionOptions,
      | 'accessToken'
      | 'apiVersion'
      | 'callOptions'
      | 'instanceUrl'
      | 'organizationId'
      | 'refreshToken'
      | 'sfdcClientId'
      | 'sfdcClientSecret'
      | 'userId'
    >
  >) {
    this.sessionInfo.accessToken = accessToken ?? this.sessionInfo.accessToken;
    this.sessionInfo.apiVersion = apiVersion ?? this.sessionInfo.apiVersion;
    this.sessionInfo.callOptions = callOptions ?? this.sessionInfo.callOptions;
    this.sessionInfo.instanceUrl = instanceUrl ?? this.sessionInfo.instanceUrl;
    this.sessionInfo.organizationId = organizationId ?? this.sessionInfo.organizationId;
    this.sessionInfo.refreshToken = refreshToken ?? this.sessionInfo.refreshToken;
    this.sessionInfo.sfdcClientId = sfdcClientId ?? this.sessionInfo.sfdcClientId;
    this.sessionInfo.sfdcClientSecret = sfdcClientSecret ?? this.sessionInfo.sfdcClientSecret;
    this.sessionInfo.userId = userId ?? this.sessionInfo.userId;
  }

  /**
   * Updates in-memory session state with freshly rotated tokens.
   *
   * When skipPersistence is true, the refreshCallback is NOT invoked. This is used by the
   * race-condition fallback in callout-adapter, which retrieves tokens that are ALREADY persisted
   * by the worker that won the rotation race — re-persisting them would be a wasted encrypt + DB write.
   */
  public async handleRefresh(accessToken: string, newRefreshToken?: string, skipPersistence = false) {
    this.sessionInfo.accessToken = accessToken;
    if (newRefreshToken) {
      this.sessionInfo.refreshToken = newRefreshToken;
    }
    if (skipPersistence) {
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    await this.refreshCallback?.(accessToken, this.sessionInfo.refreshToken!);
  }

  public handleConnectionError(error: string) {
    this.onConnectionError?.(error);
  }
}
