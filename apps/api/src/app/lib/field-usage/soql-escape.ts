/**
 * Escape a string for use inside SOQL single-quoted literals.
 */
export function escapeSoqlStringLiteral(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}
