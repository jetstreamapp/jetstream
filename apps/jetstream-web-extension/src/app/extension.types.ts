import { Maybe } from '@jetstream/types';

export type Message = 'getSalesforceHostWithApiAccess' | 'getSession' | 'getPageUrl';
export type MessagePayload = GetSalesforceHostWithApiAccessPayload | GetSessionPayload | GetPageUrlPayload;
export type MessageResponse = GetSalesforceHostWithApiAccessResponse | GetSessionPayloadResponse | GetPageUrlResponse;

export interface MessagePayloadBase {
  message: Message;
}

export interface GetSalesforceHostWithApiAccessPayload extends MessagePayloadBase {
  message: 'getSalesforceHostWithApiAccess';
  url: string;
}

export interface GetSalesforceHostWithApiAccessResponse {
  data: Maybe<string>;
}

///

export interface GetSessionPayload extends MessagePayloadBase {
  message: 'getSession';
  salesforceHost: string;
}

export interface GetSessionPayloadResponse {
  data: {
    hostname: string;
    key: string;
  } | null;
}

///

export interface GetPageUrlPayload extends MessagePayloadBase {
  message: 'getPageUrl';
  page: string;
}

export interface GetPageUrlResponse {
  data: string;
}
