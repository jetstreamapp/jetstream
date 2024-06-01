import {
  composeSoqlQueryCustomWhereClause,
  composeSoqlQueryOptionalCustomWhereClause,
  getFieldsToQuery,
  isValidRow,
  prepareRecords,
} from '../mass-update-records.utils';

describe('mass-update-records.utils#isValidRow', () => {
  test('Should return true if all are valid', () => {
    expect(
      isValidRow({
        configuration: [
          {
            selectedField: 'Name',
            transformationOptions: { option: 'anotherField', alternateField: 'Id' },
          },
          {
            selectedField: 'Name',
            transformationOptions: { option: 'staticValue', staticValue: 'Jenny Jenny' },
          },
          {
            selectedField: 'Name',
            criteria: 'custom',
            transformationOptions: { whereClause: `Id IN ('1', '2')` },
          },
        ],
      } as any)
    ).toBe(true);
  });

  test('Should return false if any are invalid', () => {
    expect(
      isValidRow({
        configuration: [
          {
            selectedField: 'Name',
            transformationOptions: { option: 'anotherField', alternateField: 'Id' },
          },
          {
            selectedField: 'Name',
            transformationOptions: { option: 'staticValue', staticValue: 'Jenny Jenny' },
          },
          {
            // invalid where clause
            criteria: 'custom',
            transformationOptions: { whereClause: '' },
          },
        ],
      } as any)
    ).toBe(false);
  });

  test('Should return false if no configuration', () => {
    expect(isValidRow({ configuration: null } as any)).toBe(false);
    expect(isValidRow({ configuration: [] } as any)).toBe(false);
  });

  test('Should return false if invalid configuration', () => {
    expect(isValidRow({ configuration: [{ selectedField: '' }] } as any)).toBe(false);
    expect(
      isValidRow({
        configuration: [
          {
            selectedField: 'Name',
            transformationOptions: { option: 'anotherField', alternateField: '' },
          },
        ],
      } as any)
    ).toBe(false);
    expect(
      isValidRow({
        configuration: [
          {
            selectedField: 'Name',
            transformationOptions: { option: 'staticValue', staticValue: '' },
          },
        ],
      } as any)
    ).toBe(false);
    expect(
      isValidRow({
        configuration: [
          {
            criteria: 'custom',
            transformationOptions: { whereClause: '' },
          },
        ],
      } as any)
    ).toBe(false);
    expect(
      isValidRow({
        configuration: [
          {
            criteria: 'custom',
            transformationOptions: { whereClause: 'Invalid Where Clause!' },
          },
        ],
      } as any)
    ).toBe(false);
  });
});

describe('mass-update-records.utils#getFieldsToQuery', () => {
  test('Should return fields from configuration', () => {
    const fields = getFieldsToQuery([
      {
        selectedField: 'FirstName',
        transformationOptions: {
          criteria: 'all',
          option: 'staticValue',
          staticValue: 'Jenny Jenny',
          alternateField: null,
          whereClause: '',
        },
      },
      {
        selectedField: 'LastName',
        transformationOptions: {
          criteria: 'onlyIfBlank',
          option: 'staticValue',
          staticValue: 'Jenny Jenny',
          alternateField: null,
          whereClause: '',
        },
      },
      {
        selectedField: 'Type',
        transformationOptions: {
          criteria: 'onlyIfNotBlank',
          option: 'anotherField',
          staticValue: '',
          alternateField: 'Id',
          whereClause: '',
        },
      },
      {
        selectedField: 'Fax',
        transformationOptions: {
          criteria: 'custom',
          option: 'anotherField',
          staticValue: '',
          alternateField: 'Fax',
          whereClause: `Id = '12345'`,
        },
      },
    ]);

    expect(fields).toEqual(['Id', 'FirstName', 'LastName', 'Type', 'Fax']);
  });
});

describe('mass-update-records.utils#composeSoqlQueryOptionalCustomWhereClause', () => {
  it('Should remove where clause if any have "all" criteria', () => {
    const soql = composeSoqlQueryOptionalCustomWhereClause(
      {
        sobject: 'Contact',
        configuration: [
          {
            selectedField: 'FirstName',
            transformationOptions: {
              criteria: 'all',
              option: 'staticValue',
              staticValue: 'Jenny Jenny',
              alternateField: null,
              whereClause: '',
            },
          },
          {
            selectedField: 'LastName',
            transformationOptions: {
              criteria: 'onlyIfBlank',
              option: 'staticValue',
              staticValue: 'Jenny Jenny',
              alternateField: null,
              whereClause: '',
            },
          },
          {
            selectedField: 'Type',
            transformationOptions: {
              criteria: 'onlyIfNotBlank',
              option: 'staticValue',
              staticValue: 'Jenny Jenny',
              alternateField: null,
              whereClause: '',
            },
          },
          {
            selectedField: 'Fax',
            transformationOptions: {
              criteria: 'custom',
              option: 'anotherField',
              staticValue: '',
              alternateField: 'Fax',
              whereClause: `Id = '12345'`,
            },
          },
        ],
      } as any,
      ['Id', 'FirstName', 'LastName', 'Type', 'Fax']
    );

    expect(soql).toBe(`SELECT Id, FirstName, LastName, Type, Fax FROM Contact`);
  });
  it('Should return a query with proper where clauses', () => {
    const config = {
      sobject: 'Contact',
      configuration: [
        {
          selectedField: 'FirstName',
          transformationOptions: {
            criteria: 'onlyIfBlank',
            option: 'staticValue',
            staticValue: 'Jenny Jenny',
            alternateField: null,
            whereClause: '',
          },
        },
        {
          selectedField: 'LastName',
          transformationOptions: {
            criteria: 'onlyIfNotBlank',
            option: 'staticValue',
            staticValue: 'Jenny Jenny',
            alternateField: null,
            whereClause: '',
          },
        },
        {
          selectedField: 'Fax',
          transformationOptions: {
            criteria: 'custom',
            option: 'anotherField',
            staticValue: '',
            alternateField: 'Fax',
            whereClause: `Id = '12345'`,
          },
        },
      ],
    } as any;
    let soql = composeSoqlQueryOptionalCustomWhereClause(config, ['Id', 'FirstName', 'LastName', 'Fax']);

    expect(soql).toBe(`SELECT Id, FirstName, LastName, Fax FROM Contact WHERE (FirstName = NULL) OR (LastName != NULL)`);

    soql = composeSoqlQueryOptionalCustomWhereClause(config, ['Count()'], true);
    expect(soql).toBe(`SELECT Count() FROM Contact WHERE (FirstName = NULL) OR (LastName != NULL) OR (Id = '12345')`);
  });

  it('Should return null if no records should be processed', () => {
    const soql = composeSoqlQueryOptionalCustomWhereClause(
      {
        sobject: 'Account',
        configuration: [
          {
            selectedField: 'Fax',
            transformationOptions: {
              criteria: 'custom',
              option: 'anotherField',
              staticValue: '',
              alternateField: 'Fax',
              whereClause: `Id = '12345'`,
            },
          },
        ],
      } as any,
      ['Id', 'Fax']
    );

    expect(soql).toBe(null);
  });
});

describe('mass-update-records.utils#composeSoqlQueryCustomWhereClause', () => {
  it('Should only return custom where clauses', () => {
    const soql = composeSoqlQueryCustomWhereClause(
      {
        sobject: 'Contact',
        configuration: [
          {
            selectedField: 'FirstName',
            transformationOptions: {
              criteria: 'all',
              option: 'staticValue',
              staticValue: 'Jenny Jenny',
              alternateField: null,
              whereClause: '',
            },
          },
          {
            selectedField: 'LastName',
            transformationOptions: {
              criteria: 'onlyIfBlank',
              option: 'staticValue',
              staticValue: 'Jenny Jenny',
              alternateField: null,
              whereClause: '',
            },
          },
          {
            selectedField: 'Type',
            transformationOptions: {
              criteria: 'onlyIfNotBlank',
              option: 'staticValue',
              staticValue: 'Jenny Jenny',
              alternateField: null,
              whereClause: '',
            },
          },
          {
            selectedField: 'Fax',
            transformationOptions: {
              criteria: 'custom',
              option: 'anotherField',
              staticValue: '',
              alternateField: 'Fax',
              whereClause: `Id = '12345'`,
            },
          },
        ],
      } as any,
      ['Id', 'FirstName', 'LastName', 'Type', 'Fax']
    );

    expect(soql).toBe(`SELECT Id, FirstName, LastName, Type, Fax FROM Contact WHERE (Id = '12345')`);
  });

  it('Should return null if no custom where clauses', () => {
    const soql = composeSoqlQueryCustomWhereClause(
      {
        sobject: 'Contact',
        configuration: [
          {
            selectedField: 'FirstName',
            transformationOptions: {
              criteria: 'all',
              option: 'staticValue',
              staticValue: 'Jenny Jenny',
              alternateField: null,
              whereClause: '',
            },
          },
          {
            selectedField: 'LastName',
            transformationOptions: {
              criteria: 'onlyIfBlank',
              option: 'staticValue',
              staticValue: 'Jenny Jenny',
              alternateField: null,
              whereClause: '',
            },
          },
          {
            selectedField: 'Type',
            transformationOptions: {
              criteria: 'onlyIfNotBlank',
              option: 'staticValue',
              staticValue: 'Jenny Jenny',
              alternateField: null,
              whereClause: '',
            },
          },
        ],
      } as any,
      ['Id', 'FirstName', 'LastName', 'Type', 'Fax']
    );

    expect(soql).toBe(null);
  });
});

describe('mass-update-records.utils#prepareRecords', () => {
  it('Should transform all records with static value', () => {
    const [record1, record2, record3] = prepareRecords(
      [
        { Id: '1', Name: 'Acct 1', Fax: null },
        { Id: '2', Name: 'Acct 2', Fax: null },
        { Id: '3', Name: 'Acct 3', Fax: null },
      ],
      [
        {
          selectedField: 'Name',
          transformationOptions: {
            criteria: 'all',
            option: 'staticValue',
            staticValue: 'Jenny Jenny',
            alternateField: null,
            whereClause: '',
          },
        },
        {
          selectedField: 'Fax',
          transformationOptions: { criteria: 'all', option: 'staticValue', staticValue: '867-5309', alternateField: null, whereClause: '' },
        },
      ]
    );

    expect(record1.Name).toBe('Jenny Jenny');
    expect(record1.Fax).toBe('867-5309');

    expect(record2.Name).toBe('Jenny Jenny');
    expect(record2.Fax).toBe('867-5309');

    expect(record3.Name).toBe('Jenny Jenny');
    expect(record3.Fax).toBe('867-5309');
  });

  it('Should transform all records with another field', () => {
    const [record1, record2, record3] = prepareRecords(
      [
        { Id: '1', Name: 'Acct 1', Fax: '867-5309' },
        { Id: '2', Name: 'Acct 2', Fax: '867-5309' },
        { Id: '3', Name: 'Acct 3', Fax: '867-5309' },
      ],
      [
        {
          selectedField: 'Name',
          transformationOptions: {
            criteria: 'all',
            option: 'anotherField',
            staticValue: 'Jenny Jenny',
            alternateField: 'Fax',
            whereClause: '',
          },
        },
      ]
    );

    expect(record1.Name).toBe('867-5309');
    expect(record1.Fax).toBe('867-5309');

    expect(record2.Name).toBe('867-5309');
    expect(record2.Fax).toBe('867-5309');

    expect(record3.Name).toBe('867-5309');
    expect(record3.Fax).toBe('867-5309');
  });

  it('Should transform all records based on blank/not blank', () => {
    const [record1, record2, record3] = prepareRecords(
      [
        { Id: '1', Name: 'Acct 1', Fax: '867-5309-initial', Phone: null },
        { Id: '2', Name: 'Acct 2', Fax: null, Phone: '800-867-5309' },
        { Id: '3', Name: 'Acct 3', Fax: null, Phone: '800-867-5309' },
      ],
      [
        {
          selectedField: 'Phone',
          transformationOptions: {
            criteria: 'onlyIfBlank',
            option: 'staticValue',
            staticValue: '867-5309',
            alternateField: null,
            whereClause: '',
          },
        },
        {
          selectedField: 'Fax',
          transformationOptions: {
            criteria: 'onlyIfNotBlank',
            option: 'staticValue',
            staticValue: '867-5309',
            alternateField: null,
            whereClause: '',
          },
        },
      ]
    );

    expect(record1.Name).toBe('Acct 1');
    expect(record1.Fax).toBe('867-5309');
    expect(record1.Phone).toBe('867-5309');

    expect(record2.Name).toBe('Acct 2');
    expect(record2.Fax).toBe(null);
    expect(record2.Phone).toBe(null); // set to null just for results clarity, not actually modified in SFDC

    expect(record3.Name).toBe('Acct 3');
    expect(record3.Fax).toBe(null);
    expect(record3.Phone).toBe(null); // set to null just for results clarity, not actually modified in SFDC
  });

  it('Should clear value', () => {
    const [record1, record2, record3] = prepareRecords(
      [
        { Id: '1', Name: 'Acct 1', Fax: '867-5309' },
        { Id: '2', Name: 'Acct 2', Fax: '867-5309' },
        { Id: '3', Name: 'Acct 3', Fax: '867-5309' },
      ],
      [
        {
          selectedField: 'Name',
          transformationOptions: {
            criteria: 'all',
            option: 'null',
            staticValue: '',
            alternateField: '',
            whereClause: '',
          },
        },
        {
          selectedField: 'Fax',
          transformationOptions: {
            criteria: 'all',
            option: 'null',
            staticValue: '',
            alternateField: '',
            whereClause: '',
          },
        },
      ]
    );

    expect(record1.Name).toBe('#N/A');
    expect(record1.Fax).toBe('#N/A');

    expect(record2.Name).toBe('#N/A');
    expect(record2.Fax).toBe('#N/A');

    expect(record3.Name).toBe('#N/A');
    expect(record3.Fax).toBe('#N/A');
  });

  it('Should update records with custom criteria', () => {
    const [record1, record2, record3] = prepareRecords(
      [
        { Id: '1', Name: 'Acct 1' },
        { Id: '2', Name: 'Acct 2' },
        { Id: '3', Name: 'Acct 3' },
      ],
      [
        {
          selectedField: 'Name',
          transformationOptions: {
            criteria: 'custom',
            option: 'staticValue',
            staticValue: 'Jenny Jenny',
            alternateField: null,
            whereClause: 'Id = 1 OR Id = 3',
          },
        },
      ],
      new Set(['1', '3'])
    );

    expect(record1.Name).toBe('Jenny Jenny');
    expect(record2.Name).toBe(null);
    expect(record3.Name).toBe('Jenny Jenny');
  });
});
