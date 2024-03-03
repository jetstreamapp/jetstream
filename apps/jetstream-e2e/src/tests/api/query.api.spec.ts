import { DescribeGlobalResult, DescribeSObjectResult, QueryResults } from '@jetstream/types';
import { expect, test } from '../../fixtures/fixtures';

test.describe.configure({ mode: 'parallel' });

test.describe('API - Query', () => {
  test('describe global', async ({ apiRequestUtils }) => {
    const [describeSuccess, describeToolingSuccess, invalidParam] = await Promise.all([
      apiRequestUtils.makeRequest<DescribeGlobalResult>('GET', `/api/describe`),
      apiRequestUtils.makeRequest<DescribeGlobalResult>('GET', `/api/describe?isTooling=true`),
      apiRequestUtils.makeRequestRaw('GET', `/api/describe?isTooling=invalid`),
    ]);

    expect(describeSuccess).toBeTruthy();
    expect(Array.isArray(describeSuccess.sobjects)).toBeTruthy();

    expect(describeToolingSuccess).toBeTruthy();
    expect(Array.isArray(describeToolingSuccess.sobjects)).toBeTruthy();

    // confirm that isTooling param is working
    expect(describeSuccess.sobjects.length).not.toEqual(describeToolingSuccess.sobjects.length);

    expect(invalidParam.ok()).toBeFalsy();
    const errorBody = await invalidParam.json();
    expect('error' in errorBody).toBeTruthy();
    expect('message' in errorBody).toBeTruthy();
    expect(errorBody.message.includes(`'isTooling' is Invalid enum value.`)).toBeTruthy();
  });

  test('describe sobject', async ({ apiRequestUtils }) => {
    const [describeSuccess, describeToolingSuccess, invalidObj, invalidParam] = await Promise.all([
      apiRequestUtils.makeRequest<DescribeSObjectResult>('GET', `/api/describe/Account`),
      apiRequestUtils.makeRequest<DescribeSObjectResult>('GET', `/api/describe/ApexClass?isTooling=true`),
      apiRequestUtils.makeRequestRaw('GET', `/api/describe/InvalidObj`),
      apiRequestUtils.makeRequestRaw('GET', `/api/describe/Account?isTooling=invalid`),
    ]);

    expect(describeSuccess).toBeTruthy();
    expect(describeSuccess.name).toEqual('Account');
    expect(Array.isArray(describeSuccess.fields)).toBeTruthy();

    expect(describeToolingSuccess).toBeTruthy();
    expect(describeToolingSuccess.name).toEqual('ApexClass');
    expect(Array.isArray(describeToolingSuccess.fields)).toBeTruthy();

    expect(invalidObj.ok()).toBeFalsy();
    const errorBody = await invalidObj.json();
    expect('error' in errorBody).toBeTruthy();
    expect('message' in errorBody).toBeTruthy();
    expect(errorBody.message).toEqual('The requested resource does not exist');

    expect(invalidParam.ok()).toBeFalsy();
  });

  test('query records', async ({ apiRequestUtils }) => {
    const [querySuccess, queryToolingSuccess, invalidObj, invalidParam] = await Promise.all([
      apiRequestUtils.makeRequest<QueryResults>(
        'POST',
        `/api/query?${new URLSearchParams({
          isTooling: 'false',
        }).toString()}`,
        { query: `SELECT Id, Name, AccountNumber, Description, Fax FROM Account WHERE (NOT Name LIKE '%abc%') LIMIT 1` }
      ),
      apiRequestUtils.makeRequest<QueryResults>(
        'POST',
        `/api/query?${new URLSearchParams({
          isTooling: 'true',
        }).toString()}`,
        { query: `SELECT Id, Name, FirstName, LastName, Username FROM User LIMIT 1` }
      ),
      apiRequestUtils.makeRequestRaw(
        'POST',
        `/api/query?${new URLSearchParams({
          isTooling: 'true',
        }).toString()}`,
        { query: `SELECT Id, Name, FirstName, LastName, Username FROM no_exist LIMIT 1` }
      ),
      apiRequestUtils.makeRequestRaw(
        'POST',
        `/api/query?${new URLSearchParams({
          isTooling: 'invalid',
        }).toString()}`,
        { query: `SELECT Id, Name, FirstName, LastName, Username FROM User LIMIT 1` }
      ),
    ]);

    console.log(querySuccess);

    expect(querySuccess).toBeTruthy();
    expect(querySuccess.parsedQuery).toBeTruthy();
    expect(querySuccess.parsedQuery?.fields?.length).toEqual(5);
    expect(querySuccess.parsedQuery?.where).toBeTruthy();
    expect(querySuccess.parsedQuery?.limit).toEqual(1);
    expect(Array.isArray(querySuccess.columns?.columns)).toBeTruthy();

    expect(queryToolingSuccess).toBeTruthy();
    expect(queryToolingSuccess.parsedQuery).toBeTruthy();
    expect(queryToolingSuccess.parsedQuery?.fields?.length).toEqual(5);
    expect(queryToolingSuccess.parsedQuery?.where).toBeFalsy();
    expect(queryToolingSuccess.parsedQuery?.limit).toEqual(1);
    expect(Array.isArray(queryToolingSuccess.columns?.columns)).toBeTruthy();

    expect(invalidObj.ok()).toBeFalsy();
    const response = await invalidObj.json();
    expect(response.error).toBeTruthy();
    expect(typeof response.message === 'string').toBeTruthy();
    expect(response.message.startsWith('\nFirstName, LastName')).toBeTruthy();
    expect(response.message.includes(`sObject type 'no_exist' is not supported.`)).toBeTruthy();

    expect(invalidParam.ok()).toBeFalsy();
  });

  test('query more records', async ({ apiRequestUtils }) => {
    const initialQuery = await apiRequestUtils.makeRequest<QueryResults>(
      'POST',
      `/api/query?${new URLSearchParams({
        isTooling: 'false',
      }).toString()}`,
      { query: `SELECT Id FROM Product2 LIMIT 2500` }
    );

    expect(initialQuery.queryResults.done).toBeFalsy();
    expect(initialQuery.queryResults.nextRecordsUrl).toBeTruthy();

    const queryMore = await apiRequestUtils.makeRequest<QueryResults>(
      'GET',
      `/api/query-more?${new URLSearchParams({
        isTooling: 'false',
        nextRecordsUrl: initialQuery.queryResults.nextRecordsUrl!,
      }).toString()}`
    );

    expect(queryMore.queryResults.done).toBeTruthy();
  });
});
