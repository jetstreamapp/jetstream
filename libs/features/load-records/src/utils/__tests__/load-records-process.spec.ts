import {
  BatchCsv,
  MAX_BATCH_CSV_CHARS,
  MAX_CONSECUTIVE_FAILURES,
  generateSizeCappedBatchCsvs,
  isFatalBulkApiError,
} from '../load-records-process';

describe('MAX_CONSECUTIVE_FAILURES', () => {
  it('should equal 5', () => {
    expect(MAX_CONSECUTIVE_FAILURES).toBe(5);
  });
});

describe('generateSizeCappedBatchCsvs', () => {
  /** Every record must appear in exactly one batch, and each batch's reported range must contain it */
  function expectRangesCoverEveryRecordExactlyOnce(batches: BatchCsv[], records: { Id: string }[]) {
    records.forEach(({ Id }, recordIndex) => {
      const matchingBatches = batches.filter(({ csv }) => csv.includes(`${Id},`));
      expect(matchingBatches).toHaveLength(1);
      const [{ startIndex, recordCount }] = matchingBatches;
      expect(recordIndex).toBeGreaterThanOrEqual(startIndex);
      expect(recordIndex).toBeLessThan(startIndex + recordCount);
    });
    expect(batches.reduce((total, { recordCount }) => total + recordCount, 0)).toBe(records.length);
  }

  it('splits by record count when all batches are within the size cap', () => {
    const records = Array.from({ length: 10 }, (_, i) => ({ Id: `rec-${i}`, Name: `Record ${i}` }));

    const batches = generateSizeCappedBatchCsvs(records, 3);

    expect(batches).toHaveLength(4);
    expect(batches.map(({ startIndex, recordCount }) => [startIndex, recordCount])).toEqual([
      [0, 3],
      [3, 3],
      [6, 3],
      [9, 1],
    ]);
    // Every record lands in exactly one batch and each batch repeats the header
    expectRangesCoverEveryRecordExactlyOnce(batches, records);
    batches.forEach(({ csv }) => expect(csv.startsWith('Id')).toBe(true));
  });

  it('halves batches whose CSV exceeds the character cap', () => {
    // 8 records x ~2M chars each = ~16M chars in one count-based batch, which must split into two
    const bigValue = 'x'.repeat(2_000_000);
    const records = Array.from({ length: 8 }, (_, i) => ({ Id: `rec-${i}`, Description: bigValue }));

    const batches = generateSizeCappedBatchCsvs(records, 8);

    expect(batches.length).toBeGreaterThan(1);
    batches.forEach(({ csv }) => expect(csv.length).toBeLessThanOrEqual(MAX_BATCH_CSV_CHARS));
    expectRangesCoverEveryRecordExactlyOnce(batches, records);
  });

  it('reports contiguous ranges when a split batch is followed by more count-based batches', () => {
    // First batch of 4 is oversized and splits into 2+2; the remaining batches must still report
    // ranges into the original record array so results can be mapped back to records.
    const bigValue = 'x'.repeat(3_000_000);
    const records = Array.from({ length: 12 }, (_, i) => ({ Id: `rec-${i}`, Description: i < 4 ? bigValue : 'small' }));

    const batches = generateSizeCappedBatchCsvs(records, 4);

    expect(batches.map(({ startIndex, recordCount }) => [startIndex, recordCount])).toEqual([
      [0, 2],
      [2, 2],
      [4, 4],
      [8, 4],
    ]);
    expectRangesCoverEveryRecordExactlyOnce(batches, records);
  });

  it('passes through a single record that alone exceeds the cap', () => {
    const records = [{ Id: 'rec-0', Description: 'x'.repeat(MAX_BATCH_CSV_CHARS + 100) }];

    const batches = generateSizeCappedBatchCsvs(records, 100);

    expect(batches).toHaveLength(1);
    expect(batches[0]).toEqual(expect.objectContaining({ startIndex: 0, recordCount: 1 }));
    expect(batches[0].csv.length).toBeGreaterThan(MAX_BATCH_CSV_CHARS);
  });
});

describe('isFatalBulkApiError', () => {
  describe('fatal error patterns', () => {
    it('should detect ApiBatchItems Limit exceeded', () => {
      expect(isFatalBulkApiError(new Error('ApiBatchItems Limit exceeded'))).toBe(true);
    });

    it('should detect InvalidBatch errors', () => {
      expect(isFatalBulkApiError(new Error('InvalidBatch : Some batch was invalid'))).toBe(true);
    });

    it('should detect InvalidJob errors', () => {
      expect(isFatalBulkApiError(new Error('InvalidJob : job not found'))).toBe(true);
    });

    it('should detect ExceededQuota errors', () => {
      expect(isFatalBulkApiError(new Error('ExceededQuota'))).toBe(true);
    });

    it('should detect Job is in invalid state errors', () => {
      expect(isFatalBulkApiError(new Error('Job is in invalid state'))).toBe(true);
    });

    it('should detect Job already aborted', () => {
      expect(isFatalBulkApiError(new Error('Job already aborted'))).toBe(true);
    });

    it('should detect Job already closed', () => {
      expect(isFatalBulkApiError(new Error('Job already closed'))).toBe(true);
    });

    it('should detect Job already completed', () => {
      expect(isFatalBulkApiError(new Error('Job already completed'))).toBe(true);
    });
  });

  describe('case insensitivity', () => {
    it('should match ApiBatchItems Limit exceeded regardless of case', () => {
      expect(isFatalBulkApiError(new Error('apibatchitems limit exceeded'))).toBe(true);
      expect(isFatalBulkApiError(new Error('APIBATCHITEMS LIMIT EXCEEDED'))).toBe(true);
    });

    it('should match InvalidBatch regardless of case', () => {
      expect(isFatalBulkApiError(new Error('invalidbatch'))).toBe(true);
      expect(isFatalBulkApiError(new Error('INVALIDBATCH'))).toBe(true);
    });

    it('should match InvalidJob regardless of case', () => {
      expect(isFatalBulkApiError(new Error('invalidjob'))).toBe(true);
    });

    it('should match ExceededQuota regardless of case', () => {
      expect(isFatalBulkApiError(new Error('exceededquota'))).toBe(true);
    });

    it('should match Job is in invalid state regardless of case', () => {
      expect(isFatalBulkApiError(new Error('JOB IS IN INVALID STATE'))).toBe(true);
    });

    it('should match Job already aborted/closed/completed regardless of case', () => {
      expect(isFatalBulkApiError(new Error('JOB ALREADY ABORTED'))).toBe(true);
      expect(isFatalBulkApiError(new Error('JOB ALREADY CLOSED'))).toBe(true);
      expect(isFatalBulkApiError(new Error('JOB ALREADY COMPLETED'))).toBe(true);
    });
  });

  describe('non-fatal errors', () => {
    it('should return false for a generic network error', () => {
      expect(isFatalBulkApiError(new Error('Network request failed'))).toBe(false);
    });

    it('should return false for a timeout error', () => {
      expect(isFatalBulkApiError(new Error('Request timed out'))).toBe(false);
    });

    it('should return false for an unrelated Salesforce error', () => {
      expect(isFatalBulkApiError(new Error('FIELD_CUSTOM_VALIDATION_EXCEPTION: Validation failed'))).toBe(false);
    });

    it('should return false for an empty error message', () => {
      expect(isFatalBulkApiError(new Error(''))).toBe(false);
    });
  });

  describe('error input types', () => {
    it('should handle a plain Error object', () => {
      expect(isFatalBulkApiError(new Error('InvalidJob'))).toBe(true);
    });

    it('should handle a non-Error object (serialized via JSON.stringify)', () => {
      // getErrorMessage JSON.stringifies non-Error values
      // The serialized form of { message: 'InvalidJob' } contains "InvalidJob"
      expect(isFatalBulkApiError({ message: 'InvalidJob' })).toBe(true);
    });

    it('should return false for a non-Error object with non-fatal message', () => {
      expect(isFatalBulkApiError({ code: 500, reason: 'Internal error' })).toBe(false);
    });

    it('should handle null without throwing', () => {
      expect(isFatalBulkApiError(null)).toBe(false);
    });

    it('should handle undefined without throwing', () => {
      expect(isFatalBulkApiError(undefined)).toBe(false);
    });

    it('should handle a number without throwing', () => {
      expect(isFatalBulkApiError(42)).toBe(false);
    });
  });
});
