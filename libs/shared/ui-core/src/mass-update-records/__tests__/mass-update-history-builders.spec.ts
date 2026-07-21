import { BulkJobResultRecord } from '@jetstream/types';
import { describe, expect, it } from 'vitest';
import { MetadataRowConfiguration } from '../mass-update-records.types';
import {
  buildMassUpdateCombinedResults,
  buildMassUpdateResultRow,
  getMassUpdateBatchSourceRecords,
  getMassUpdateResultsHeader,
} from '../mass-update-records.utils';

const configuration: MetadataRowConfiguration[] = [
  { selectedField: 'Industry', transformationOptions: { option: 'staticValue', staticValue: 'Tech', criteria: 'all', whereClause: '' } },
  { selectedField: 'Rating', transformationOptions: { option: 'staticValue', staticValue: 'Hot', criteria: 'all', whereClause: '' } },
];

describe('getMassUpdateResultsHeader', () => {
  it('prefixes the base result columns to Id + each selected field', () => {
    expect(getMassUpdateResultsHeader(configuration)).toEqual(['_id', '_success', '_errors', 'Id', 'Industry', 'Rating']);
  });
});

describe('buildMassUpdateResultRow', () => {
  it('combines a success result with the submitted source record', () => {
    const result: BulkJobResultRecord = { Id: '001A', Success: true, Created: false, Error: null };
    expect(buildMassUpdateResultRow(result, { Id: '001A', Industry: 'Tech' })).toEqual({
      _id: '001A',
      _success: true,
      _errors: '',
      Id: '001A',
      Industry: 'Tech',
    });
  });

  it('falls back to the source record Id and decodes the error', () => {
    const result: BulkJobResultRecord = { Id: null, Success: false, Created: false, Error: 'INVALID:bad &amp; wrong' };
    expect(buildMassUpdateResultRow(result, { Id: '001B', Industry: 'Energy' })).toEqual({
      _id: '001B',
      _success: false,
      _errors: 'INVALID:bad & wrong',
      Id: '001B',
      Industry: 'Energy',
    });
  });
});

describe('buildMassUpdateCombinedResults', () => {
  const results: BulkJobResultRecord[] = [
    { Id: '1', Success: true, Created: false, Error: null },
    { Id: '2', Success: false, Created: false, Error: 'boom' },
  ];
  const sourceRecords = [
    { Id: '1', Industry: 'A' },
    { Id: '2', Industry: 'B' },
  ];

  it('zips all results with source records when includeSuccesses is true (default)', () => {
    const combined = buildMassUpdateCombinedResults(results, sourceRecords);
    expect(combined).toHaveLength(2);
    expect(combined[0]).toMatchObject({ _id: '1', _success: true, Industry: 'A' });
  });

  it('keeps only failed rows when includeSuccesses is false', () => {
    const combined = buildMassUpdateCombinedResults(results, sourceRecords, { includeSuccesses: false });
    expect(combined).toHaveLength(1);
    expect(combined[0]).toMatchObject({ _id: '2', _success: false, Industry: 'B' });
  });
});

describe('getMassUpdateBatchSourceRecords', () => {
  it('slices the submitted records for a batch using batchIdToIndex * batchSize', () => {
    const records = Array.from({ length: 5 }, (_, i) => ({ Id: String(i) }));
    const batchIdToIndex = { batchA: 0, batchB: 1 };
    expect(getMassUpdateBatchSourceRecords(records, batchIdToIndex, 'batchB', 2)).toEqual([{ Id: '2' }, { Id: '3' }]);
  });
});
