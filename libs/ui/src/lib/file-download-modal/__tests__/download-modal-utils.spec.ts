import { describe, expect, test } from 'vitest';
import {
  getDownloadRecordCount,
  getWhichRecordsDefaultValue,
  hasSelectableSubset,
  RADIO_ALL_BROWSER,
  RADIO_ALL_SERVER,
  RADIO_FILTERED,
  RADIO_SELECTED,
} from '../download-modal-utils';

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

describe('getDownloadRecordCount', () => {
  test('uses the query total for all records, since the rest are downloaded after the modal closes', () => {
    expect(getDownloadRecordCount({ downloadRecordsValue: RADIO_ALL_SERVER, totalRecordCount: 237_585, activeRecordCount: 2_000 })).toBe(
      237_585,
    );
  });

  test('uses the loaded records when the total is unknown, as it is for Big Objects', () => {
    expect(getDownloadRecordCount({ downloadRecordsValue: RADIO_ALL_SERVER, totalRecordCount: -1, activeRecordCount: 2_000 })).toBe(2_000);
    expect(getDownloadRecordCount({ downloadRecordsValue: RADIO_ALL_SERVER, totalRecordCount: undefined, activeRecordCount: 2_000 })).toBe(
      2_000,
    );
  });

  test('uses the records in the browser for every other option', () => {
    expect(getDownloadRecordCount({ downloadRecordsValue: RADIO_ALL_BROWSER, totalRecordCount: 237_585, activeRecordCount: 2_000 })).toBe(
      2_000,
    );
    expect(getDownloadRecordCount({ downloadRecordsValue: RADIO_SELECTED, totalRecordCount: 237_585, activeRecordCount: 10 })).toBe(10);
    expect(getDownloadRecordCount({ downloadRecordsValue: RADIO_FILTERED, totalRecordCount: 237_585, activeRecordCount: 50 })).toBe(50);
  });
});
