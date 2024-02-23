import { CompositeResponse, ManualRequestResponse, RecordResult, SalesforceRecord, SuccessResult } from '@jetstream/types';
import { ErrorResult } from 'jsforce';
import { expect, test } from '../../fixtures/fixtures';

test.describe.configure({ mode: 'parallel' });

test.describe('API - Misc', () => {
  test('Stream file download', async ({ apiRequestUtils }) => {
    const file = await apiRequestUtils.makeRequestRaw(
      'GET',
      `/api/file/stream-download?${new URLSearchParams({
        url: '/services/data/v60.0/sobjects/ContentVersion/068Dn00000BSXTsIAP/VersionData&X-SFDC-ID=00DDn000006Cfm2MAC-005Dn000003DuJgIAK',
      }).toString()}`
    );

    expect(file).toBeTruthy();
    file;
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
    expect(response.statusText).toEqual('Server Error');

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
    expect(response.statusText).toEqual('Server Error');

    const body = JSON.parse(response.body as string) as {
      message: "This is a fake resource, you shouldn't even be seeing this";
      errorCode: 'UNKNOWN_EXCEPTION';
    }[];

    expect(Array.isArray(body)).toBeTruthy();
    expect(body[0].errorCode).toEqual('UNKNOWN_EXCEPTION');
  });

  test('Record Operation', async ({ apiRequestUtils }) => {
    const [lead, leadInvalid] = await apiRequestUtils.makeRequest<[SuccessResult, ErrorResult]>(
      'POST',
      `/api/record/create/Lead?${new URLSearchParams({
        allOrNone: 'false',
      }).toString()}`,
      {
        records: [
          {
            LastName: `Luce`,
            FirstName: `Eugena - ${Math.random() * 100}`,
            Title: 'CEO',
            Company: `Pacific Retail Group - ${Math.random() * 100}`,
            State: 'MA',
            Country: 'USA',
            Email: `eluce@pacificretail.${Math.random() * 100}.com`,
            LeadSource: 'Purchased List',
            Status: 'Open - Not Contacted',
          },
          {
            InvalidField: 'true',
          },
        ],
      }
    );
    const [leadFullRecord, leadFullRecordInvalid] = await apiRequestUtils.makeRequest<[SalesforceRecord, ErrorResult['errors']]>(
      'POST',
      `/api/record/retrieve/Lead?${new URLSearchParams({
        allOrNone: 'false',
      }).toString()}`,
      { ids: [lead.id, 'invalid'] }
    );
    const allInvalid = await apiRequestUtils.makeRequest<ErrorResult['errors'][]>(
      'POST',
      `/api/record/retrieve/Lead?${new URLSearchParams({
        allOrNone: 'true',
      }).toString()}`,
      { ids: [lead.id, 'invalid'] }
    );
    const [leadUpdated] = await apiRequestUtils.makeRequest<RecordResult[]>(
      'POST',
      `/api/record/update/Lead?${new URLSearchParams({
        allOrNone: 'false',
      }).toString()}`,
      {
        records: [{ AnnualRevenue: 12323, attributes: { type: 'Lead' }, Id: lead.id }],
      }
    );
    const [leadUpserted, leadUpsertedInvalid] = await apiRequestUtils.makeRequest<[SuccessResult, ErrorResult]>(
      'POST',
      `/api/record/upsert/Lead?${new URLSearchParams({
        externalId: 'Id',
        allOrNone: 'false',
      }).toString()}`,
      {
        records: [
          { attributes: { type: 'Lead' }, Id: lead.id },
          { attributes: { type: 'Lead' }, Id: '001Dn000003QlaaMAZ' },
        ],
      }
    );
    const [deletedRecord, deletedRecordInvalid] = await apiRequestUtils.makeRequest<[SuccessResult, ErrorResult]>(
      'POST',
      `/api/record/delete/Lead?${new URLSearchParams({
        allOrNone: 'false',
      }).toString()}`,
      {
        ids: [lead.id, 'invalid'],
      }
    );

    expect(lead).toBeTruthy();
    expect(lead.success).toBeTruthy();
    expect(lead.id).toBeTruthy();

    expect(leadFullRecord.Id).toEqual(lead.id);
    expect(Array.isArray(leadFullRecordInvalid)).toBeTruthy();
    expect(leadFullRecordInvalid.length).toBeTruthy();

    expect(Array.isArray(allInvalid)).toBeTruthy();
    expect(allInvalid.length).toEqual(2);
    expect(Array.isArray(allInvalid[0])).toBeTruthy();
    expect(allInvalid[0].length).toBeTruthy();
    expect(Array.isArray(allInvalid[1])).toBeTruthy();
    expect(allInvalid[1].length).toBeTruthy();

    expect(leadUpdated.success).toBeTruthy();

    expect(leadInvalid.success).toBeFalsy();

    expect(leadUpserted.success).toBeTruthy();
    expect(leadUpserted.id).toEqual(leadFullRecord.Id);
    expect(leadUpsertedInvalid.success).toBeFalsy();

    expect(deletedRecord.success).toBeTruthy();
    expect(deletedRecord.id).toEqual(leadFullRecord.Id);
    expect(deletedRecordInvalid.success).toBeFalsy();
  });
});
