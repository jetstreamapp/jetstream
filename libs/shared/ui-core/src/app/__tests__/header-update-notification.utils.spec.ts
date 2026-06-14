import { UpdateStatus } from '@jetstream/desktop/types';
import { INVALID_SIGNATURE_ERROR_CODE, isManualUpdateRequiredError } from '../header-update-notification.utils';

describe('header-update-notification.utils#isManualUpdateRequiredError', () => {
  test('returns true when the error code is the signature-mismatch code', () => {
    const status: UpdateStatus = {
      status: 'error',
      error: 'Some message without the known phrase',
      errorCode: INVALID_SIGNATURE_ERROR_CODE,
    };
    expect(isManualUpdateRequiredError(status)).toBe(true);
  });

  test('returns true when the message matches the signature-mismatch phrase (no error code)', () => {
    const status: UpdateStatus = {
      status: 'error',
      error: 'New version 4.1.0 is not signed by the application owner: publisherNames: JETSTREAM SOLUTIONS, LLC, raw info: { ... }',
    };
    expect(isManualUpdateRequiredError(status)).toBe(true);
  });

  test('matches the signature phrase case-insensitively', () => {
    const status: UpdateStatus = {
      status: 'error',
      error: 'IS NOT SIGNED BY THE APPLICATION OWNER',
    };
    expect(isManualUpdateRequiredError(status)).toBe(true);
  });

  test('returns false for a generic (e.g. network) update error', () => {
    const status: UpdateStatus = {
      status: 'error',
      error: 'Failed to check for updates',
      errorCode: 'ERR_UPDATER_CHANNEL_FILE_NOT_FOUND',
    };
    expect(isManualUpdateRequiredError(status)).toBe(false);
  });

  test('returns false for an error status with no error details', () => {
    expect(isManualUpdateRequiredError({ status: 'error' })).toBe(false);
  });

  test.each(['idle', 'checking', 'available', 'downloading', 'ready', 'up-to-date'] as const)(
    'returns false for non-error status: %s',
    (statusType) => {
      // Even if a stale signature error string lingers, a non-error status must not trigger manual-update UI.
      const status: UpdateStatus = {
        status: statusType,
        error: 'is not signed by the application owner',
        errorCode: INVALID_SIGNATURE_ERROR_CODE,
      };
      expect(isManualUpdateRequiredError(status)).toBe(false);
    },
  );
});
