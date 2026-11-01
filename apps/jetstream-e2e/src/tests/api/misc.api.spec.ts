import { CompositeResponse, ManualRequestResponse } from '@jetstream/types';
import { expect, test } from '../../fixtures/fixtures';

test.describe.configure({ mode: 'parallel' });

test.describe('API - Misc', () => {
  test.beforeEach(async ({ apiRequestUtils }) => {
    await apiRequestUtils.selectDefaultOrg();
  });

  test('Stream file download', async ({ apiRequestUtils }) => {
    const file = await apiRequestUtils.makeRequestRaw(
      'GET',
      `/api/file/stream-download?${new URLSearchParams({
        url: '/services/data/v60.0/sobjects/ContentVersion/068Dn00000BSXTsIAP/VersionData',
      }).toString()}`,
    );

    expect(file).toBeTruthy();
    // The record may not exist in the test org, but a blob field path must at least pass validation
    expect(file.status()).not.toBe(400);
  });

  test('Stream file download refuses paths that are not a record blob field', async ({ apiRequestUtils }) => {
    const response = await apiRequestUtils.makeRequestRaw(
      'GET',
      `/api/file/stream-download?${new URLSearchParams({
        url: '/services/data/v60.0/tooling/executeAnonymous/?anonymousBody=System.debug(1)',
      }).toString()}`,
    );

    expect(response.status()).toBe(400);
  });

  test('Org id is not accepted from the query string on API routes', async ({ apiRequestUtils }) => {
    const response = await apiRequestUtils.makeRequestRaw(
      'GET',
      `/api/describe?${new URLSearchParams({ 'X-SFDC-ID': apiRequestUtils.selectedOrgId }).toString()}`,
      undefined,
      { 'X-SFDC-ID': '' },
    );

    expect(response.status()).toBe(400);
  });

  test('Request - POST', async ({ apiRequestUtils }) => {
    const response = await apiRequestUtils.makeRequest<CompositeResponse>('POST', '/api/request', {
      isTooling: true,
      method: 'POST',
      url: '/services/data/v60.0/tooling/composite',
      body: {
        allOrNone: false,
        compositeRequest: [
          {
            method: 'PATCH',
            url: '/services/data/v60.0/tooling/sobjects/CustomField/00NDn00001454Pe',
            body: {
              FullName: 'Account.CustomField__c',
              Metadata: { type: 'Text', label: 'CustomField', length: '255', required: false, unique: false, externalId: false },
            },
            referenceId: 'Account_CustomField_c',
          },
        ],
      },
    });

    expect(response.compositeResponse.length).toEqual(1);
    expect(response.compositeResponse[0].httpStatusCode).toEqual(204);
    expect(response.compositeResponse[0].referenceId).toEqual('Account_CustomField_c');
  });

  test('Request - Error', async ({ apiRequestUtils }) => {
    const response = await apiRequestUtils.makeRequest<ManualRequestResponse>('POST', '/api/request-manual', {
      method: 'GET',
      url: '/services/data/v60.0/fake',
    });

    expect(response.status === 500).toBeTruthy();
    expect(response.headers).toBeTruthy();
    expect(response.error).toBeTruthy();
    expect(response.statusText).toContain('Server Error');

    const body = JSON.parse(response.body as string) as {
      message: "This is a fake resource, you shouldn't even be seeing this";
      errorCode: 'UNKNOWN_EXCEPTION';
    }[];

    expect(Array.isArray(body)).toBeTruthy();
    expect(body[0].errorCode).toEqual('UNKNOWN_EXCEPTION');
  });

  test('Request Manual - GET', async ({ apiRequestUtils }) => {
    const response = await apiRequestUtils.makeRequest<ManualRequestResponse>('POST', '/api/request-manual', {
      method: 'GET',
      url: '/services/data',
    });

    expect(response.status === 200).toBeTruthy();
    expect(response.headers).toBeTruthy();
    expect(response.error).toBeFalsy();
    expect(response.statusText).toEqual('OK');

    const body = JSON.parse(response.body as string) as {
      label: string;
      url: string;
      version: string;
    }[];

    expect(Array.isArray(body)).toBeTruthy();
  });

  test('Request Manual - Error', async ({ apiRequestUtils }) => {
    const response = await apiRequestUtils.makeRequest<ManualRequestResponse>('POST', '/api/request-manual', {
      method: 'GET',
      url: '/services/data/v60.0/fake',
    });

    expect(response.status === 500).toBeTruthy();
    expect(response.headers).toBeTruthy();
    expect(response.error).toBeTruthy();
    expect(response.statusText).toContain('Server Error');

    const body = JSON.parse(response.body as string) as {
      message: "This is a fake resource, you shouldn't even be seeing this";
      errorCode: 'UNKNOWN_EXCEPTION';
    }[];

    expect(Array.isArray(body)).toBeTruthy();
    expect(body[0].errorCode).toEqual('UNKNOWN_EXCEPTION');
  });
});
