import { substituteSoqlPlaceholders } from './substitute-soql-placeholders';

export type PermissionExportQueryKind = 'data' | 'tooling';

/**
 * Prepares SOQL from a template string for execution via Jetstream HTTP (not CLI).
 * Server-side export jobs run equivalent queries from `apps/api/.../soql-templates.ts`
 * (see `soql/*.soql` in this folder for reviewer-friendly copies).
 *
 * @param template Raw SOQL with `{{placeholders}}`.
 * @param vars Placeholder values.
 * @param kind Whether the query targets the Data or Tooling API (caller chooses transport).
 */
export function buildPermissionExportSoql(
  template: string,
  vars: Record<string, string>,
  _kind: PermissionExportQueryKind = 'data',
): string {
  return substituteSoqlPlaceholders(template, vars);
}
