import { UpdateStatus } from '@jetstream/desktop/types';

/**
 * electron-updater throws this code when a downloaded update's signing certificate does not
 * match the publisherName the currently-installed app was built with. This happens after we
 * rotate our code-signing certificate — the auto-updater cannot verify the new signature, so
 * the user must download and reinstall the app manually.
 */
export const INVALID_SIGNATURE_ERROR_CODE = 'ERR_UPDATER_INVALID_SIGNATURE';

/**
 * Fallback matcher for the electron-updater signature-mismatch message, used for builds/versions
 * that surface the message but not a structured error code.
 */
const INVALID_SIGNATURE_MESSAGE_PATTERN = /is not signed by the application owner/i;

/**
 * Returns true when an update failed because the downloaded build was signed with a different
 * certificate than the installed app expects. In that case the auto-updater can never succeed and
 * the user must manually download a fresh build (no data is lost), so we show tailored guidance
 * instead of a generic "try again" error.
 */
export function isManualUpdateRequiredError(updateStatus: UpdateStatus): boolean {
  if (updateStatus.status !== 'error') {
    return false;
  }
  if (updateStatus.errorCode === INVALID_SIGNATURE_ERROR_CODE) {
    return true;
  }
  return !!updateStatus.error && INVALID_SIGNATURE_MESSAGE_PATTERN.test(updateStatus.error);
}
