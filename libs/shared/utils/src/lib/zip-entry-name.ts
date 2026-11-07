import type { Maybe } from '@jetstream/types';

// eslint-disable-next-line no-control-regex -- intentionally stripping C0/DEL control chars from file names
const CONTROL_CHARS_REGEX = /[\x00-\x1f\x7f]/g;
const PATH_SEPARATORS_REGEX = /[/\\]+/;
const LEADING_DOTS_OR_WHITESPACE_REGEX = /^[.\s]+/;

/**
 * Reduce an untrusted file name (e.g. a Salesforce Attachment name or ContentVersion title) to a
 * single safe archive entry name, so a downloaded zip can never contain an entry that extracts
 * outside the chosen folder or into an unintended sub-folder.
 *
 * - directory separators (`/` and `\`) are replaced with `_`, and empty, `.` and `..` segments are dropped
 * - NUL and other control characters are removed
 * - leading dots and surrounding whitespace are trimmed
 * - `fallback` is returned when nothing usable is left
 */
export function sanitizeZipEntryName(name: Maybe<string>, fallback = ''): string {
  if (typeof name !== 'string') {
    return fallback;
  }
  const safeName = name
    .replace(CONTROL_CHARS_REGEX, '')
    .split(PATH_SEPARATORS_REGEX)
    .map((segment) => segment.trim())
    .filter((segment) => segment !== '' && segment !== '.' && segment !== '..')
    .join('_')
    .replace(LEADING_DOTS_OR_WHITESPACE_REGEX, '')
    .trim();
  return safeName || fallback;
}
