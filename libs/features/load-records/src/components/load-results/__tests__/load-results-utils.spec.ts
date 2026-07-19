import { BulkJobResultRecord, RecordResultWithRecord } from '@jetstream/types';
import { describe, expect, it } from 'vitest';
import { buildBatchApiResultRow, buildBulkApiResultRow, getLoadResultsHeader, LOAD_RESULTS_BASE_HEADER } from '../load-results-utils';

describe('getLoadResultsHeader', () => {
  it('prefixes the mapped field headers with the standard result columns', () => {
    expect(getLoadResultsHeader(['Name', 'Industry'])).toEqual(['_id', '_success', '_errors', 'Name', 'Industry']);
  });

  it('returns just the base header when there are no mapped fields', () => {
    expect(getLoadResultsHeader([])).toEqual(LOAD_RESULTS_BASE_HEADER);
  });
});

describe('buildBatchApiResultRow', () => {
  it('builds a success row using the returned record id and an empty error', () => {
    const record = { success: true, id: '001AAA', record: { Name: 'Acme', Industry: 'Tech' } } as RecordResultWithRecord;
    expect(buildBatchApiResultRow(record, ['Name', 'Industry'])).toEqual({
      _id: '001AAA',
      _success: true,
      _errors: '',
      Name: 'Acme',
      Industry: 'Tech',
    });
  });

  it('builds a failure row joining status codes with messages', () => {
    const record = {
      success: false,
      errors: [
        { statusCode: 'REQUIRED_FIELD_MISSING', message: 'Required fields are missing: [Name]', fields: ['Name'] },
        { statusCode: 'FIELD_CUSTOM_VALIDATION_EXCEPTION', message: 'Nope', fields: [] },
      ],
      record: { Name: '', Industry: 'Energy' },
    } as RecordResultWithRecord;
    expect(buildBatchApiResultRow(record, ['Name', 'Industry'])).toEqual({
      _id: '',
      _success: false,
      _errors: 'REQUIRED_FIELD_MISSING: Required fields are missing: [Name]\nFIELD_CUSTOM_VALIDATION_EXCEPTION: Nope',
      Name: '',
      Industry: 'Energy',
    });
  });

  it('decodes HTML entities embedded in error messages', () => {
    const record = {
      success: false,
      errors: [{ statusCode: 'DUPLICATE_VALUE', message: 'duplicate &amp; invalid', fields: [] }],
      record: { Name: 'Dup' },
    } as RecordResultWithRecord;
    expect(buildBatchApiResultRow(record, ['Name'])._errors).toBe('DUPLICATE_VALUE: duplicate & invalid');
  });
});

describe('buildBulkApiResultRow', () => {
  it('combines the Salesforce result with the submitted source record', () => {
    const resultRecord: BulkJobResultRecord = { Id: '001BBB', Success: true, Created: false, Error: null };
    expect(buildBulkApiResultRow(resultRecord, { Name: 'Globex', Industry: 'Energy' })).toEqual({
      _id: '001BBB',
      _success: true,
      _errors: '',
      Name: 'Globex',
      Industry: 'Energy',
    });
  });

  it('falls back to the source record Id and decodes the error', () => {
    const resultRecord: BulkJobResultRecord = { Id: null, Success: false, Created: false, Error: 'INVALID_FIELD:bad &amp; wrong' };
    expect(buildBulkApiResultRow(resultRecord, { Id: '001CCC', Name: 'Broken' })).toEqual({
      _id: '001CCC',
      _success: false,
      _errors: 'INVALID_FIELD:bad & wrong',
      Id: '001CCC',
      Name: 'Broken',
    });
  });

  it('uses a null id when neither the result nor the source record has one', () => {
    const resultRecord: BulkJobResultRecord = { Id: null, Success: false, Created: false, Error: 'boom' };
    expect(buildBulkApiResultRow(resultRecord, { Name: 'NoId' })._id).toBeNull();
  });
});
