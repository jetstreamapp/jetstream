import { ChildRelationship } from '@jetstream/types';
import * as XLSX from 'xlsx';
import { planLoadMultiObjectTemplate, prepareLoadMultiObjectTemplate } from '../load-multi-object-template.utils';
import { prepareExcelFile } from '../shared-ui-utils';

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

    expect(linked.map(({ relationshipPath }) => relationshipPath)).toEqual(['Contacts']);
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

describe('prepareLoadMultiObjectTemplate — nested subqueries', () => {
  const accountRecords = [
    {
      attributes: { type: 'Account' },
      Id: '001000000000001',
      Name: 'Acme',
      Contacts: getSubqueryResults([
        {
          attributes: { type: 'Contact' },
          Id: '003000000000001',
          LastName: 'Smith',
          Cases: getSubqueryResults([{ attributes: { type: 'Case' }, Id: '500000000000001', Subject: 'Broken widget' }]),
        },
      ]),
    },
  ];

  const options = {
    sobject: 'Account',
    fields: ['Id', 'Name', 'Contacts'],
    records: accountRecords,
    subqueryFields: { Contacts: ['Id', 'LastName', 'Cases'], 'Contacts.Cases': ['Id', 'Subject'] },
    childRelationships: [getChildRelationship('Contacts', 'Contact', 'AccountId')],
    childRelationshipsByPath: { Contacts: [getChildRelationship('Cases', 'Case', 'ContactId')] },
  };

  it('links a nested subquery to its own parent worksheet', () => {
    const output = prepareLoadMultiObjectTemplate(options);

    expect(Object.keys(output)).toEqual(['Account', 'Contacts', 'Contacts.Cases']);
    expect(output['Contacts.Cases']).toEqual([
      ['Object Api Name', 'Case'],
      ['Operation', 'Insert'],
      ['External Id (for upsert)', ''],
      [],
      ['Reference Id', '{ContactId}', 'Subject'],
      // The lookup points at the Contact's Reference Id, not the Account's
      ['500000000000001', '003000000000001', 'Broken widget'],
    ]);
  });

  it('reports the nested subquery as linked rather than skipped', () => {
    const plan = planLoadMultiObjectTemplate(options);

    expect(plan.skipped).toEqual([]);
    expect(plan.linked.map(({ relationshipPath }) => relationshipPath)).toEqual(['Contacts', 'Contacts.Cases']);
  });

  it('counts nested records in the group size, since they all load together', () => {
    // Account + 1 Contact + 1 Case
    expect(planLoadMultiObjectTemplate(options).largestGroupSize).toBe(3);
  });

  it('omits the nested relationship column from its parent worksheet even when every value is null', () => {
    const output = prepareLoadMultiObjectTemplate({
      ...options,
      records: [
        {
          attributes: { type: 'Account' },
          Id: '001000000000001',
          Name: 'Acme',
          // A contact with no cases - the column has no object value to be filtered out by type
          Contacts: getSubqueryResults([{ attributes: { type: 'Contact' }, Id: '003000000000001', LastName: 'Smith', Cases: null }]),
        },
      ],
    });

    expect(output['Contacts'][4]).toEqual(['Reference Id', '{AccountId}', 'LastName']);
    expect(Object.keys(output)).toEqual(['Account', 'Contacts']);
  });

  it('skips a nested subquery when its parent relationship could not be resolved', () => {
    const plan = planLoadMultiObjectTemplate({ ...options, childRelationshipsByPath: {} });

    expect(plan.skipped).toEqual(['Contacts.Cases']);
    expect(plan.linked.map(({ relationshipPath }) => relationshipPath)).toEqual(['Contacts']);
  });

  it('reports only the parent when a subquery is skipped, since its descendants have no separate cause', () => {
    const plan = planLoadMultiObjectTemplate({ ...options, childRelationships: [] });

    expect(plan.skipped).toEqual(['Contacts']);
    expect(plan.linked).toEqual([]);
  });
});

describe('prepareLoadMultiObjectTemplate — self-referential hierarchy', () => {
  // Account.ChildAccounts is self-referential, so every level is the same object and lookup field.
  // A query with no filter returns each account in the chain as a root record AND beneath every ancestor,
  // which is what produced duplicate Reference Ids across worksheets.
  function buildChain(ids: string[], depth: number): any {
    const [id, ...rest] = ids;
    return {
      attributes: { type: 'Account' },
      Id: id,
      Name: `Account ${id}`,
      ChildAccounts: rest.length && depth > 0 ? getSubqueryResults([buildChain(rest, depth - 1)]) : null,
    };
  }

  const chain = ['a', 'b', 'c', 'd'];
  // Each chain member is also returned as a root record, carrying its own descendants
  const records = chain.map((_, index) => buildChain(chain.slice(index), 3)).concat([buildChain(['solo'], 0)]);

  const childRelationship = getChildRelationship('ChildAccounts', 'Account', 'ParentId');
  const options = {
    sobject: 'Account',
    fields: ['Id', 'Name'],
    records,
    subqueryFields: {
      ChildAccounts: ['Id', 'Name'],
      'ChildAccounts.ChildAccounts': ['Id', 'Name'],
      'ChildAccounts.ChildAccounts.ChildAccounts': ['Id', 'Name'],
    },
    childRelationships: [childRelationship],
    childRelationshipsByPath: {
      ChildAccounts: [childRelationship],
      'ChildAccounts.ChildAccounts': [childRelationship],
    },
  };

  function getReferenceIds(output: Record<string, any[][]>): string[] {
    return Object.values(output).flatMap((rows) => rows.slice(5).map(([referenceId]) => referenceId));
  }

  it('emits every record exactly once, so no Reference Id repeats', () => {
    const referenceIds = getReferenceIds(prepareLoadMultiObjectTemplate(options));

    expect(referenceIds.sort()).toEqual(['a', 'b', 'c', 'd', 'solo']);
    expect(new Set(referenceIds).size).toBe(referenceIds.length);
  });

  it('keeps each record at the level that links it to its parent', () => {
    const output = prepareLoadMultiObjectTemplate(options);

    // Only the records with no parent in the results stay on the root worksheet
    expect(output['Account'].slice(5).map(([referenceId]) => referenceId)).toEqual(['a', 'solo']);
    // The rest link to their own parent from the shallowest worksheet that owns them
    expect(output['ChildAccounts'].slice(5)).toEqual([
      ['b', 'a', 'Account b'],
      ['c', 'b', 'Account c'],
      ['d', 'c', 'Account d'],
    ]);
  });

  it('drops the deeper worksheets that are left with nothing to emit', () => {
    expect(Object.keys(prepareLoadMultiObjectTemplate(options))).toEqual(['Account', 'ChildAccounts']);
  });

  it('sizes the group from the deduplicated records rather than every repeated position', () => {
    // a + b + c + d loads as one group; `solo` is a group of 1
    expect(planLoadMultiObjectTemplate(options).largestGroupSize).toBe(4);
  });
});

describe('prepareLoadMultiObjectTemplate — worksheet naming', () => {
  const rel = getChildRelationship('ChildAccounts', 'Account', 'ParentId');

  function buildDeepChain(depth: number): any {
    return {
      attributes: { type: 'Account' },
      Id: `a${depth}`,
      Name: `Account ${depth}`,
      ChildAccounts: depth > 0 ? getSubqueryResults([buildDeepChain(depth - 1)]) : null,
    };
  }

  it('names a long relationship path by its own relationship and depth instead of truncating the shared prefix', () => {
    const paths = [
      'ChildAccounts',
      'ChildAccounts.ChildAccounts',
      'ChildAccounts.ChildAccounts.ChildAccounts',
      'ChildAccounts.ChildAccounts.ChildAccounts.ChildAccounts',
    ];
    const output = prepareLoadMultiObjectTemplate({
      sobject: 'Account',
      fields: ['Id', 'Name'],
      // A single root record so nothing is de-duplicated away and every level keeps its worksheet
      records: [buildDeepChain(4)],
      subqueryFields: paths.reduce((acc: Record<string, string[]>, path) => ({ ...acc, [path]: ['Id', 'Name'] }), {}),
      childRelationships: [rel],
      childRelationshipsByPath: paths.reduce((acc: Record<string, any>, path) => ({ ...acc, [path]: [rel] }), {}),
    });

    expect(Object.keys(output)).toEqual([
      'Account',
      'ChildAccounts',
      'ChildAccounts.ChildAccounts',
      // These two used to collide into `ChildAccounts.ChildAccounts.Chi` and `...Ch4`
      'ChildAccounts (L3)',
      'ChildAccounts (L4)',
    ]);
    Object.keys(output).forEach((sheetName) => expect(sheetName.length).toBeLessThanOrEqual(31));
  });

  it('keeps the full relationship path when it fits inside the Excel limit', () => {
    const output = prepareLoadMultiObjectTemplate({
      sobject: 'Account',
      fields: ['Id', 'Name', 'Contacts'],
      records: [
        {
          Id: '001',
          Name: 'Acme',
          Contacts: getSubqueryResults([{ Id: '003', LastName: 'Smith', Cases: getSubqueryResults([{ Id: '500', Subject: 'Broken' }]) }]),
        },
      ],
      subqueryFields: { Contacts: ['Id', 'LastName'], 'Contacts.Cases': ['Id', 'Subject'] },
      childRelationships: [getChildRelationship('Contacts', 'Contact', 'AccountId')],
      childRelationshipsByPath: { Contacts: [getChildRelationship('Cases', 'Case', 'ContactId')] },
    });

    expect(Object.keys(output)).toEqual(['Account', 'Contacts', 'Contacts.Cases']);
  });
});
