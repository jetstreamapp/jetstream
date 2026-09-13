import { getErrorMessage } from '@jetstream/shared/utils';
import { isXlsxError } from './shared-ui-utils';

const PASSWORD_PROTECTED_MESSAGE = `Your file is password protected, remove the password and try again.`;

/**
 * User-facing message for a file that could not be read.
 *
 * The spreadsheet engine classifies what the file actually is (encrypted, a legacy .xls, .xlsb, .ods, or not a
 * spreadsheet at all) and its messages already name the fix, so they are shown as written. Everything else is a
 * genuinely unexpected failure and gets the generic prefix.
 *
 * The `password-protected` substring is a tested contract of the engine, kept here as a fallback for an error
 * that lost its prototype crossing a realm boundary.
 */
export function getFileParseErrorMessage(error: unknown): string {
  const message = getErrorMessage(error);
  if (isXlsxError(error)) {
    return error.code === 'ENCRYPTED' ? PASSWORD_PROTECTED_MESSAGE : message;
  }
  if (message.includes('password-protected')) {
    return PASSWORD_PROTECTED_MESSAGE;
  }
  return `There was an error reading your file. ${message}`;
}
