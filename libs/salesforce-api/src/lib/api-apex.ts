import { getValueOrSoapNull, unSanitizeXml } from '@jetstream/shared/utils';
import { AnonymousApexResponse, ApexCompletionResponse, Maybe } from '@jetstream/types';
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
      Envelope: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        Body: Record<string, any>;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        Header?: Record<string, any>;
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
      const header = soapResponse.Envelope?.Header;
      const body = soapResponse.Envelope?.Body?.executeAnonymousResponse?.result || {};
      const results: AnonymousApexResponse = {
        debugLog: header?.DebuggingInfo?.debugLog || '',
        result: {
          column: (getValueOrSoapNull(body.column) as number) || -1,
          compileProblem: (getValueOrSoapNull(body.compileProblem) as string) || null,
          compiled: (getValueOrSoapNull(body.compiled) as boolean) || false,
          exceptionMessage: (getValueOrSoapNull(body.exceptionMessage) as string) || null,
          exceptionStackTrace: (getValueOrSoapNull(body.exceptionStackTrace) as string) || null,
          line: (getValueOrSoapNull(body.line) as number) || -1,
          success: (getValueOrSoapNull(body.success) as boolean) || false,
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
