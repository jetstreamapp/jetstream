import { ChildRelationship } from '@jetstream/types';
import * as XLSX from 'xlsx';
import { planLoadMultiObjectTemplate, prepareExcelFile, prepareLoadMultiObjectTemplate } from '../shared-ui-utils';

function getChildRelationship(relationshipName: string, childSObject: string, field: string): ChildRelationship {
  return {
    cascadeDelete: false,
    childSObject,
    deprecatedAndHidden: false,
    field,
    junctionIdListNames: [],
    junctionReferenceTo: [],
    relationshipName,
    restrictedDelete: false,
  };
}

function getSubqueryResults(records: any[]) {
  return { totalSize: records.length, done: true, records };
}

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

  describe('subquery records', () => {
    const accounts = [
      {
        Id: '001000000000001',
        Name: 'Acme',
        Contacts: getSubqueryResults([
          { attributes: { type: 'Contact' }, Id: '003000000000001', LastName: 'Smith' },
          { attributes: { type: 'Contact' }, Id: '003000000000002', LastName: 'Jones' },
        ]),
      },
      { Id: '001000000000002', Name: 'Globex', Contacts: null },
    ];

    it('creates a worksheet per subquery with the parent linked through the lookup field', () => {
      const output = prepareLoadMultiObjectTemplate({
        sobject: 'Account',
        fields: ['Id', 'Name', 'Contacts'],
        records: accounts,
        subqueryFields: { Contacts: ['Id', 'LastName'] },
        childRelationships: [getChildRelationship('Contacts', 'Contact', 'AccountId')],
      });

      expect(Object.keys(output)).toEqual(['Account', 'Contacts']);
      expect(output['Contacts']).toEqual([
        ['Object Api Name', 'Contact'],
        ['Operation', 'Insert'],
        ['External Id (for upsert)', ''],
        [],
        ['Reference Id', '{AccountId}', 'LastName'],
        ['003000000000001', '001000000000001', 'Smith'],
        ['003000000000002', '001000000000001', 'Jones'],
      ]);
      // The parent reference values must match the Reference Ids on the parent worksheet
      expect(output['Account'][5][0]).toEqual('001000000000001');
    });

    it('omits the subquery column from the parent worksheet even when no parent has child records', () => {
      const output = prepareLoadMultiObjectTemplate({
        sobject: 'Account',
        fields: ['Id', 'Name', 'Contacts'],
        records: [{ Id: '001000000000002', Name: 'Globex', Contacts: null }],
        subqueryFields: { Contacts: ['Id', 'LastName'] },
        childRelationships: [getChildRelationship('Contacts', 'Contact', 'AccountId')],
      });

      expect(Object.keys(output)).toEqual(['Account']);
      expect(output['Account'][4]).toEqual(['Reference Id', 'Name']);
    });

    it('does not emit the lookup field twice when it was included in the subquery', () => {
      const output = prepareLoadMultiObjectTemplate({
        sobject: 'Account',
        fields: ['Id', 'Contacts'],
        records: [
          {
            Id: '001000000000001',
            Contacts: getSubqueryResults([{ Id: '003000000000001', AccountId: '001000000000001', LastName: 'Smith' }]),
          },
        ],
        subqueryFields: { Contacts: ['Id', 'AccountId', 'LastName'] },
        childRelationships: [getChildRelationship('Contacts', 'Contact', 'AccountId')],
      });

      expect(output['Contacts'][4]).toEqual(['Reference Id', '{AccountId}', 'LastName']);
      expect(output['Contacts'][5]).toEqual(['003000000000001', '001000000000001', 'Smith']);
    });

    it('matches the relationship name regardless of the casing used in the query', () => {
      const output = prepareLoadMultiObjectTemplate({
        sobject: 'Account',
        fields: ['Id', 'contacts'],
        records: [{ Id: '001000000000001', Contacts: getSubqueryResults([{ Id: '003000000000001', LastName: 'Smith' }]) }],
        subqueryFields: { contacts: ['Id', 'LastName'] },
        childRelationships: [getChildRelationship('Contacts', 'Contact', 'AccountId')],
      });

      expect(output['contacts'][5]).toEqual(['003000000000001', '001000000000001', 'Smith']);
    });

    it('skips subqueries without a matching child relationship, since the linking field is unknown', () => {
      const output = prepareLoadMultiObjectTemplate({
        sobject: 'Account',
        fields: ['Id', 'Name', 'Contacts'],
        records: accounts,
        subqueryFields: { Contacts: ['Id', 'LastName'] },
        childRelationships: [getChildRelationship('Opportunities', 'Opportunity', 'AccountId')],
      });

      expect(Object.keys(output)).toEqual(['Account']);
      expect(output['Account'][4]).toEqual(['Reference Id', 'Name']);
    });

    it('excludes subqueries entirely when no child relationships are provided', () => {
      const output = prepareLoadMultiObjectTemplate({
        sobject: 'Account',
        fields: ['Id', 'Name', 'Contacts'],
        records: accounts,
        subqueryFields: { Contacts: ['Id', 'LastName'] },
      });

      expect(Object.keys(output)).toEqual(['Account']);
    });

    it('keeps child worksheet names unique when a relationship name collides with the object worksheet', () => {
      const output = prepareLoadMultiObjectTemplate({
        sobject: 'Widget__c',
        fields: ['Id', 'Widget__c'],
        records: [{ Id: 'a01000000000001', Widget__c: getSubqueryResults([{ Id: 'a01000000000002' }]) }],
        subqueryFields: { Widget__c: ['Id'] },
        childRelationships: [getChildRelationship('Widget__c', 'Widget__c', 'Parent__c')],
      });

      expect(Object.keys(output)).toEqual(['Widget__c', 'Widget__c1']);
    });
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

describe('planLoadMultiObjectTemplate', () => {
  const accountWithContacts = {
    Id: '001000000000001',
    Name: 'Acme',
    Contacts: getSubqueryResults([{ Id: '003000000000001' }, { Id: '003000000000002' }]),
  };

  it('reports the worksheets that will be created, and the subqueries that cannot be linked', () => {
    const { linked, skipped } = planLoadMultiObjectTemplate({
      sobject: 'Account',
      fields: ['Id', 'Name', 'Contacts', 'Opportunities'],
      records: [accountWithContacts],
      subqueryFields: { Contacts: ['Id'], Opportunities: ['Id'] },
      childRelationships: [getChildRelationship('Contacts', 'Contact', 'AccountId')],
    });

    expect(linked.map(({ relationshipName }) => relationshipName)).toEqual(['Contacts']);
    expect(skipped).toEqual(['Opportunities']);
  });

  it('sizes the largest group as one parent plus everything it brings with it', () => {
    const { largestGroupSize } = planLoadMultiObjectTemplate({
      sobject: 'Account',
      fields: ['Id', 'Contacts'],
      records: [accountWithContacts, { Id: '001000000000002', Contacts: null }],
      subqueryFields: { Contacts: ['Id'] },
      childRelationships: [getChildRelationship('Contacts', 'Contact', 'AccountId')],
    });

    expect(largestGroupSize).toBe(3);
  });

  it('names every worksheet whose query omits Id, since those records have no Reference Id', () => {
    const { missingReferenceId } = planLoadMultiObjectTemplate({
      sobject: 'Account',
      fields: ['Name', 'Contacts'],
      records: [accountWithContacts],
      subqueryFields: { Contacts: ['LastName'] },
      childRelationships: [getChildRelationship('Contacts', 'Contact', 'AccountId')],
    });

    expect(missingReferenceId).toEqual(['Account', 'Contacts']);
  });

  it('does not report a missing Reference Id when Id is selected on both levels', () => {
    const { missingReferenceId } = planLoadMultiObjectTemplate({
      sobject: 'Account',
      fields: ['Id', 'Contacts'],
      records: [accountWithContacts],
      subqueryFields: { Contacts: ['Id'] },
      childRelationships: [getChildRelationship('Contacts', 'Contact', 'AccountId')],
    });

    expect(missingReferenceId).toEqual([]);
  });
});
