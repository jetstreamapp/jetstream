import { CompositeResponse, DescribeGlobalResult, DescribeSObjectResult, Maybe } from '@jetstream/types';
import { ApiConnection } from './connection';
import { SalesforceApi } from './utils';

export class ApiSObject extends SalesforceApi {
  constructor(connection: ApiConnection) {
    super(connection);
  }

  async describe(isTooling = false): Promise<DescribeGlobalResult> {
    const url = isTooling ? `/tooling/sobjects` : `/sobjects`;
    return this.apiRequest<DescribeGlobalResult>({ sessionInfo: this.sessionInfo, url });
  }

  async describeSobject(sobject: string, isTooling = false): Promise<DescribeSObjectResult> {
    const url = isTooling ? `/tooling/sobjects/${sobject}/describe` : `/sobjects/${sobject}/describe`;
    return this.apiRequest<DescribeSObjectResult>({ sessionInfo: this.sessionInfo, url });
  }

  async recordOperation({
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
  }) {
    let operationPromise: Promise<unknown> | undefined;

    if (ids) {
      ids = Array.isArray(ids) ? ids : [ids];
    }
    if (records) {
      records = Array.isArray(records) ? records : [records];
    }

    // POST https://MyDomainName.my.salesforce.com/services/data/v60.0/composite/sobjects/

    switch (operation) {
      case 'retrieve': {
        if (!Array.isArray(ids)) {
          throw new Error(`The ids property must be included`);
        }

        operationPromise = this.apiRequest<CompositeResponse>({
          method: 'POST',
          sessionInfo: this.sessionInfo,
          url: `/composite`,
          body: {
            allOrNone,
            compositeRequest: ids
              .map((id) => (isTooling ? `/tooling/sobjects/${sobject}/${id}` : `/sobjects/${sobject}/${id}`))
              .map((url, i) => ({ method: 'GET', url: url, referenceId: `${i}` })),
          },
        }).then((response) => response.compositeResponse.map((item) => item.body));

        break;
      }
      case 'create': {
        if (!Array.isArray(records)) {
          throw new Error(`The records property must be included`);
        }

        operationPromise = this.apiRequest({
          method: 'POST',
          sessionInfo: this.sessionInfo,
          url: isTooling ? `/tooling/composite/sobjects` : `/composite/sobjects`,
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

        operationPromise = this.apiRequest({
          method: 'PATCH',
          sessionInfo: this.sessionInfo,
          url: isTooling ? `/tooling/composite/sobjects` : `/composite/sobjects`,
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
        operationPromise = this.apiRequest({
          method: 'PATCH',
          sessionInfo: this.sessionInfo,
          url: isTooling ? `/tooling/composite/sobjects/${sobject}/${externalId}` : `/composite/sobjects/${sobject}/${externalId}`,
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

        operationPromise = this.apiRequest({
          method: 'DELETE',
          sessionInfo: this.sessionInfo,
          url: isTooling ? `/tooling/composite/sobjects?ids=${ids.join(',')}` : `/composite/sobjects?ids=${ids.join(',')}`,
        });

        break;
      }
      default:
        throw new Error(`The operation ${operation} is not valid`);
    }

    if (!operationPromise) {
      throw new Error('operationPromise is undefined');
    }

    const data = await operationPromise;
    return { data };
  }
}
