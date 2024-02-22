import { RecordResult, SalesforceRecord, SuccessResult } from '@jetstream/types';
import { ErrorResult } from 'jsforce';
import { expect, test } from '../../fixtures/fixtures';

test.describe.configure({ mode: 'parallel' });

test.describe('API - Misc', () => {
  // TODO: /sfdc/login
  // test('frontdoor login', async ({ apiRequestUtils }) => {
  //   const [describeSuccess, describeToolingSuccess, invalidParam] = await Promise.all([
  //     apiRequestUtils.makeRequest<DescribeGlobalResult>('GET', `/api/describe`),
  //   ]);

  //   expect(describeSuccess).toBeTruthy();
  //   expect(Array.isArray(describeSuccess.sobjects)).toBeTruthy();
  // });

  // TODO:
  // test('Stream file download', async ({ apiRequestUtils }) => {
  //   const [describeSuccess, describeToolingSuccess, invalidParam] = await Promise.all([
  //     apiRequestUtils.makeRequest<DescribeGlobalResult>('GET', `/api/describe`),
  //   ]);

  //   expect(describeSuccess).toBeTruthy();
  //   expect(Array.isArray(describeSuccess.sobjects)).toBeTruthy();
  // });

  // TODO:
  // test('Request', async ({ apiRequestUtils }) => {
  //   const account = apiRequestUtils.makeRequest('POST', '/api/request', {
  //     url: '',
  //     method: 'POST',
  //     isTooling: false,
  //     headers: {},
  //     options: {},
  //   });

  //   expect(describeSuccess).toBeTruthy();
  //   expect(Array.isArray(describeSuccess.sobjects)).toBeTruthy();
  // });

  // TODO:
  // test('Request Manual', async ({ apiRequestUtils }) => {
  //   // FIXME: how can I set the version dynamically?
  //   const account = apiRequestUtils.makeRequest('POST', '/api/request', {
  //     // TODO:
  //   });

  //   expect(describeSuccess).toBeTruthy();
  //   expect(Array.isArray(describeSuccess.sobjects)).toBeTruthy();
  // });

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
