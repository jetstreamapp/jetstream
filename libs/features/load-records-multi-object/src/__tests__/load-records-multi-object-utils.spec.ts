import { describeSObject } from '@jetstream/shared/data';
import { Field, SalesforceOrgUi } from '@jetstream/types';
import * as XLSX from 'xlsx';
import { LoadMultiObjectData, LoadMultiObjectRequestWithResult } from '../load-records-multi-object-types';
import {
  MAX_RECORDS_PER_GROUP,
  buildDataGraph,
  buildRetryRequests,
  parseWorkbook,
  splitRequestsToMaxSize,
} from '../load-records-multi-object-utils';

vi.mock('@jetstream/shared/data', () => ({
  describeSObject: vi.fn(),
}));

const describeSObjectMock = vi.mocked(describeSObject);

const ORG = {} as SalesforceOrgUi;
const API_VERSION = 'v62.0';
const GRAPH_OPTIONS = { insertNulls: false, dateFormat: 'MM/dd/yyyy' };

function mockField(name: string, type = 'string', overrides: Partial<Field> = {}): Field {
  return { name, type, externalId: false, relationshipName: null, referenceTo: [], ...overrides } as unknown as Field;
}

const OBJECT_METADATA: Record<string, { name: string; fields: Field[] }> = {
  account: {
    name: 'Account',
    fields: [
      mockField('Id', 'id'),
      mockField('Name'),
      mockField('ParentId', 'reference', { referenceTo: ['Account'] }),
      mockField('My_Ext_Id__c', 'string', { externalId: true }),
    ],
  },
  contact: {
    name: 'Contact',
    fields: [
      mockField('Id', 'id'),
      mockField('FirstName'),
      mockField('LastName'),
      mockField('AccountId', 'reference', { referenceTo: ['Account'] }),
    ],
  },
};

interface SheetSpec {
  sobject: string;
  operation: string;
  externalId?: string;
  headers: string[];
  rows: any[][];
}

function buildSheetAoa({ sobject, operation, externalId, headers, rows }: SheetSpec): any[][] {
  return [['Object Api Name', sobject], ['Operation', operation], ['External Id (for upsert)', externalId ?? ''], [], headers, ...rows];
}

function buildWorkbook(sheets: Record<string, SheetSpec | any[][]>): XLSX.WorkBook {
  const workbook = XLSX.utils.book_new();
  Object.entries(sheets).forEach(([sheetName, sheet]) => {
    const aoa = Array.isArray(sheet) ? sheet : buildSheetAoa(sheet);
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(aoa), sheetName);
  });
  return workbook;
}

/** The workbook shape of the downloadable template: parent accounts + contacts referencing them */
function buildTemplateWorkbook(): XLSX.WorkBook {
  return buildWorkbook({
    Instructions: [['Instructions here']],
    'Create Accounts': {
      sobject: 'Account',
      operation: 'Insert',
      headers: ['Reference Id', 'Name', '{ParentId}'],
      rows: [
        ['account1', 'Account 1', ''],
        ['account2', 'Account 2', ''],
        ['account3', 'Account 3', 'account1'],
      ],
    },
    'Create Contacts': {
      sobject: 'Contact',
      operation: 'Insert',
      headers: ['Reference Id', 'FirstName', 'LastName', '{AccountId}'],
      rows: [
        ['contact1', 'Bob', 'Smith', 'account1'],
        ['contact2', 'Janet', 'Smith', 'account1'],
        ['contact3', 'Alan', 'Jackson', 'account2'],
      ],
    },
  });
}

async function parseDatasets(workbook: XLSX.WorkBook): Promise<LoadMultiObjectData[]> {
  const { datasets } = await parseWorkbook(workbook, ORG);
  return datasets;
}

function allErrors(datasets: LoadMultiObjectData[]) {
  return datasets.flatMap(({ errors }) => errors);
}

beforeEach(() => {
  describeSObjectMock.mockReset();
  describeSObjectMock.mockImplementation((_org, sobject: string) => {
    const metadata = OBJECT_METADATA[sobject.toLowerCase()];
    if (!metadata) {
      return Promise.reject(new Error('The requested resource does not exist'));
    }
    return Promise.resolve({ data: metadata } as any);
  });
});

describe('parseWorkbook', () => {
  it('parses the template shape, skipping the Instructions sheet with no warning', async () => {
    const { datasets, workbookErrors } = await parseWorkbook(buildTemplateWorkbook(), ORG);

    expect(workbookErrors).toEqual([]);
    expect(datasets).toHaveLength(2);

    const [accounts, contacts] = datasets;
    expect(accounts.worksheet).toBe('Create Accounts');
    expect(accounts.sobject).toBe('Account');
    expect(accounts.operation).toBe('INSERT');
    expect(accounts.referenceColumnHeader).toBe('Reference Id');
    expect(accounts.headers).toEqual(['Name', 'ParentId']);
    expect(accounts.referenceHeaders).toEqual(new Set(['ParentId']));
    expect(accounts.data).toHaveLength(3);
    expect(accounts.errors).toEqual([]);

    expect(contacts.sobject).toBe('Contact');
    expect(contacts.referenceHeaders).toEqual(new Set(['AccountId']));
    expect(contacts.errors).toEqual([]);
  });

  it('reports a missing object name at cell B1', async () => {
    const workbook = buildWorkbook({
      Sheet1: [[], ['Operation', 'Insert'], [], [], ['Reference Id', 'Name'], ['rec1', 'Test']],
    });
    const datasets = await parseDatasets(workbook);

    const [error] = allErrors(datasets);
    expect(error.property).toBe('sobject');
    expect(error.location).toBe('B1');
    expect(error.locationType).toBe('CELL');
    expect(error.message).toContain('Cell B1 must contain the Object API Name');
  });

  it('reports an invalid operation at cell B2', async () => {
    const workbook = buildWorkbook({
      Sheet1: { sobject: 'Account', operation: 'Delete', headers: ['Reference Id', 'Name'], rows: [['rec1', 'Test']] },
    });
    const datasets = await parseDatasets(workbook);

    const [error] = allErrors(datasets);
    expect(error.property).toBe('operation');
    expect(error.location).toBe('B2');
    expect(error.message).toContain('The operation is not valid: "DELETE"');
  });

  it('reports a missing external Id for upsert at cell B3 (not B1)', async () => {
    const workbook = buildWorkbook({
      Sheet1: { sobject: 'Account', operation: 'Upsert', headers: ['Reference Id', 'Name'], rows: [['rec1', 'Test']] },
    });
    const datasets = await parseDatasets(workbook);

    const [error] = allErrors(datasets);
    expect(error.property).toBe('externalId');
    expect(error.location).toBe('B3');
    expect(error.message).toBe('An external Id is required for upsert.');
  });

  it('requires the upsert external Id to be a column and flagged as external id in Salesforce', async () => {
    const workbook = buildWorkbook({
      Sheet1: {
        sobject: 'Account',
        operation: 'Upsert',
        externalId: 'Name',
        headers: ['Reference Id', 'Name'],
        rows: [['rec1', 'Test']],
      },
    });
    const datasets = await parseDatasets(workbook);

    const [error] = allErrors(datasets);
    expect(error.location).toBe('B3');
    expect(error.message).toContain('must exist and must be marked as an external id');
  });

  it('proper-cases a valid upsert external Id', async () => {
    const workbook = buildWorkbook({
      Sheet1: {
        sobject: 'Account',
        operation: 'Upsert',
        externalId: 'my_ext_id__c',
        headers: ['Reference Id', 'Name', 'My_Ext_Id__c'],
        rows: [['rec1', 'Test', 'ext-1']],
      },
    });
    const [dataset] = await parseDatasets(workbook);

    expect(dataset.errors).toEqual([]);
    expect(dataset.externalId).toBe('My_Ext_Id__c');
  });

  it('reports duplicate headers on row 5', async () => {
    const workbook = buildWorkbook({
      Sheet1: { sobject: 'Account', operation: 'Insert', headers: ['Reference Id', 'Name', 'Name'], rows: [['rec1', 'a', 'b']] },
    });
    const datasets = await parseDatasets(workbook);

    const duplicateHeaderError = allErrors(datasets).find(({ message }) => message.includes('duplicate values in your header'));
    expect(duplicateHeaderError).toBeTruthy();
    expect(duplicateHeaderError?.locationType).toBe('ROW');
    expect(duplicateHeaderError?.location).toBe('5');
  });

  it('reports duplicate Reference Ids within a sheet with the exact cell and row index', async () => {
    const workbook = buildWorkbook({
      Sheet1: {
        sobject: 'Account',
        operation: 'Insert',
        headers: ['Reference Id', 'Name'],
        rows: [
          ['rec1', 'a'],
          ['rec1', 'b'],
        ],
      },
    });
    const datasets = await parseDatasets(workbook);

    const duplicateError = allErrors(datasets).find(({ message }) => message.includes('used for multiple records'));
    expect(duplicateError?.location).toBe('A7');
    expect(duplicateError?.rowIndexes).toEqual([1]);
  });

  it('reports Reference Ids duplicated across worksheets', async () => {
    const workbook = buildWorkbook({
      Sheet1: { sobject: 'Account', operation: 'Insert', headers: ['Reference Id', 'Name'], rows: [['rec1', 'a']] },
      Sheet2: { sobject: 'Contact', operation: 'Insert', headers: ['Reference Id', 'LastName'], rows: [['rec1', 'b']] },
    });
    const datasets = await parseDatasets(workbook);

    const duplicateError = allErrors(datasets).find(({ message }) => message.includes('used for multiple records'));
    expect(duplicateError?.worksheet).toBe('Sheet2');
    expect(duplicateError?.rowIndexes).toEqual([0]);
  });

  it('reports each unknown field as its own column error with the header attached', async () => {
    const workbook = buildWorkbook({
      Sheet1: {
        sobject: 'Account',
        operation: 'Insert',
        headers: ['Reference Id', 'Name', 'Bogus__c', 'AlsoBogus__c'],
        rows: [['rec1', 'a', 'b', 'c']],
      },
    });
    const datasets = await parseDatasets(workbook);

    const fieldErrors = allErrors(datasets).filter(({ message }) => message.includes('does not exist on the object'));
    expect(fieldErrors).toHaveLength(2);
    expect(fieldErrors.map(({ header }) => header)).toEqual(['Bogus__c', 'AlsoBogus__c']);
    expect(fieldErrors.every(({ locationType }) => locationType === 'COLUMN')).toBe(true);
  });

  it('reports missing Reference Ids with the offending row indexes', async () => {
    const workbook = buildWorkbook({
      Sheet1: {
        sobject: 'Account',
        operation: 'Insert',
        headers: ['Reference Id', 'Name'],
        rows: [
          ['rec1', 'a'],
          ['', 'b'],
          ['rec3', 'c'],
          ['', 'd'],
        ],
      },
    });
    const datasets = await parseDatasets(workbook);

    const missingError = allErrors(datasets).find(({ message }) => message.includes('missing a Reference Id'));
    expect(missingError?.rowIndexes).toEqual([1, 3]);
  });

  it('reports invalid Reference Ids with row indexes, and allows single-character Reference Ids', async () => {
    const workbook = buildWorkbook({
      Sheet1: {
        sobject: 'Account',
        operation: 'Insert',
        headers: ['Reference Id', 'Name'],
        rows: [
          ['a', 'single char is valid'],
          ['bad id!', 'invalid'],
          ['good_1', 'valid'],
        ],
      },
    });
    const datasets = await parseDatasets(workbook);

    const invalidError = allErrors(datasets).find(({ message }) => message.includes('invalid characters'));
    expect(invalidError?.rowIndexes).toEqual([1]);
    expect(invalidError?.message).toContain('"bad id!"');
  });

  it('normalizes the Reference Id header from cell A5 so surrounding whitespace or braces still line up with the rows', async () => {
    for (const referenceHeader of ['Reference Id ', '{Reference Id}']) {
      const workbook = buildWorkbook({
        Sheet1: {
          sobject: 'Account',
          operation: 'Insert',
          headers: [referenceHeader, 'Name'],
          rows: [['account1', 'Account 1']],
        },
      });
      const [dataset] = await parseDatasets(workbook);

      expect(dataset.referenceColumnHeader).toBe('Reference Id');
      expect(dataset.headers).toEqual(['Name']);
      expect(Object.keys(dataset.dataById)).toEqual(['account1']);
      expect(dataset.errors).toEqual([]);
    }
  });

  it('normalizes Reference Id values, so numbers and stray whitespace are not reported as missing or invalid', async () => {
    const workbook = buildWorkbook({
      Sheet1: {
        sobject: 'Account',
        operation: 'Insert',
        headers: ['Reference Id', 'Name'],
        rows: [
          [0, 'numeric zero is a valid Reference Id'],
          [1, 'numeric one'],
          ['account1 ', 'trailing whitespace is trimmed, not invalid'],
        ],
      },
    });
    const [dataset] = await parseDatasets(workbook);

    expect(Object.keys(dataset.dataById)).toEqual(['0', '1', 'account1']);
    expect(dataset.errors).toEqual([]);
  });

  it('reports an empty data sheet as a sheet-level error', async () => {
    const workbook = buildWorkbook({
      Sheet1: { sobject: 'Account', operation: 'Insert', headers: ['Reference Id', 'Name'], rows: [] },
    });
    const datasets = await parseDatasets(workbook);

    const [error] = allErrors(datasets);
    expect(error.locationType).toBe('SHEET');
    expect(error.message).toContain('no data rows');
  });

  it('errors when the workbook has no data worksheets at all', async () => {
    const workbook = buildWorkbook({ Instructions: [['only instructions']] });
    const { datasets, workbookErrors } = await parseWorkbook(workbook, ORG);

    expect(datasets).toEqual([]);
    expect(workbookErrors).toHaveLength(1);
    expect(workbookErrors[0].message).toContain('No data worksheets were found');
  });

  it('warns when a non-template sheet is skipped by the instructions name rule', async () => {
    const workbook = buildWorkbook({
      'Account instructions': [['this will be skipped']],
      Sheet1: { sobject: 'Account', operation: 'Insert', headers: ['Reference Id', 'Name'], rows: [['rec1', 'a']] },
    });
    const { workbookErrors } = await parseWorkbook(workbook, ORG);

    expect(workbookErrors).toHaveLength(1);
    expect(workbookErrors[0].severity).toBe('warning');
    expect(workbookErrors[0].worksheet).toBe('Account instructions');
  });

  it('reports an unknown object with guidance pointing at cell B1', async () => {
    const workbook = buildWorkbook({
      Sheet1: { sobject: 'NotARealObject__c', operation: 'Insert', headers: ['Reference Id', 'Name'], rows: [['rec1', 'a']] },
    });
    const datasets = await parseDatasets(workbook);

    const [error] = allErrors(datasets);
    expect(error.location).toBe('B1');
    expect(error.message).toContain('could not be loaded from the org');
    expect(error.message).toContain('notarealobject__c');
  });
});

describe('buildDataGraph', () => {
  it('builds one group per connected set of related records, topologically ordered', async () => {
    const datasets = await parseDatasets(buildTemplateWorkbook());
    const { requests, errors, groupsByRefId } = buildDataGraph(datasets, API_VERSION, GRAPH_OPTIONS);

    expect(errors).toEqual([]);
    expect(requests).toHaveLength(1);

    const graphs = requests[0].data;
    expect(graphs).toHaveLength(2);

    // account1's cluster: account1 + account3 (ParentId) + contact1 + contact2
    const account1Graph = graphs.find(({ graphId }) => graphId === 'account1');
    const account1Members = account1Graph?.compositeRequest?.map(({ referenceId }) => referenceId) || [];
    expect(new Set(account1Members)).toEqual(new Set(['account1', 'account3', 'contact1', 'contact2']));
    // parent must be created before its dependents
    expect(account1Members[0]).toBe('account1');

    const account2Graph = graphs.find(({ graphId }) => graphId === 'account2');
    expect(new Set(account2Graph?.compositeRequest?.map(({ referenceId }) => referenceId))).toEqual(new Set(['account2', 'contact3']));

    expect(groupsByRefId['contact1']).toEqual({ graphId: 'account1', size: 4 });
    expect(groupsByRefId['contact3']).toEqual({ graphId: 'account2', size: 2 });
  });

  it('emits the composite-graph reference syntax for dependent fields', async () => {
    const datasets = await parseDatasets(buildTemplateWorkbook());
    const { requests } = buildDataGraph(datasets, API_VERSION, GRAPH_OPTIONS);

    const contact1 = requests[0].recordWithResponseByRefId['contact1'];
    expect(contact1.request.body.AccountId).toBe('@{account1.id}');
    expect(contact1.request.method).toBe('POST');
    expect(contact1.request.url).toBe(`/services/data/${API_VERSION}/sobjects/Contact`);
  });

  it('keeps unrelated records as independent single-record groups', async () => {
    const workbook = buildWorkbook({
      Sheet1: {
        sobject: 'Account',
        operation: 'Insert',
        headers: ['Reference Id', 'Name'],
        rows: [
          ['a1', 'One'],
          ['a2', 'Two'],
          ['a3', 'Three'],
        ],
      },
    });
    const datasets = await parseDatasets(workbook);
    const { requests, groupsByRefId } = buildDataGraph(datasets, API_VERSION, GRAPH_OPTIONS);

    expect(requests).toHaveLength(1);
    expect(requests[0].data).toHaveLength(3);
    expect(groupsByRefId['a2']).toEqual({ graphId: 'a2', size: 1 });
  });

  it('merges groups when a record depends on records from two different clusters (diamond)', async () => {
    // give Contact a ReportsToId reference field for this test
    describeSObjectMock.mockImplementation((_org, sobject: string) => {
      if (sobject.toLowerCase() === 'contact') {
        return Promise.resolve({
          data: {
            name: 'Contact',
            fields: [...OBJECT_METADATA.contact.fields, mockField('ReportsToId', 'reference', { referenceTo: ['Contact'] })],
          },
        } as any);
      }
      return Promise.resolve({ data: OBJECT_METADATA[sobject.toLowerCase()] } as any);
    });

    // contact1 references accountA via the column and contactBoss (in accountB's cluster) via a cell-level
    // reference, chaining both clusters into one group
    const workbook = buildWorkbook({
      Accounts: {
        sobject: 'Account',
        operation: 'Insert',
        headers: ['Reference Id', 'Name'],
        rows: [
          ['accountA', 'A'],
          ['accountB', 'B'],
        ],
      },
      Contacts: {
        sobject: 'Contact',
        operation: 'Insert',
        headers: ['Reference Id', 'LastName', '{AccountId}', 'ReportsToId'],
        rows: [
          ['contactBoss', 'Boss', 'accountB', ''],
          ['contact1', 'Smith', 'accountA', '{contactBoss}'],
        ],
      },
    });

    const datasets = await parseDatasets(workbook);
    const { requests, errors } = buildDataGraph(datasets, API_VERSION, GRAPH_OPTIONS);

    expect(errors).toEqual([]);
    expect(requests[0].data).toHaveLength(1);
    expect(requests[0].data[0].compositeRequest).toHaveLength(4);
  });

  it('detects dependencies for reference headers whose casing does not match the field API name', async () => {
    const workbook = buildWorkbook({
      Accounts: { sobject: 'Account', operation: 'Insert', headers: ['Reference Id', 'Name'], rows: [['account1', 'A']] },
      Contacts: {
        sobject: 'Contact',
        operation: 'Insert',
        headers: ['Reference Id', 'LastName', '{accountid}'],
        rows: [['contact1', 'Smith', 'account1']],
      },
    });
    const datasets = await parseDatasets(workbook);
    const { requests, errors } = buildDataGraph(datasets, API_VERSION, GRAPH_OPTIONS);

    expect(errors).toEqual([]);
    expect(requests[0].data).toHaveLength(1);
    expect(requests[0].recordWithResponseByRefId['contact1'].request.body.AccountId).toBe('@{account1.id}');
  });

  it('strips curly braces from cell values inside a reference column', async () => {
    const workbook = buildWorkbook({
      Accounts: {
        sobject: 'Account',
        operation: 'Insert',
        headers: ['Reference Id', 'Name', '{ParentId}'],
        rows: [
          ['account1', 'Parent', ''],
          ['account2', 'Child', '{account1}'],
        ],
      },
    });
    const datasets = await parseDatasets(workbook);
    const { requests, errors } = buildDataGraph(datasets, API_VERSION, GRAPH_OPTIONS);

    expect(errors).toEqual([]);
    expect(requests[0].recordWithResponseByRefId['account2'].request.body.ParentId).toBe('@{account1.id}');
  });

  it('resolves numeric Reference Ids - the graph keys nodes by identity, so ids and lookups must both be strings', async () => {
    const workbook = buildWorkbook({
      Accounts: {
        sobject: 'Account',
        operation: 'Insert',
        headers: ['Reference Id', 'Name', '{ParentId}'],
        rows: [
          [0, 'Grandparent', ''],
          [1, 'Parent', 0],
          [2, 'Child', 1],
        ],
      },
    });
    const datasets = await parseDatasets(workbook);
    const { requests, errors, groupsByRefId } = buildDataGraph(datasets, API_VERSION, GRAPH_OPTIONS);

    expect(errors).toEqual([]);
    expect(Object.keys(groupsByRefId)).toEqual(['0', '1', '2']);
    expect(requests[0].recordWithResponseByRefId['1'].request.body.ParentId).toBe('@{0.id}');
    expect(requests[0].recordWithResponseByRefId['2'].request.body.ParentId).toBe('@{1.id}');
  });

  it('reports an unknown Reference Id with the row it came from and does not throw', async () => {
    const workbook = buildWorkbook({
      Contacts: {
        sobject: 'Contact',
        operation: 'Insert',
        headers: ['Reference Id', 'LastName', '{AccountId}'],
        rows: [
          ['contact1', 'Smith', 'account_typo'],
          ['contact2', 'Jones', ''],
        ],
      },
    });
    const datasets = await parseDatasets(workbook);
    const { requests, errors } = buildDataGraph(datasets, API_VERSION, GRAPH_OPTIONS);

    expect(requests).toEqual([]);
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain('"account_typo" refers to a Reference Id that does not exist');
    expect(errors[0].rowIndexes).toEqual([0]);
    expect(errors[0].location).toBe('6');
  });

  it('reports circular references as a readable loop instead of throwing', async () => {
    const workbook = buildWorkbook({
      Accounts: {
        sobject: 'Account',
        operation: 'Insert',
        headers: ['Reference Id', 'Name', '{ParentId}'],
        rows: [
          ['account1', 'A', 'account2'],
          ['account2', 'B', 'account1'],
        ],
      },
    });
    const datasets = await parseDatasets(workbook);
    const { requests, errors } = buildDataGraph(datasets, API_VERSION, GRAPH_OPTIONS);

    expect(requests).toEqual([]);
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain('link to each other in a loop');
    expect(errors[0].message).toContain('sheet "Accounts"');
  });

  it('allows a group of exactly 500 records and rejects a group of 501 with a per-group explanation', async () => {
    function buildChainWorkbook(childCount: number) {
      return buildWorkbook({
        Accounts: {
          sobject: 'Account',
          operation: 'Insert',
          headers: ['Reference Id', 'Name', '{ParentId}'],
          rows: [['parent', 'The Parent', ''], ...Array.from({ length: childCount }, (_, i) => [`child_${i}`, `Child ${i}`, 'parent'])],
        },
      });
    }

    const okResult = buildDataGraph(await parseDatasets(buildChainWorkbook(MAX_RECORDS_PER_GROUP - 1)), API_VERSION, GRAPH_OPTIONS);
    expect(okResult.errors).toEqual([]);
    expect(okResult.groupsByRefId['parent'].size).toBe(MAX_RECORDS_PER_GROUP);

    const overResult = buildDataGraph(await parseDatasets(buildChainWorkbook(MAX_RECORDS_PER_GROUP)), API_VERSION, GRAPH_OPTIONS);
    expect(overResult.requests).toEqual([]);
    expect(overResult.errors).toHaveLength(1);
    expect(overResult.errors[0].message).toContain('This limit is per group, not per file');
    // group info is still returned so the UI can show the oversized group
    expect(overResult.groupsByRefId['parent'].size).toBe(MAX_RECORDS_PER_GROUP + 1);
  });

  it('is idempotent - running twice on the same datasets produces identical output (no input mutation)', async () => {
    const datasets = await parseDatasets(buildTemplateWorkbook());

    const first = buildDataGraph(datasets, API_VERSION, GRAPH_OPTIONS);
    const second = buildDataGraph(datasets, API_VERSION, GRAPH_OPTIONS);

    expect(second.errors).toEqual([]);
    expect(JSON.parse(JSON.stringify(second))).toEqual(JSON.parse(JSON.stringify(first)));
  });

  it('is idempotent for cell-level references in non-reference columns', async () => {
    const workbook = buildWorkbook({
      Accounts: { sobject: 'Account', operation: 'Insert', headers: ['Reference Id', 'Name'], rows: [['account1', 'A']] },
      Contacts: {
        sobject: 'Contact',
        operation: 'Insert',
        headers: ['Reference Id', 'LastName', 'AccountId'],
        rows: [['contact1', 'Smith', '{account1}']],
      },
    });
    const datasets = await parseDatasets(workbook);

    const first = buildDataGraph(datasets, API_VERSION, GRAPH_OPTIONS);
    const second = buildDataGraph(datasets, API_VERSION, GRAPH_OPTIONS);

    expect(first.requests[0].recordWithResponseByRefId['contact1'].request.body.AccountId).toBe('@{account1.id}');
    expect(second.requests[0].recordWithResponseByRefId['contact1'].request.body.AccountId).toBe('@{account1.id}');
    expect(second.requests[0].data).toHaveLength(1);
  });

  it('builds upsert URLs with the external Id in the path and strips it from the body', async () => {
    const workbook = buildWorkbook({
      Sheet1: {
        sobject: 'Account',
        operation: 'Upsert',
        externalId: 'My_Ext_Id__c',
        headers: ['Reference Id', 'Name', 'My_Ext_Id__c'],
        rows: [['rec1', 'Test', 'ext-1']],
      },
    });
    const datasets = await parseDatasets(workbook);
    const { requests, errors } = buildDataGraph(datasets, API_VERSION, GRAPH_OPTIONS);

    expect(errors).toEqual([]);
    const { request } = requests[0].recordWithResponseByRefId['rec1'];
    expect(request.method).toBe('PATCH');
    expect(request.url).toBe(`/services/data/${API_VERSION}/sobjects/Account/My_Ext_Id__c/ext-1`);
    expect(request.body.My_Ext_Id__c).toBeUndefined();
  });

  it('builds update URLs with the record Id and PATCH', async () => {
    const workbook = buildWorkbook({
      Sheet1: {
        sobject: 'Account',
        operation: 'Update',
        headers: ['Reference Id', 'Id', 'Name'],
        rows: [['rec1', '001000000000001AAA', 'Updated Name']],
      },
    });
    const datasets = await parseDatasets(workbook);
    const { requests, errors } = buildDataGraph(datasets, API_VERSION, GRAPH_OPTIONS);

    expect(errors).toEqual([]);
    const { request } = requests[0].recordWithResponseByRefId['rec1'];
    expect(request.method).toBe('PATCH');
    expect(request.url).toBe(`/services/data/${API_VERSION}/sobjects/Account/001000000000001AAA`);
  });

  it('carries worksheet, row index, and graph id onto every record result shell', async () => {
    const datasets = await parseDatasets(buildTemplateWorkbook());
    const { requests } = buildDataGraph(datasets, API_VERSION, GRAPH_OPTIONS);

    const contact3 = requests[0].recordWithResponseByRefId['contact3'];
    expect(contact3.worksheet).toBe('Create Contacts');
    expect(contact3.rowIndex).toBe(2);
    expect(contact3.graphId).toBe('account2');
  });
});

describe('splitRequestsToMaxSize', () => {
  function singleRecordGraph(id: string, sobject = 'Account'): { graphId: string; compositeRequest: any[] } {
    return {
      graphId: id,
      compositeRequest: [{ method: 'POST', url: `/services/data/v62.0/sobjects/${sobject}`, referenceId: id, body: {} }],
    };
  }

  it('caps payloads at 75 graphs', () => {
    const graphs = Array.from({ length: 76 }, (_, i) => singleRecordGraph(`g${i}`));
    const payloads = splitRequestsToMaxSize(graphs, 500);
    expect(payloads.map((payload) => payload.length)).toEqual([75, 1]);
  });

  it('allows a payload of exactly maxSize records', () => {
    const graphs = [
      {
        graphId: 'a',
        compositeRequest: Array.from({ length: 300 }, (_, i) => ({ url: '/services/data/v62.0/sobjects/Account', referenceId: `a${i}` })),
      },
      {
        graphId: 'b',
        compositeRequest: Array.from({ length: 200 }, (_, i) => ({ url: '/services/data/v62.0/sobjects/Account', referenceId: `b${i}` })),
      },
    ] as any[];
    const payloads = splitRequestsToMaxSize(graphs, 500);
    expect(payloads).toHaveLength(1);
  });

  it('splits when records exceed maxSize', () => {
    const graphs = [
      {
        graphId: 'a',
        compositeRequest: Array.from({ length: 300 }, (_, i) => ({ url: '/services/data/v62.0/sobjects/Account', referenceId: `a${i}` })),
      },
      {
        graphId: 'b',
        compositeRequest: Array.from({ length: 201 }, (_, i) => ({ url: '/services/data/v62.0/sobjects/Account', referenceId: `b${i}` })),
      },
    ] as any[];
    const payloads = splitRequestsToMaxSize(graphs, 500);
    expect(payloads.map((payload) => payload.length)).toEqual([1, 1]);
  });

  it('seeds the object count for each new payload (distinct-object cap regression)', () => {
    const graphs = Array.from({ length: 30 }, (_, i) => singleRecordGraph(`g${i}`, `Object${i}__c`));
    const payloads = splitRequestsToMaxSize(graphs, 500);
    // 14 distinct objects per payload; before the fix the 2nd payload took 15 because its first item's objects were not counted
    expect(payloads.map((payload) => payload.length)).toEqual([14, 14, 2]);
  });
});

describe('buildRetryRequests', () => {
  async function buildLoadedRequests(): Promise<LoadMultiObjectRequestWithResult[]> {
    const datasets = await parseDatasets(buildTemplateWorkbook());
    return buildDataGraph(datasets, API_VERSION, GRAPH_OPTIONS).requests;
  }

  it('returns an empty array when nothing failed', async () => {
    const requests = await buildLoadedRequests();
    requests.forEach((request) => {
      Object.values(request.dataWithResultsByGraphId).forEach((graphResult) => {
        graphResult.isSuccess = true;
      });
    });

    expect(buildRetryRequests(requests)).toEqual([]);
  });

  it('rebuilds only the failed groups with record context preserved', async () => {
    const requests = await buildLoadedRequests();
    requests[0].dataWithResultsByGraphId['account1'].isSuccess = true;
    requests[0].dataWithResultsByGraphId['account2'].isSuccess = false;

    const retryRequests = buildRetryRequests(requests);

    expect(retryRequests).toHaveLength(1);
    expect(retryRequests[0].key).toBe('retry-0');
    expect(retryRequests[0].data).toHaveLength(1);
    expect(retryRequests[0].data[0].graphId).toBe('account2');

    const contact3 = retryRequests[0].recordWithResponseByRefId['contact3'];
    expect(contact3.worksheet).toBe('Create Contacts');
    expect(contact3.response).toBeNull();
  });

  it('treats every group in a request that failed at the HTTP level as failed', async () => {
    const requests = await buildLoadedRequests();
    requests[0].errorMessage = 'Something went wrong';

    const retryRequests = buildRetryRequests(requests);

    expect(retryRequests).toHaveLength(1);
    expect(retryRequests[0].data).toHaveLength(2);
  });
});
