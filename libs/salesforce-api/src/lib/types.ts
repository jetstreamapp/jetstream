/* eslint-disable @typescript-eslint/no-explicit-any */
export interface SessionInfo {
  userId: string;
  organizationId: string;
  instanceUrl: string;
  accessToken: string;
  refreshToken?: string;
  apiVersion: string;
  sfdcClientId?: string;
  sfdcClientSecret?: string;
  callOptions?: Record<string, any>;
}

export type SoapNamespace = 'http://soap.sforce.com/2006/04/metadata' | 'http://soap.sforce.com/2006/08/apex';

export type SoapResponse<Key extends string, T> = {
  Envelope: {
    Body: Record<Key, { result: T }>;
    Header?: any;
  };
};

export interface APIRequestParams {
  method?: FetchMethod;
  url: string;
  body?: any; // Consider using a more specific type if possible
  headers?: Headers;
  sessionInfo: SessionInfo;
  outputType?: 'json' | 'text' | 'arrayBuffer' | 'stream';
}

export type FetchMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

export interface Headers {
  append(name: string, value: string): void;
  delete(name: string): void;
  get(name: string): string | null;
  getSetCookie(): string[];
  has(name: string): boolean;
  set(name: string, value: string): void;
  forEach(callbackfn: (value: string, key: string, parent: Headers) => void, thisArg?: any): void;
  entries(): HeadersIterator<[string, string]>;
  keys(): HeadersIterator<string>;
  values(): HeadersIterator<string>;
  [Symbol.iterator](): HeadersIterator<[string, string]>;
}

export interface FetchOptions {
  method?: FetchMethod;
  body?: BodyInit | null;
  headers?: [string, string][] | Record<string, string> | Headers;
  duplex?: ApiRequestOptions['duplex'];
}

export interface FetchResponse<T = unknown> {
  status: number;
  statusText?: string;
  ok: boolean;
  headers: Headers;
  type: string;
  clone: () => FetchResponse<T>;
  text: () => Promise<string>;
  arrayBuffer: () => Promise<ArrayBuffer>;
  json: () => Promise<T>;
  body?: ReadableStream<Uint8Array> | null;
}

export type FetchFn = (url: string, options: FetchOptions) => Promise<FetchResponse>;

export interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  url: string;
  body?: any;
  headers?: Record<string, string>;
  sessionInfo: SessionInfo;
  outputType?: ApiRequestOutputType;
  /**
   * Indicates that the body is already serialized (e.g. string or stream) and should not be JSON.stringified
   */
  rawBody?: boolean;
  /**
   * Used when streaming requests (e.g. file uploads)
   */
  duplex?: 'half';
}

export type ApiRequestOutputType = 'json' | 'text' | 'xml' | 'soap' | 'arrayBuffer' | 'stream' | 'void' | 'response';

export interface SoapErrorResponse {
  Envelope: {
    Body: {
      Fault: {
        faultcode: string;
        faultstring: string;
      };
    };
  };
}

export interface BulkXmlErrorResponse {
  error: {
    exceptionCode: string;
    exceptionMessage: string;
  };
}

export interface Logger {
  trace: (...data: unknown[]) => void;
  error: (...data: unknown[]) => void;
  warn: (...data: unknown[]) => void;
  info: (...data: unknown[]) => void;
  debug: (...data: unknown[]) => void;
}
