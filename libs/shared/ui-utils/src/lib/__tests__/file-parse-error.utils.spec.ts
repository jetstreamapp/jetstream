import { XlsxError } from '@jetstreamapp/simple-excel';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { getFileParseErrorMessage } from '../file-parse-error.utils';
import { parseFile } from '../shared-ui-utils';

const ENCRYPTED_FIXTURE_PATH = 'libs/shared/ui-utils/src/lib/__tests__/fixtures/encrypted-password-test.xlsx';
const PASSWORD_MESSAGE = 'Your file is password protected, remove the password and try again.';

/** The test runner's working directory is either the workspace root or this project, so the root is found rather than assumed */
function readRepoFile(repoRelativePath: string): Uint8Array {
  let directory = process.cwd();
  while (!existsSync(join(directory, repoRelativePath))) {
    const parentDirectory = dirname(directory);
    if (parentDirectory === directory) {
      throw new Error(`Could not find "${repoRelativePath}" in any directory above ${process.cwd()}`);
    }
    directory = parentDirectory;
  }
  return new Uint8Array(readFileSync(join(directory, repoRelativePath)));
}

describe('getFileParseErrorMessage', () => {
  it('tells the user to remove the password when the workbook is encrypted', async () => {
    const error = await parseFile(readRepoFile(ENCRYPTED_FIXTURE_PATH)).catch((ex) => ex);

    expect(error).toBeInstanceOf(XlsxError);
    expect(error.code).toBe('ENCRYPTED');
    // The engine guarantees this wording, which is what the fallback below matches on
    expect(error.message).toContain('password-protected');
    expect(getFileParseErrorMessage(error)).toBe(PASSWORD_MESSAGE);
  });

  it('falls back to the message text when an encrypted error lost its class crossing a realm', () => {
    const plainError = new Error('This workbook is password-protected. Remove the password in Excel and save it again as .xlsx.');

    expect(getFileParseErrorMessage(plainError)).toBe(PASSWORD_MESSAGE);
  });

  it('shows the engine message as written for a format it cannot read, since it already names the fix', () => {
    const legacyMessage = 'This is a legacy Excel 97-2003 file (.xls). Open it in Excel and save it as .xlsx.';

    expect(getFileParseErrorMessage(new XlsxError('LEGACY_XLS', legacyMessage))).toBe(legacyMessage);
    expect(getFileParseErrorMessage(new XlsxError('XLSB', 'This is an Excel Binary Workbook (.xlsb).'))).toBe(
      'This is an Excel Binary Workbook (.xlsb).',
    );
    expect(getFileParseErrorMessage(new XlsxError('NOT_XLSX', 'This is not an .xlsx workbook (it looks like html).'))).toBe(
      'This is not an .xlsx workbook (it looks like html).',
    );
  });

  it('prefixes anything else, which has no user-facing message of its own', () => {
    expect(getFileParseErrorMessage(new Error('Unexpected token < in JSON'))).toBe(
      'There was an error reading your file. Unexpected token < in JSON',
    );
  });
});
