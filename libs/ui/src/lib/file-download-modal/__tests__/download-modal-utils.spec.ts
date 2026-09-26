import { beforeEach, describe, expect, test, vi } from 'vitest';
import { fireToast } from '../../toast/AppToast';
import {
  getWhichRecordsDefaultValue,
  hasSelectableSubset,
  notifyExcelCellsTruncated,
  RADIO_ALL_BROWSER,
  RADIO_ALL_SERVER,
  RADIO_SELECTED,
} from '../download-modal-utils';

vi.mock('../../toast/AppToast', () => ({ fireToast: vi.fn() }));

const records = [{ Id: '1' }, { Id: '2' }, { Id: '3' }];

describe('hasSelectableSubset', () => {
  test('returns false when the subset is not an array', () => {
    expect(hasSelectableSubset(undefined, records)).toBe(false);
    expect(hasSelectableSubset(null, records)).toBe(false);
  });

  test('returns false when the subset is empty', () => {
    expect(hasSelectableSubset([], records)).toBe(false);
  });

  test('returns true when the subset is a strict subset of the records', () => {
    expect(hasSelectableSubset(records.slice(0, 1), records)).toBe(true);
    expect(hasSelectableSubset(records.slice(0, 2), records)).toBe(true);
  });

  test('returns false when the subset matches the full record set', () => {
    expect(hasSelectableSubset([...records], records)).toBe(false);
  });
});

describe('getWhichRecordsDefaultValue', () => {
  test('defaults to all records in browser when nothing is selected and all records are loaded', () => {
    expect(getWhichRecordsDefaultValue({ hasMoreRecords: false, records, selectedRecords: undefined })).toBe(RADIO_ALL_BROWSER);
    expect(getWhichRecordsDefaultValue({ hasMoreRecords: false, records, selectedRecords: [] })).toBe(RADIO_ALL_BROWSER);
  });

  test('defaults to all records from server when nothing is selected and more records exist', () => {
    expect(getWhichRecordsDefaultValue({ hasMoreRecords: true, records, selectedRecords: undefined })).toBe(RADIO_ALL_SERVER);
    expect(getWhichRecordsDefaultValue({ hasMoreRecords: true, records, selectedRecords: [] })).toBe(RADIO_ALL_SERVER);
  });

  test('defaults to selected records when some, but not all, records are selected', () => {
    expect(getWhichRecordsDefaultValue({ hasMoreRecords: false, records, selectedRecords: records.slice(0, 1) })).toBe(RADIO_SELECTED);
    expect(getWhichRecordsDefaultValue({ hasMoreRecords: true, records, selectedRecords: records.slice(0, 2) })).toBe(RADIO_SELECTED);
  });

  test('ignores the selection when every loaded record is selected, since the "Selected records" option is hidden', () => {
    expect(getWhichRecordsDefaultValue({ hasMoreRecords: false, records, selectedRecords: [...records] })).toBe(RADIO_ALL_BROWSER);
    expect(getWhichRecordsDefaultValue({ hasMoreRecords: true, records, selectedRecords: [...records] })).toBe(RADIO_ALL_SERVER);
  });
});

describe('notifyExcelCellsTruncated', () => {
  const getToastMessage = () => vi.mocked(fireToast).mock.calls[0][0].message;

  beforeEach(() => {
    vi.mocked(fireToast).mockClear();
  });

  test('points at both full-value formats when the download offers them', () => {
    notifyExcelCellsTruncated(2, ['xlsx', 'csv', 'json', 'gdrive']);
    expect(getToastMessage()).toMatch(/2 values exceeded .* and were truncated\. Download as CSV or JSON to get the full values\.$/);
  });

  test('only names the formats the download offers', () => {
    notifyExcelCellsTruncated(1, ['csv', 'xlsx', 'gdrive']);
    expect(getToastMessage()).toMatch(/1 value exceeded .* and was truncated\. Download as CSV to get the full values\.$/);
  });

  test('omits the hint when no full-value format is offered', () => {
    notifyExcelCellsTruncated(3, new Set(['xlsx']));
    expect(getToastMessage()).toMatch(/and were truncated\.$/);
  });
});
