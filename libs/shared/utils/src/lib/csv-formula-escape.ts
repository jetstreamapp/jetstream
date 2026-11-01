/**
 * Matches a CSV cell value that a spreadsheet would evaluate as a formula. Pass it as papaparse's `escapeFormulae`
 * option, which then prefixes matching values with a single quote.
 *
 * Use this instead of `escapeFormulae: true`: papaparse compiles the boolean to `/^[=+\-@\t\r].*$/`, and because `.`
 * does not match a line break and `$` is not multiline, a value with a line break anywhere after the trigger
 * character is left unescaped.
 */
export const CSV_FORMULA_ESCAPE_REGEX = /^[=+\-@\t\r]/;

const ESCAPED_CSV_FORMULA_REGEX = /^'[=+\-@\t\r]/;

/**
 * Reverses {@link CSV_FORMULA_ESCAPE_REGEX} escaping for a value read back from a CSV file that Jetstream exported,
 * so an exported file can be re-imported unchanged. Only a single quote directly before a formula trigger is removed.
 */
export function unescapeCsvFormula<T>(value: T): T {
  if (typeof value === 'string' && ESCAPED_CSV_FORMULA_REGEX.test(value)) {
    return value.slice(1) as T;
  }
  return value;
}
