import { describe, expect, it } from 'vitest';
import { buildBulkJobHistoryCounts } from '../data-history-bulk-results';

describe('buildBulkJobHistoryCounts', () => {
  it('anchors total on what was submitted and derives failure from it, not from the job', () => {
    // 1,000 submitted, 600 never sent: the job only ever saw 400 and reports 400/0
    expect(
      buildBulkJobHistoryCounts({ numberRecordsProcessed: 400, numberRecordsFailed: 0 }, { submitted: 1000, processingErrors: 0 }),
    ).toEqual({ total: 1000, success: 400, failure: 600, processingErrors: 0 });
  });

  it('subtracts the job-reported failures from processed to get success', () => {
    expect(
      buildBulkJobHistoryCounts({ numberRecordsProcessed: 100, numberRecordsFailed: 30 }, { submitted: 100, processingErrors: 5 }),
    ).toEqual({ total: 100, success: 70, failure: 30, processingErrors: 5 });
  });

  it('clamps success to the submitted count so an over-reporting job cannot drive failure negative', () => {
    expect(
      buildBulkJobHistoryCounts({ numberRecordsProcessed: 120, numberRecordsFailed: 0 }, { submitted: 100, processingErrors: 0 }),
    ).toEqual({ total: 100, success: 100, failure: 0, processingErrors: 0 });
  });

  it('treats missing job numbers as zero and never reports negative success', () => {
    expect(
      buildBulkJobHistoryCounts(
        { numberRecordsProcessed: undefined as unknown as number, numberRecordsFailed: 10 },
        { submitted: 50, processingErrors: 0 },
      ),
    ).toEqual({ total: 50, success: 0, failure: 50, processingErrors: 0 });
  });
});
