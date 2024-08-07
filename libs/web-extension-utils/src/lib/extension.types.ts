import { ApiConnection } from '@jetstream/salesforce-api';
import { Maybe, SalesforceOrgUi } from '@jetstream/types';

export type Message = ToggleExtension | GetSfHost | GetSession | GetPageUrl | InitOrg;
export type MessageRequest = Message['request'];

export interface ResponseError {
  error: true;
  message: string;
}

export interface MessageResponse<T extends Message['response'] = Message['response']> {
  data: T;
  error?: ResponseError;
}

export interface SessionInfo {
  hostname: string;
  key: string;
}

export interface ToggleExtension {
  request: {
    message: 'TOGGLE_EXTENSION';
    data: boolean;
  };
  response: void;
}

export interface GetSfHost {
  request: {
    message: 'GET_SF_HOST';
    data: { url: string };
  };
  response: Maybe<string>;
}

export interface GetSession {
  request: {
    message: 'GET_SESSION';
    data: { salesforceHost: string };
  };
  response: Maybe<SessionInfo>;
}

export interface GetPageUrl {
  request: {
    message: 'GET_PAGE_URL';
    data: { page: string };
  };
  response: Maybe<string>;
}

export interface InitOrg {
  request: {
    message: 'INIT_ORG';
    data: { sessionInfo: SessionInfo };
  };
  response: { org: SalesforceOrgUi };
}

export interface OrgAndSessionInfo {
  org: SalesforceOrgUi;
  sessionInfo: SessionInfo;
}

export interface OrgAndApiConnection {
  org: SalesforceOrgUi;
  apiConnection: ApiConnection;
}
