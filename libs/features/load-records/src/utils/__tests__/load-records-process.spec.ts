import {
  BULK_JOB_POLL_INITIAL_INTERVAL_MS,
  BULK_JOB_POLL_INTERVAL_STEP_MS,
  BULK_JOB_POLL_MAX_CHECKS,
  BULK_JOB_POLL_MAX_INTERVAL_MS,
  BatchCsv,
  MAX_BATCH_CSV_CHARS,
  MAX_CONSECUTIVE_FAILURES,
  generateSizeCappedBatchCsvs,
  getBulkJobPollInterval,
} from '../load-records-process';

describe('MAX_CONSECUTIVE_FAILURES', () => {
  it('should equal 5', () => {
    expect(MAX_CONSECUTIVE_FAILURES).toBe(5);
  });
});

describe('getBulkJobPollInterval', () => {
  it('starts at the initial interval', () => {
    expect(getBulkJobPollInterval(0)).toBe(BULK_JOB_POLL_INITIAL_INTERVAL_MS);
  });

  it('grows by one step per check', () => {
    expect(getBulkJobPollInterval(1)).toBe(BULK_JOB_POLL_INITIAL_INTERVAL_MS + BULK_JOB_POLL_INTERVAL_STEP_MS);
    expect(getBulkJobPollInterval(10)).toBe(BULK_JOB_POLL_INITIAL_INTERVAL_MS + 10 * BULK_JOB_POLL_INTERVAL_STEP_MS);
  });

  it('never exceeds the max interval', () => {
    expect(getBulkJobPollInterval(BULK_JOB_POLL_MAX_CHECKS)).toBe(BULK_JOB_POLL_MAX_INTERVAL_MS);
    expect(getBulkJobPollInterval(Number.MAX_SAFE_INTEGER)).toBe(BULK_JOB_POLL_MAX_INTERVAL_MS);
  });

  it('never gets faster as checks accumulate', () => {
    for (let checkCount = 1; checkCount < BULK_JOB_POLL_MAX_CHECKS; checkCount++) {
      expect(getBulkJobPollInterval(checkCount)).toBeGreaterThanOrEqual(getBulkJobPollInterval(checkCount - 1));
    }
  });

  it('keeps polling for well over the previous fixed 10 minute runway before giving up', () => {
    const totalPollingMs = Array.from({ length: BULK_JOB_POLL_MAX_CHECKS }, (_, checkCount) => getBulkJobPollInterval(checkCount)).reduce(
      (total, interval) => total + interval,
      0,
    );
    expect(totalPollingMs).toBeGreaterThan(30 * 60 * 1000);
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
