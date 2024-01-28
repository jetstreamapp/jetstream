import { Maybe } from '@jetstream/types';
import { ApiClient } from './utils/api.utils';

export type Message = GetSfHost | GetSession | GetPageUrl | InitOrg;
export type MessageRequest = Message['request'];
export interface MessageResponse<T extends Message['response'] = Message['response']> {
  data: T;
}

export interface SessionInfo {
  hostname: string;
  key: string;
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
  response: ApiClient;
}
