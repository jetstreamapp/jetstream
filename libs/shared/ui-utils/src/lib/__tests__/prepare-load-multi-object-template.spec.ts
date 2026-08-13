import * as XLSX from 'xlsx';
import { prepareExcelFile, prepareLoadMultiObjectTemplate } from '../shared-ui-utils';

describe('prepareLoadMultiObjectTemplate', () => {
  it('produces the exact Load Records to Multiple Objects template layout', () => {
    const output = prepareLoadMultiObjectTemplate({
      sobject: 'Account',
      fields: ['Id', 'Name', 'AnnualRevenue', 'IsDeleted'],
      records: [
        { attributes: { type: 'Account' }, Id: '001000000000001', Name: 'Acme', AnnualRevenue: 1234.5, IsDeleted: false },
        { attributes: { type: 'Account' }, Id: '001000000000002', Name: 'Globex', AnnualRevenue: null, IsDeleted: true },
      ],
    });

    expect(output).toEqual({
      Account: [
        ['Object Api Name', 'Account'],
        ['Operation', 'Insert'],
        ['External Id (for upsert)', ''],
        [],
        ['Reference Id', 'Name', 'AnnualRevenue', 'IsDeleted'],
        ['001000000000001', 'Acme', 1234.5, false],
        ['001000000000002', 'Globex', '', true],
      ],
    });
  });

  it('uses each record Id as the Reference Id and emits an empty string when Id is missing', () => {
    const output = prepareLoadMultiObjectTemplate({
      sobject: 'Contact',
      fields: ['Id', 'LastName'],
      records: [{ Id: '003000000000001', LastName: 'Smith' }, { LastName: 'Jones' }],
    });

    const rows = output['Contact'];
    expect(rows[5]).toEqual(['003000000000001', 'Smith']);
    expect(rows[6]).toEqual(['', 'Jones']);
  });

  it('excludes Id, relationship (dot path), subquery, and object-valued fields from the columns', () => {
    const output = prepareLoadMultiObjectTemplate({
      sobject: 'Account',
      fields: ['Id', 'Name', 'Owner.Name', 'Contacts', 'BillingAddress'],
      records: [
        {
          Id: '001000000000001',
          Name: 'Acme',
          'Owner.Name': 'Some Owner',
          Contacts: { totalSize: 1, done: true, records: [{ Id: '003000000000001' }] },
          BillingAddress: { city: 'Austin', state: 'TX' },
        },
        // A record where the object-valued fields are null must not re-include those columns
        { Id: '001000000000002', Name: 'Globex', 'Owner.Name': null, Contacts: null, BillingAddress: null },
      ],
    });

    const rows = output['Account'];
    expect(rows[4]).toEqual(['Reference Id', 'Name']);
    expect(rows[5]).toEqual(['001000000000001', 'Acme']);
    expect(rows[6]).toEqual(['001000000000002', 'Globex']);
  });

  it('emits values raw except null/undefined becoming empty strings', () => {
    const output = prepareLoadMultiObjectTemplate({
      sobject: 'Opportunity',
      fields: ['Id', 'Name', 'Amount', 'IsClosed', 'CloseDate', 'NextStep'],
      records: [{ Id: '006000000000001', Name: 'Big Deal', Amount: 0, IsClosed: false, CloseDate: '2026-01-31', NextStep: undefined }],
    });

    expect(output['Opportunity'][5]).toEqual(['006000000000001', 'Big Deal', 0, false, '2026-01-31', '']);
  });

  it('sanitizes the sheet name by stripping forbidden characters and truncating to 31 characters', () => {
    const forbiddenChars = prepareLoadMultiObjectTemplate({ sobject: 'Bad:Name/With[Chars]?*\\', fields: ['Id'], records: [] });
    expect(Object.keys(forbiddenChars)).toEqual(['BadNameWithChars']);

    const longName = prepareLoadMultiObjectTemplate({
      sobject: 'A_Very_Long_Custom_Object_Api_Name__c',
      fields: ['Id'],
      records: [],
    });
    expect(Object.keys(longName)).toEqual(['A_Very_Long_Custom_Object_Api_N']);
  });

  it('round-trips through prepareExcelFile as an array-of-array sheet', () => {
    const output = prepareLoadMultiObjectTemplate({
      sobject: 'Account',
      fields: ['Id', 'Name'],
      records: [{ Id: '001000000000001', Name: 'Acme' }],
    });

    const fileData = prepareExcelFile(output, undefined, undefined);
    const workbook = XLSX.read(fileData, { type: 'array' });
    expect(workbook.SheetNames).toEqual(['Account']);

    const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets['Account'], { header: 1 });
    expect(rows[0]).toEqual(['Object Api Name', 'Account']);
    expect(rows[1]).toEqual(['Operation', 'Insert']);
    expect(rows[2]).toEqual(['External Id (for upsert)', '']);
    expect(rows[4]).toEqual(['Reference Id', 'Name']);
    expect(rows[5]).toEqual(['001000000000001', 'Acme']);
  });
});
