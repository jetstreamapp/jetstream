import { describe, expect, test } from 'vitest';
import { buildEditedRecordsExport, buildPriorRecordsExport, getRecordId, rowChangedColumn } from '../data-table-history-export';
import { RowSalesforceRecordWithKey } from '../grid/grid-types';

function row(overrides: Partial<RowSalesforceRecordWithKey> & { _key: string; _record: Record<string, any> }): RowSalesforceRecordWithKey {
  return {
    _touchedColumns: new Set<string>(),
    _fieldErrors: {},
    _fieldWarnings: {},
    _recordErrors: [],
    ...overrides,
  } as RowSalesforceRecordWithKey;
}

describe('getRecordId', () => {
  test('prefers the id parsed from the record url, falling back to Id', () => {
    expect(getRecordId(row({ _key: 'r', _record: { attributes: { url: '/x/0016g00000ETu0IAAT' } } }))).toBe('0016g00000ETu0IAAT');
    expect(getRecordId(row({ _key: 'r', _record: { Id: '001FALLBACK' } }))).toBe('001FALLBACK');
  });
});

describe('rowChangedColumn', () => {
  test('is true only when a touched column differs from the original record value', () => {
    const changed = row({ _key: 'r', _record: { Name: 'Old' }, Name: 'New', _touchedColumns: new Set(['Name']) });
    const unchanged = row({ _key: 'r', _record: { Name: 'Same' }, Name: 'Same', _touchedColumns: new Set(['Name']) });
    const untouched = row({ _key: 'r', _record: { Name: 'Old' }, Name: 'New' });
    expect(rowChangedColumn(changed, 'Name')).toBe(true);
    expect(rowChangedColumn(unchanged, 'Name')).toBe(false);
    expect(rowChangedColumn(untouched, 'Name')).toBe(false);
  });
});

describe('buildPriorRecordsExport', () => {
  test('emits the ORIGINAL value of each changed field, aligned with the edited export columns', () => {
    const dirty = [
      row({
        _key: 'r0',
        _record: { Name: 'Old', AccountNumber: 'AN-old', attributes: { url: '/x/0016g00000ETu0IAAT' } },
        Name: 'New',
        AccountNumber: 'AN-new',
        _touchedColumns: new Set(['Name', 'AccountNumber']),
      }),
      row({
        _key: 'r1',
        _record: { Name: 'Keep', attributes: { url: '/x/0016g00000ETu0HAAT' } },
        Name: 'Renamed',
        _touchedColumns: new Set(['Name']),
      }),
    ];

    const edited = buildEditedRecordsExport(dirty);
    const prior = buildPriorRecordsExport(dirty);

    // Same header + row alignment as the edited export, so the two are a true before/after pair.
    expect(prior.header).toEqual(edited.header);
    expect(prior.header).toEqual(['Id', 'Name', 'AccountNumber']);
    expect(prior.data).toEqual([
      { Id: '0016g00000ETu0IAAT', Name: 'Old', AccountNumber: 'AN-old' },
      { Id: '0016g00000ETu0HAAT', Name: 'Keep' },
    ]);
  });
});
