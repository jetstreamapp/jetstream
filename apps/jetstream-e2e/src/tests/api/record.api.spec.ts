import { ErrorResult, RecordResult, SalesforceRecord, SuccessResult } from '@jetstream/types';
import { expect, test } from '../../fixtures/fixtures';

test.describe.configure({ mode: 'parallel' });

test.describe('API - Record Controller', () => {
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
    const [leadFullRecord, leadFullRecordInvalid] = await apiRequestUtils.makeRequest<[SalesforceRecord, ErrorResult]>(
      'POST',
      `/api/record/retrieve/Lead?${new URLSearchParams({
        allOrNone: 'false',
      }).toString()}`,
      { ids: [lead.id, 'invalid'] }
    );
    const allInvalid = await apiRequestUtils.makeRequest<ErrorResult[]>(
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

    expect(leadFullRecordInvalid).toBeTruthy();
    expect(Array.isArray(leadFullRecordInvalid)).toBeFalsy();
    expect(leadFullRecordInvalid.success).toBeFalsy();
    expect(Array.isArray(leadFullRecordInvalid.errors)).toBeTruthy();
    expect(leadFullRecordInvalid.errors.length).toEqual(1);

    expect(Array.isArray(allInvalid)).toBeTruthy();
    expect(allInvalid.length).toEqual(2);
    expect(Array.isArray(allInvalid[0].errors)).toBeTruthy();
    expect(allInvalid[0].errors).toBeTruthy();
    expect(Array.isArray(allInvalid[1].errors)).toBeTruthy();
    expect(allInvalid[1].errors).toBeTruthy();

    expect(leadUpdated.success).toBeTruthy();

    expect(leadInvalid.success).toBeFalsy();

    expect(leadUpserted.success).toBeTruthy();
    expect(leadUpserted.id).toEqual(leadFullRecord.Id);
    expect(leadUpsertedInvalid.success).toBeFalsy();

    expect(deletedRecord.success).toBeTruthy();
    expect(deletedRecord.id).toEqual(leadFullRecord.Id);
    expect(deletedRecordInvalid.success).toBeFalsy();
  });

  test('Record Operation - Invalid URL', async ({ apiRequestUtils }) => {
    const [errorResponse] = await apiRequestUtils.makeRequest<[ErrorResult]>('POST', `/api/record/retrieve/Lead`, {
      ids: ['0038c00003RGJvSAAX'],
    });

    expect(errorResponse).toBeTruthy();
    expect(Array.isArray(errorResponse)).toBeFalsy();
    expect(errorResponse.success).toBeFalsy();
    expect(Array.isArray(errorResponse.errors)).toBeTruthy();
    expect(errorResponse.errors.length).toEqual(1);
  });
});
