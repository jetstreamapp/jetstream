import {
  CompositeResponse,
  DescribeGlobalResult,
  DescribeSObjectResult,
  Maybe,
  OperationReturnType,
  SalesforceRecord,
  SobjectOperation,
} from '@jetstream/types';
import { ApiConnection } from './connection';
import { SalesforceApi } from './utils';

export class ApiSObject extends SalesforceApi {
  constructor(connection: ApiConnection) {
    super(connection);
  }

  async describe(isTooling = false): Promise<DescribeGlobalResult> {
    const url = this.getRestApiUrl('/sobjects', isTooling);
    return this.apiRequest<DescribeGlobalResult>({ sessionInfo: this.sessionInfo, url });
  }

  async describeSobject(sobject: string, isTooling = false): Promise<DescribeSObjectResult> {
    const url = this.getRestApiUrl(`/sobjects/${sobject}/describe`, isTooling);
    return this.apiRequest<DescribeSObjectResult>({ sessionInfo: this.sessionInfo, url });
  }

  async recordOperation<O extends SobjectOperation>({
    sobject,
    operation,
    externalId,
    allOrNone = true,
    isTooling = false,
    ids,
    records,
  }: {
    sobject: string;
    operation: string;
    externalId?: Maybe<string>;
    allOrNone?: Maybe<boolean>;
    ids?: Maybe<string | string[]>;
    isTooling?: Maybe<boolean>;
    records: Maybe<any | any[]>;
  }): Promise<OperationReturnType<O>> {
    let operationPromise: Promise<OperationReturnType<O>> | undefined;

    if (ids) {
      ids = Array.isArray(ids) ? ids : [ids];
    }
    if (records) {
      records = Array.isArray(records) ? records : [records];
    }

    // POST https://MyDomainName.my.salesforce.com/services/data/v60.0/composite/sobjects/
    const BASE_URL = this.getRestApiUrl('/composite', isTooling);

    switch (operation) {
      case 'retrieve': {
        if (!Array.isArray(ids)) {
          throw new Error(`The ids property must be included`);
        }

        // Returns an array of records
        operationPromise = this.apiRequest<CompositeResponse<SalesforceRecord>>({
          method: 'POST',
          sessionInfo: this.sessionInfo,
          url: BASE_URL,
          body: {
            allOrNone,
            compositeRequest: ids
              .map((id) => this.getRestApiUrl(`/sobjects/${sobject}/${id}`, isTooling))
              .map((url, i) => ({ method: 'GET', url, referenceId: `${i}` })),
          },
        }).then((response) => {
          return response.compositeResponse.map((item) => item.body); //
        });

        break;
      }
      case 'create': {
        if (!Array.isArray(records)) {
          throw new Error(`The records property must be included`);
        }

        // FIXME: there was a case where "clone record" included a related field (Parent) and caused this to fail
        // Returns RecordResult[]
        operationPromise = this.apiRequest({
          method: 'POST',
          sessionInfo: this.sessionInfo,
          url: `${BASE_URL}/sobjects`, // VALIDATE URL
          body: {
            allOrNone,
            records: records.map((record) => ({ ...record, attributes: { type: sobject }, Id: undefined })),
          },
        });
        break;
      }
      case 'update': {
        if (!Array.isArray(records)) {
          throw new Error(`The records property must be included`);
        }

        // Returns RecordResult[]
        operationPromise = this.apiRequest({
          method: 'PATCH',
          sessionInfo: this.sessionInfo,
          url: `${BASE_URL}/sobjects`, // VALIDATE URL
          body: {
            allOrNone,
            records: records.map((record) => ({ ...record, attributes: { type: sobject }, Id: record.Id })),
          },
        });

        break;
      }
      case 'upsert': {
        if (!Array.isArray(records) || !externalId) {
          throw new Error(`The records and external id properties must be included`);
        }

        // Returns RecordResult[]
        operationPromise = this.apiRequest({
          method: 'PATCH',
          sessionInfo: this.sessionInfo,
          url: `${BASE_URL}/sobjects/${sobject}/${externalId}`,
          body: {
            allOrNone,
            records: records.map((record) => ({ ...record, attributes: { type: sobject } })),
          },
        });
        break;
      }
      case 'delete': {
        if (!Array.isArray(ids)) {
          throw new Error(`The ids property must be included`);
        }

        // Returns RecordResult[]
        operationPromise = this.apiRequest({
          method: 'DELETE',
          sessionInfo: this.sessionInfo,
          url: `${BASE_URL}/sobjects?ids=${ids.join(',')}`,
        });

        break;
      }
      default:
        throw new Error(`The operation ${operation} is not valid`);
    }

    if (!operationPromise) {
      throw new Error('operationPromise is undefined');
    }

    return await operationPromise.then((response) => {
      return response.map((item) => {
        // Some error responses are of some random type (e.x. invalid id in retrieve)
        // Convert to normalized error format
        // ex: [[{"errorCode": "NOT_FOUND", "message": "The requested resource does not exist"}]]
        if (Array.isArray(item) && item.length > 0 && 'errorCode' in item[0] && 'message' in item[0]) {
          return {
            errors: item.map((error) => ({
              fields: [],
              message: error.errorCode,
              statusCode: error.message,
            })),
            success: false,
          };
        }
        return item;
      });
    });
  }
}
