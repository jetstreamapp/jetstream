import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiConnection } from '../connection';
import { Logger } from '../types';

const NOOP_LOG = () => undefined;
const testLogger: Logger = { trace: NOOP_LOG, debug: NOOP_LOG, info: NOOP_LOG, warn: NOOP_LOG, error: NOOP_LOG };

const apiRequest = vi.fn();

function buildConnection() {
  return new ApiConnection({
    accessToken: 'test',
    apiRequestAdapter: (() => apiRequest) as never,
    apiVersion: '62.0',
    instanceUrl: 'https://test.my.salesforce.com',
    organizationId: '00D000000000001AAA',
    userId: '005000000000001AAA',
    callOptions: {},
    enableLogging: false,
    refreshToken: 'test',
    logger: testLogger,
  });
}

const DUPLICATE_RULE_HEADER = { 'Sforce-Duplicate-Rule-Header': 'allowSave=true' };

describe('ApiSObject.recordOperation duplicate rule bypass', () => {
  beforeEach(() => {
    apiRequest.mockReset();
    apiRequest.mockResolvedValue([{ id: '003000000000001AAA', success: true, errors: [] }]);
  });

  it.each([
    { operation: 'create' as const, records: [{ LastName: 'Test' }], externalId: undefined },
    { operation: 'update' as const, records: [{ Id: '003000000000001AAA', LastName: 'Test' }], externalId: undefined },
    { operation: 'upsert' as const, records: [{ External_Id__c: 'abc', LastName: 'Test' }], externalId: 'External_Id__c' },
  ])('sends the duplicate rule header on $operation when the bypass is requested', async ({ operation, records, externalId }) => {
    await buildConnection().sobject.recordOperation({ sobject: 'Contact', operation, records, externalId, bypassDuplicateRules: true });

    expect(apiRequest).toHaveBeenCalledWith(expect.objectContaining({ headers: DUPLICATE_RULE_HEADER }));
  });

  it('does not send the duplicate rule header unless the bypass is requested', async () => {
    await buildConnection().sobject.recordOperation({
      sobject: 'Contact',
      operation: 'update',
      records: [{ Id: '003000000000001AAA', LastName: 'Test' }],
    });

    expect(apiRequest).toHaveBeenCalledTimes(1);
    expect(apiRequest.mock.calls[0][0].headers).toBeUndefined();
  });

  it('does not send the duplicate rule header on a delete, which cannot create a duplicate', async () => {
    await buildConnection().sobject.recordOperation({
      sobject: 'Contact',
      operation: 'delete',
      ids: ['003000000000001AAA'],
      bypassDuplicateRules: true,
    });

    expect(apiRequest.mock.calls[0][0].headers).toBeUndefined();
  });
});
