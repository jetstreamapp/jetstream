/**
 * Matches a CSV cell value that a spreadsheet would evaluate as a formula. Pass it as papaparse's `escapeFormulae`
 * option, which then prefixes matching values with a single quote.
 *
 * Use this instead of `escapeFormulae: true`: papaparse compiles the boolean to `/^[=+\-@\t\r].*$/`, and because `.`
 * does not match a line break and `$` is not multiline, a value with a line break anywhere after the trigger
 * character is left unescaped.
 *
 * A value that already reads as an escaped formula (`'=1+1`, or any number of quotes before the trigger) is escaped
 * as well (`''=1+1`), so that {@link unescapeCsvFormula} can always remove exactly one quote and an export imports
 * back unchanged.
 */
export const CSV_FORMULA_ESCAPE_REGEX = /^'*[=+\-@\t\r]/;

const ESCAPED_CSV_FORMULA_REGEX = /^'+[=+\-@\t\r]/;

/**
 * Reverses {@link CSV_FORMULA_ESCAPE_REGEX} escaping for a value read back from a CSV file that Jetstream exported,
 * so an exported file can be re-imported unchanged. Only a single leading quote is removed, and only when quotes are
 * all that stand between it and a formula trigger; a quote anywhere else is content.
 */
export function unescapeCsvFormula<T>(value: T): T {
  if (typeof value === 'string' && ESCAPED_CSV_FORMULA_REGEX.test(value)) {
    return value.slice(1) as T;
  }
  return value;
}
