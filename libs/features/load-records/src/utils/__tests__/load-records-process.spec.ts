import { FATAL_BULK_ERROR_PATTERNS, MAX_CONSECUTIVE_FAILURES, isFatalBulkApiError } from '../load-records-process';

describe('FATAL_BULK_ERROR_PATTERNS', () => {
  it('should contain the expected number of patterns', () => {
    expect(FATAL_BULK_ERROR_PATTERNS).toHaveLength(6);
  });
});

describe('MAX_CONSECUTIVE_FAILURES', () => {
  it('should equal 5', () => {
    expect(MAX_CONSECUTIVE_FAILURES).toBe(5);
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
