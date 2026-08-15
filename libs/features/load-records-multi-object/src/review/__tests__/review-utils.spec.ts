import { LoadMultiObjectData, LoadMultiObjectDataError, LoadMultiObjectGroupInfo } from '../../load-records-multi-object-types';
import { buildSheetPreviewData, getGroupNumbersByGraphId, getGroupSummary } from '../review-utils';

function buildDataset(overrides: Partial<LoadMultiObjectData> = {}): LoadMultiObjectData {
  return {
    worksheet: 'Sheet1',
    sobject: 'Account',
    operation: 'INSERT',
    data: [
      { 'Reference Id': 'rec1', Name: 'One' },
      { 'Reference Id': 'rec2', Name: 'Two' },
      { 'Reference Id': 'rec3', Name: 'Three' },
    ],
    dataById: {},
    referenceColumnHeader: 'Reference Id',
    headers: ['Name'],
    referenceHeaders: new Set(),
    metadata: {} as LoadMultiObjectData['metadata'],
    fieldsByName: {},
    errors: [],
    ...overrides,
  };
}

function buildError(overrides: Partial<LoadMultiObjectDataError> = {}): LoadMultiObjectDataError {
  return {
    property: 'data',
    worksheet: 'Sheet1',
    location: null,
    locationType: 'SHEET',
    message: 'Something is wrong',
    ...overrides,
  };
}

const GROUPS: Record<string, LoadMultiObjectGroupInfo> = {
  rec1: { graphId: 'rec1', size: 2 },
  rec2: { graphId: 'rec1', size: 2 },
  rec3: { graphId: 'rec3', size: 1 },
};

describe('getGroupNumbersByGraphId', () => {
  it('assigns sequential numbers by first appearance', () => {
    expect(getGroupNumbersByGraphId(GROUPS)).toEqual({ rec1: 1, rec3: 2 });
  });
});

describe('getGroupSummary', () => {
  it('counts distinct groups and the largest group size', () => {
    expect(getGroupSummary(GROUPS)).toEqual({ groupCount: 2, largestGroupSize: 2 });
  });

  it('handles empty groups', () => {
    expect(getGroupSummary({})).toEqual({ groupCount: 0, largestGroupSize: 0 });
  });
});

describe('buildSheetPreviewData', () => {
  it('builds rows with keys, reference ids, and group labels', () => {
    const { rows, bannerErrors, hasRowErrors } = buildSheetPreviewData({
      dataset: buildDataset(),
      errors: [],
      groupsByRefId: GROUPS,
      groupNumbersByGraphId: getGroupNumbersByGraphId(GROUPS),
    });

    expect(rows).toHaveLength(3);
    expect(rows[0]._key).toBe('Sheet1:0');
    expect(rows[0]._referenceId).toBe('rec1');
    expect(rows[0]._group).toBe('Group 1');
    expect(rows[0]._groupSize).toBe(2);
    expect(rows[2]._group).toBe('Group 2');
    expect(bannerErrors).toEqual([]);
    expect(hasRowErrors).toBe(false);
  });

  it('maps COLUMN errors with row indexes onto the correct rows and column', () => {
    const error = buildError({ locationType: 'COLUMN', location: 'A', header: 'Reference Id', rowIndexes: [1] });
    const { rows, bannerErrors, hasRowErrors } = buildSheetPreviewData({
      dataset: buildDataset(),
      errors: [error],
      groupsByRefId: {},
      groupNumbersByGraphId: {},
    });

    expect(rows[1]._fieldErrors).toEqual({ 'Reference Id': 'Something is wrong' });
    expect(rows[0]._fieldErrors).toBeUndefined();
    expect(bannerErrors).toEqual([]);
    expect(hasRowErrors).toBe(true);
  });

  it('maps CELL errors with row indexes to the reference column when no header is given', () => {
    const error = buildError({ locationType: 'CELL', location: 'A7', rowIndexes: [1] });
    const { rows } = buildSheetPreviewData({
      dataset: buildDataset(),
      errors: [error],
      groupsByRefId: {},
      groupNumbersByGraphId: {},
    });

    expect(rows[1]._fieldErrors).toEqual({ 'Reference Id': 'Something is wrong' });
  });

  it('maps ROW errors with row indexes to record-level status', () => {
    const error = buildError({ locationType: 'ROW', location: '7', rowIndexes: [1] });
    const { rows } = buildSheetPreviewData({
      dataset: buildDataset(),
      errors: [error],
      groupsByRefId: {},
      groupNumbersByGraphId: {},
    });

    expect(rows[1].status).toBe('Something is wrong');
    expect(rows[1].severity).toBe('error');
  });

  it('maps ROW errors without row indexes using the Excel row number offset', () => {
    const error = buildError({ locationType: 'ROW', location: '8' });
    const { rows } = buildSheetPreviewData({
      dataset: buildDataset(),
      errors: [error],
      groupsByRefId: {},
      groupNumbersByGraphId: {},
    });

    expect(rows[2].status).toBe('Something is wrong');
  });

  it('routes header-row and sheet-level errors to the banner', () => {
    const headerRowError = buildError({ locationType: 'ROW', location: '5' });
    const sheetError = buildError({ locationType: 'SHEET' });
    const configError = buildError({ locationType: 'CELL', location: 'B1' });
    const { rows, bannerErrors } = buildSheetPreviewData({
      dataset: buildDataset(),
      errors: [headerRowError, sheetError, configError],
      groupsByRefId: {},
      groupNumbersByGraphId: {},
    });

    expect(bannerErrors).toHaveLength(3);
    expect(rows.every(({ status, _fieldErrors }) => !status && !_fieldErrors)).toBe(true);
  });

  it('falls back to the banner when row indexes are out of range', () => {
    const error = buildError({ locationType: 'ROW', location: '99', rowIndexes: [50] });
    const { bannerErrors } = buildSheetPreviewData({
      dataset: buildDataset(),
      errors: [error],
      groupsByRefId: {},
      groupNumbersByGraphId: {},
    });

    expect(bannerErrors).toHaveLength(1);
  });

  it('separates warnings from errors and flags the columns they apply to', () => {
    const skippedColumn = buildError({
      locationType: 'COLUMN',
      location: 'Bogus__c',
      header: 'Bogus__c',
      severity: 'warning',
      message: 'The column "Bogus__c" will be skipped',
    });
    const blockingError = buildError({ locationType: 'SHEET' });
    const { warnings, skippedHeaders, bannerErrors, errorCount, rows } = buildSheetPreviewData({
      dataset: buildDataset(),
      errors: [skippedColumn, blockingError],
      groupsByRefId: {},
      groupNumbersByGraphId: {},
    });

    expect(warnings).toEqual([skippedColumn]);
    expect(skippedHeaders).toEqual(new Set(['Bogus__c']));
    // Warnings never block the load, so they stay out of the error banner and the error count
    expect(bannerErrors).toEqual([blockingError]);
    expect(errorCount).toBe(1);
    expect(rows.every(({ status, _fieldErrors }) => !status && !_fieldErrors)).toBe(true);
  });

  it('stacks multiple errors on the same cell and row', () => {
    const cellError1 = buildError({ locationType: 'COLUMN', location: 'A', header: 'Name', rowIndexes: [0], message: 'First' });
    const cellError2 = buildError({ locationType: 'COLUMN', location: 'A', header: 'Name', rowIndexes: [0], message: 'Second' });
    const { rows, errorCount } = buildSheetPreviewData({
      dataset: buildDataset(),
      errors: [cellError1, cellError2],
      groupsByRefId: {},
      groupNumbersByGraphId: {},
    });

    expect(rows[0]._fieldErrors?.['Name']).toBe('First\nSecond');
    expect(errorCount).toBe(2);
  });
});
