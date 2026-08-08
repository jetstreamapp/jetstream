import { Field, SobjectCollectionResponse } from '@jetstream/types';
import { describe, expect, test } from 'vitest';
import { buildEditedRecordsExport, buildResultsExport } from '../data-table-history-export';
import { ColumnWithFilter, RowSalesforceRecordWithKey } from '../grid/grid-types';
import { buildRecordChangeList } from '../PreviewChangesModal';

function row(overrides: Partial<RowSalesforceRecordWithKey> & { _key: string; _record: Record<string, any> }): RowSalesforceRecordWithKey {
  return {
    _touchedColumns: new Set<string>(),
    _fieldErrors: {},
    _fieldWarnings: {},
    _recordErrors: [],
    ...overrides,
  } as RowSalesforceRecordWithKey;
}

const columns = [
  { key: 'Name', name: 'Name' },
  { key: 'Active', name: 'Active' },
  { key: 'Industry', name: 'Industry' },
] as ColumnWithFilter<RowSalesforceRecordWithKey>[];

const fieldMetadata = {
  name: { type: 'string', label: 'Account Name' } as Field,
  active: { type: 'boolean', label: 'Active' } as Field,
  industry: { type: 'string', label: 'Industry' } as Field,
} as any;

describe('buildRecordChangeList', () => {
  test('emits one row per record with a column per changed field (union across records)', () => {
    const dirty = [
      row({
        _key: 'r0',
        _record: { Name: 'Old', Active: false, attributes: { url: '/x/0016g00000ETu0IAAT' } },
        Name: 'New',
        Active: true,
        _touchedColumns: new Set(['Name', 'Active']),
      }),
      row({
        _key: 'r1',
        _record: { Industry: 'Tech', attributes: { url: '/x/0016g00000ETu0HAAT' } },
        Industry: 'Finance',
        _touchedColumns: new Set(['Industry']),
      }),
    ];

    const { rows, editedColumns, changeCount } = buildRecordChangeList(dirty, columns, fieldMetadata);
    expect(rows).toHaveLength(2);
    expect(changeCount).toBe(3);
    // Union of changed columns across both records.
    expect(editedColumns.map((column) => column.key)).toEqual(['Name', 'Active', 'Industry']);
    expect(editedColumns.find((column) => column.key === 'Name')?.label).toBe('Account Name');

    // New values render at the column key; only this record's changed columns are flagged.
    expect(rows[0].Name).toBe('New');
    expect(rows[0].Active).toBe('True');
    expect((rows[0]._changedColumns as Set<string>).has('Name')).toBe(true);
    expect((rows[0]._changedColumns as Set<string>).has('Industry')).toBe(false);
    expect(rows[0]._oldValues.Name).toBe('Old');
  });

  test('skips touched columns whose value reverted to the original', () => {
    const dirty = [
      row({ _key: 'r0', _record: { Name: 'Same', attributes: { url: '/x/001' } }, Name: 'Same', _touchedColumns: new Set(['Name']) }),
    ];
    const { editedColumns, changeCount } = buildRecordChangeList(dirty, columns, fieldMetadata);
    expect(editedColumns).toEqual([]);
    expect(changeCount).toBe(0);
  });

  test('renders empty/null new values as an em-dash and exposes the record id', () => {
    const dirty = [
      row({
        _key: 'r0',
        _record: { Name: 'Acme', attributes: { url: '/services/data/v60.0/sobjects/Account/0016g00000ETu0IAAT' } },
        Name: '',
        _touchedColumns: new Set(['Name']),
      }),
    ];
    const result = buildRecordChangeList(dirty, columns, fieldMetadata).rows[0];
    expect(result.Name).toBe('—');
    expect(result.recordId).toBe('0016g00000ETu0IAAT');
    expect(result.recordName).toBe('Acme');
  });

  test('aggregates field + record errors into a record-level status', () => {
    const dirty = [
      row({
        _key: 'r0',
        _record: { Name: 'Old', attributes: { url: '/x/001' } },
        Name: 'New',
        _touchedColumns: new Set(['Name']),
        _fieldErrors: { Name: 'Too long' },
        _recordErrors: ['Record locked'],
      }),
    ];
    const result = buildRecordChangeList(dirty, columns, fieldMetadata).rows[0];
    expect(result.severity).toBe('error');
    expect(result.status).toContain('Too long');
    expect(result.status).toContain('Record locked');
  });

  test('record name is blank (not the id) when the record has no Name', () => {
    const dirty = [
      row({
        _key: 'r0',
        _record: { Active: false, attributes: { url: '/x/0016g00000ETu0IAAT' } },
        Active: true,
        _touchedColumns: new Set(['Active']),
      }),
    ];
    const result = buildRecordChangeList(dirty, columns, fieldMetadata).rows[0];
    expect(result.recordName).toBe('');
    expect(result.recordId).toBe('0016g00000ETu0IAAT');
  });
});

describe('buildEditedRecordsExport', () => {
  test('header is Id + the union of edited fields; each row emits only the values it changed', () => {
    const dirty = [
      row({
        _key: 'r0',
        _record: { Name: 'Old', AccountNumber: '', attributes: { url: '/x/0016g00000ETu0IAAT' } },
        Name: 'New',
        AccountNumber: 'AN-1',
        _touchedColumns: new Set(['Name', 'AccountNumber']),
      }),
      row({
        _key: 'r1',
        _record: { Name: 'Keep', attributes: { url: '/x/0016g00000ETu0HAAT' } },
        Name: 'Renamed',
        _touchedColumns: new Set(['Name']),
      }),
    ];

    const { data, header } = buildEditedRecordsExport(dirty);
    expect(header).toEqual(['Id', 'Name', 'AccountNumber']);
    expect(data).toEqual([
      { Id: '0016g00000ETu0IAAT', Name: 'New', AccountNumber: 'AN-1' },
      // r1 only changed Name, so AccountNumber is omitted (blank in the file) rather than dumped.
      { Id: '0016g00000ETu0HAAT', Name: 'Renamed' },
    ]);
    expect(data[1]).not.toHaveProperty('AccountNumber');
  });

  // Regression: the export must be captured BEFORE a save commits values into `_record`. Mutating
  // `_record` to equal the edited value afterward (what the save does) would make a re-derived diff
  // drop the field — but a pre-captured export holds plain values and is immune to that mutation.
  test('captured values are immune to later _record mutation (the save commit)', () => {
    const dirty = [
      row({
        _key: 'r0',
        _record: { AccountNumber: 'old', attributes: { url: '/x/0016g00000ETu0IAAT' } },
        AccountNumber: 'Created by example trigger.',
        _touchedColumns: new Set(['AccountNumber']),
      }),
    ];

    const { data, header } = buildEditedRecordsExport(dirty);
    // Simulate the parent's save committing the edited value into the shared `_record` object.
    dirty[0]._record.AccountNumber = dirty[0].AccountNumber;

    expect(header).toEqual(['Id', 'AccountNumber']);
    expect(data).toEqual([{ Id: '0016g00000ETu0IAAT', AccountNumber: 'Created by example trigger.' }]);
  });
});

describe('buildResultsExport', () => {
  test('leads with _id/_success/_errors then the record fields, zipped to results by index', () => {
    const editedExport = {
      header: ['Id', 'AccountNumber'],
      data: [
        { Id: '001A', AccountNumber: 'AN-1' },
        { Id: '001B', AccountNumber: 'AN-2' },
      ],
    };
    const saveResults: SobjectCollectionResponse = [
      { id: '001A', success: true },
      { id: '001B', success: false, errors: [{ statusCode: 'FIELD_CUSTOM_VALIDATION_EXCEPTION', message: 'Boom', fields: [] }] },
    ] as any;

    const { data, header } = buildResultsExport(editedExport, saveResults);
    // Result columns first, record fields (Id + edited) at the end — matching the Load Records file.
    expect(header).toEqual(['_id', '_success', '_errors', 'Id', 'AccountNumber']);
    expect(data).toEqual([
      { _id: '001A', _success: true, _errors: '', Id: '001A', AccountNumber: 'AN-1' },
      { _id: '001B', _success: false, _errors: 'FIELD_CUSTOM_VALIDATION_EXCEPTION: Boom', Id: '001B', AccountNumber: 'AN-2' },
    ]);
  });
});
