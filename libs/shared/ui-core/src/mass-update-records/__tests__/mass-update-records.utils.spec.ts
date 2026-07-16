import * as clientData from '@jetstream/shared/data';
import { parseQuery } from '@jetstreamapp/soql-parser-js';
import { beforeEach, vi } from 'vitest';
import {
  composeSoqlQueryCustomWhereClause,
  composeSoqlQueryOptionalCustomWhereClause,
  fetchRecordsWithRequiredFields,
  getFieldsToQuery,
  isValidRow,
  MAX_ID_QUERY_LENGTH,
  prepareRecords,
} from '../mass-update-records.utils';

vi.mock('@jetstream/shared/data');

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
      } as any),
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
      } as any),
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
      } as any),
    ).toBe(false);
    expect(
      isValidRow({
        configuration: [
          {
            selectedField: 'Name',
            transformationOptions: { option: 'staticValue', staticValue: '' },
          },
        ],
      } as any),
    ).toBe(false);
    expect(
      isValidRow({
        configuration: [
          {
            criteria: 'custom',
            transformationOptions: { whereClause: '' },
          },
        ],
      } as any),
    ).toBe(false);
    expect(
      isValidRow({
        configuration: [
          {
            criteria: 'custom',
            transformationOptions: { whereClause: 'Invalid Where Clause!' },
          },
        ],
      } as any),
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
      ['Id', 'FirstName', 'LastName', 'Type', 'Fax'],
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
      ['Id', 'Fax'],
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
      ['Id', 'FirstName', 'LastName', 'Type', 'Fax'],
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
      ['Id', 'FirstName', 'LastName', 'Type', 'Fax'],
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
      ],
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
      ],
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
      ],
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
      ],
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
      new Set(['1', '3']),
    );

    expect(record1.Name).toBe('Jenny Jenny');
    expect(record2.Name).toBe(null);
    expect(record3.Name).toBe('Jenny Jenny');
  });
});

describe('mass-update-records.utils#fetchRecordsWithRequiredFields', () => {
  const selectedOrg = { uniqueId: 'org1' } as any;
  const configuration = [
    {
      selectedField: 'Industry',
      transformationOptions: {
        criteria: 'onlyIfNotBlank',
        option: 'staticValue',
        staticValue: 'Tech',
        alternateField: null,
        whereClause: '',
      },
    },
  ] as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Should query only the chosen records by Id when idsToInclude is provided', async () => {
    const fetchedRecords = [
      { Id: '001a', Industry: 'Finance' },
      { Id: '001b', Industry: null },
    ];
    vi.mocked(clientData.queryAllFromList).mockResolvedValue({
      queryResults: { records: fetchedRecords, totalSize: 2, done: true },
    } as any);

    const result = await fetchRecordsWithRequiredFields({
      selectedOrg,
      parsedQuery: parseQuery('SELECT Id FROM Account'),
      idsToInclude: new Set(['001a', '001b']),
      configuration,
    });

    expect(clientData.queryAll).not.toHaveBeenCalled();
    expect(clientData.queryAllFromList).toHaveBeenCalledTimes(1);
    const [org, soqlQueries] = vi.mocked(clientData.queryAllFromList).mock.calls[0];
    expect(org).toBe(selectedOrg);
    expect(soqlQueries).toEqual([`SELECT Id, Industry FROM Account WHERE Id IN ('001a','001b')`]);
    expect(result).toBe(fetchedRecords);
  });

  it('Should split large id sets into multiple length-bounded chunks that each stay under the query-URL limit', async () => {
    vi.mocked(clientData.queryAllFromList).mockResolvedValue({ queryResults: { records: [], totalSize: 0, done: true } } as any);

    // Use realistic 18-char Salesforce Ids (as returned by query results) so the length math matches production
    const ids = Array.from({ length: 2000 }, (_, index) => `001${String(index).padStart(15, '0')}`);
    await fetchRecordsWithRequiredFields({
      selectedOrg,
      parsedQuery: parseQuery('SELECT Id FROM Account'),
      idsToInclude: new Set(ids),
      configuration,
    });

    const [, soqlQueries] = vi.mocked(clientData.queryAllFromList).mock.calls[0];
    // Bounding by length (not a fixed count) is the fix for the SF 500s, so assert the guarantee directly:
    // more than one chunk is produced and every chunk stays under Salesforce's query-URL length limit.
    expect(soqlQueries.length).toBeGreaterThan(1);
    soqlQueries.forEach((soql: string) => expect(soql.length).toBeLessThanOrEqual(MAX_ID_QUERY_LENGTH));
  });

  it('Should return an empty array without querying when idsToInclude is empty', async () => {
    const result = await fetchRecordsWithRequiredFields({
      selectedOrg,
      parsedQuery: parseQuery('SELECT Id FROM Account'),
      idsToInclude: new Set(),
      configuration,
    });

    expect(result).toEqual([]);
    expect(clientData.queryAllFromList).not.toHaveBeenCalled();
    expect(clientData.queryAll).not.toHaveBeenCalled();
  });

  it('Should re-run the full query (preserving WHERE) when idsToInclude is omitted', async () => {
    const fetchedRecords = [{ Id: '001a', Industry: 'Finance' }];
    vi.mocked(clientData.queryAll).mockResolvedValue({ queryResults: { records: fetchedRecords, totalSize: 1, done: true } } as any);

    const result = await fetchRecordsWithRequiredFields({
      selectedOrg,
      parsedQuery: parseQuery(`SELECT Id FROM Account WHERE Name != null`),
      configuration,
    });

    expect(clientData.queryAllFromList).not.toHaveBeenCalled();
    expect(clientData.queryAll).toHaveBeenCalledTimes(1);
    const [, soql] = vi.mocked(clientData.queryAll).mock.calls[0];
    // composeQuery normalizes the `null` literal to `NULL`; the WHERE clause is preserved
    expect(soql).toBe(`SELECT Id, Industry FROM Account WHERE Name != NULL`);
    expect(result).toBe(fetchedRecords);
  });

  it('Should report cumulative progress against the requested id count', async () => {
    vi.mocked(clientData.queryAllFromList).mockResolvedValue({ queryResults: { records: [], totalSize: 0, done: true } } as any);
    const onProgress = vi.fn();

    await fetchRecordsWithRequiredFields({
      selectedOrg,
      parsedQuery: parseQuery('SELECT Id FROM Account'),
      idsToInclude: new Set(['001a', '001b']),
      configuration,
      onProgress,
    });

    // grab the progress callback handed to queryAllFromList and simulate a chunk completing
    const progressCallback = vi.mocked(clientData.queryAllFromList).mock.calls[0][4] as (fetched: number, total: number) => void;
    progressCallback(2, 999);
    expect(onProgress).toHaveBeenCalledWith(2, 2);
  });

  it('Should pass the abort signal through to the query layer', async () => {
    vi.mocked(clientData.queryAllFromList).mockResolvedValue({ queryResults: { records: [], totalSize: 0, done: true } } as any);
    const signal = new AbortController().signal;

    await fetchRecordsWithRequiredFields({
      selectedOrg,
      parsedQuery: parseQuery('SELECT Id FROM Account'),
      idsToInclude: new Set(['001a']),
      configuration,
      signal,
    });

    expect(vi.mocked(clientData.queryAllFromList).mock.calls[0][5]).toBe(signal);
  });
});
