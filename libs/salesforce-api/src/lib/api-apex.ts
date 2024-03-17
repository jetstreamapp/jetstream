import { getValueOrSoapNull, toBoolean, unSanitizeXml } from '@jetstream/shared/utils';
import { AnonymousApexResponse, ApexCompletionResponse, Maybe } from '@jetstream/types';
import toNumber from 'lodash/toNumber';
import { ApiConnection } from './connection';
import { SalesforceApi } from './utils';

export class ApiApex extends SalesforceApi {
  constructor(connection: ApiConnection) {
    super(connection);
  }

  async anonymousApex({ apex, logLevel }: { apex: string; logLevel?: Maybe<string> }): Promise<AnonymousApexResponse> {
    logLevel = logLevel || 'FINEST';

    const header = {
      DebuggingHeader: {
        categories: [
          { category: 'Db', level: logLevel },
          { category: 'Workflow', level: logLevel },
          { category: 'Validation', level: logLevel },
          { category: 'Callout', level: logLevel },
          { category: 'Apex_code', level: logLevel },
          { category: 'Apex_profiling', level: logLevel },
          { category: 'Visualforce', level: logLevel },
          { category: 'System', level: logLevel },
          { category: 'All', level: logLevel },
        ],
      },
    };

    return this.apiRequest<{
      'ns1:Envelope': {
        Body: any;
        Header?: any;
      };
    }>({
      ...this.prepareSoapRequestOptions({
        type: 'APEX',
        body: {
          executeAnonymous: { String: apex },
        },
        header,
      }),
    }).then((soapResponse) => {
      // FIXME: if we fail here, we should return a proper error
      const header = soapResponse['ns1:Envelope']?.['Header'];
      const body = soapResponse['ns1:Envelope']?.['Body']?.executeAnonymousResponse?.result || {};
      const results: AnonymousApexResponse = {
        debugLog: header?.DebuggingInfo?.debugLog || '',
        result: {
          column: toNumber(getValueOrSoapNull(body.column) || -1),
          compileProblem: getValueOrSoapNull(body.compileProblem) || null,
          compiled: toBoolean(getValueOrSoapNull(body.compiled)) || false,
          exceptionMessage: getValueOrSoapNull(body.exceptionMessage) || null,
          exceptionStackTrace: getValueOrSoapNull(body.exceptionStackTrace) || null,
          line: toNumber(getValueOrSoapNull(body.line)) || -1,
          success: toBoolean(getValueOrSoapNull(body.success)) || false,
        },
      };
      if (typeof results.debugLog !== 'string') {
        results.debugLog = '';
      }
      results.debugLog = unSanitizeXml(results.debugLog);
      return results;
    });
  }

  async apexCompletions(type: string): Promise<ApexCompletionResponse> {
    return this.apiRequest<ApexCompletionResponse>({
      method: 'GET',
      url: this.getRestApiUrl(`/tooling/completions?type=${type}`),
      sessionInfo: this.sessionInfo,
    });
  }
}
