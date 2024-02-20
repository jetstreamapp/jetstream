import { SoapNil } from './misc.types';

export interface AnonymousApexSoapResponse {
  'soapenv:Envelope': {
    'soapenv:Header': {
      DebuggingInfo: {
        debugLog: string;
      };
    };
    'soapenv:Body': {
      executeAnonymousResponse: {
        result: {
          column: string | SoapNil;
          compileProblem: string | SoapNil;
          compiled: string | SoapNil;
          exceptionMessage: string | SoapNil;
          exceptionStackTrace: string | SoapNil;
          line: string | SoapNil;
          success: string | SoapNil;
        };
      };
    };
  };
}

export interface AnonymousApexResponse {
  debugLog: string;
  result: {
    column?: number | null;
    compileProblem?: string | null;
    compiled: boolean;
    exceptionMessage?: string | null;
    exceptionStackTrace?: string | null;
    line?: number | null;
    success: boolean;
  };
}

/**
 * Examples:
 *
 * publicDeclarations['System'] // Get list of all base types, usually just use this
 * publicDeclarations['System']['System'].methods // get everything in the system class
 * publicDeclarations['System']['Integer'].methods // get methods from the Integer class
 *
 */
export interface ApexCompletionResponse {
  publicDeclarations: Record<string, Record<string, ApexCompletion>>;
}

export interface ApexCompletion {
  constructors: ApexCompletionMethod[];
  methods: ApexCompletionMethod[];
  properties: ApexCompletionProperty[];
}

export interface ApexCompletionMethod {
  argTypes?: string[]; // not populated on constructors
  isStatic?: boolean; // not populated on constructors
  methodDoc: null;
  name: string;
  parameters: ApexCompletionMethodParameter[];
  references: unknown[];
  returnType: string; // not populated on constructors
}

export interface ApexCompletionMethodParameter {
  name: string;
  type: string;
}

export interface ApexCompletionProperty {
  name: string;
  references: unknown[];
}
