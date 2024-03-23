import { ApiApex } from './api-apex';
import { ApiBulk } from './api-bulk';
import { ApiBulkQuery20 } from './api-bulk-query-2.0';
import { ApiMetadata } from './api-metadata';
import { ApiOrg } from './api-org';
import { ApiQuery } from './api-query';
import { ApiRequest } from './api-request';
import { ApiSObject } from './api-sobject';
import { getApiRequestFactoryFn } from './callout-adapter';
import { Logger, SessionInfo } from './types';

interface ApiConnectionOptions {
  apiRequestAdapter: ReturnType<typeof getApiRequestFactoryFn>;
  userId: string;
  organizationId: string;
  instanceUrl: string;
  accessToken: string;
  refreshToken?: string;
  apiVersion: string;
  callOptions?: Record<string, any>;
  logging?: boolean;
  sfdcClientId?: string;
  sfdcClientSecret?: string;
  logger?: Logger;
}

export class ApiConnection {
  logger: Logger;
  sessionInfo: SessionInfo;
  apiRequest: ReturnType<ReturnType<typeof getApiRequestFactoryFn>>;
  refreshCallback: ((accessToken: string, refreshToken: string) => void) | undefined;

  org: ApiOrg;
  apex: ApiApex;
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
      logging,
      sfdcClientId,
      sfdcClientSecret,
      logger = console,
    }: ApiConnectionOptions,
    refreshCallback?: (accessToken: string, refreshToken: string) => void
  ) {
    this.logger = logger;
    this.apiRequest = apiRequestAdapter(this.handleRefresh.bind(this), logging, logger);
    this.refreshCallback = refreshCallback;
    this.sessionInfo = {
      userId,
      organizationId,
      instanceUrl: instanceUrl,
      accessToken,
      refreshToken,
      apiVersion,
      callOptions,
      sfdcClientId,
      sfdcClientSecret,
    };

    this.apex = new ApiApex(this);
    this.bulk = new ApiBulk(this);
    this.bulkQuery20 = new ApiBulkQuery20(this);
    this.metadata = new ApiMetadata(this);
    this.org = new ApiOrg(this);
    this.query = new ApiQuery(this);
    this.request = new ApiRequest(this);
    this.sobject = new ApiSObject(this);
  }

  handleRefresh(accessToken: string) {
    // todo: do we need to do anything here?
    this.sessionInfo.accessToken = accessToken;
    this.refreshCallback?.(accessToken, this.sessionInfo.refreshToken!);
  }
}
