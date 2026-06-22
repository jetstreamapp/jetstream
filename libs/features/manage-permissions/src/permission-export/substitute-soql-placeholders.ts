/**
 * Replaces `{{token}}` placeholders in SOQL templates (legacy `sf_permissions_analysis` style).
 *
 * @param soql SOQL string possibly containing `{{name}}` style placeholders.
 * @param vars Map of placeholder name (without braces) to replacement text (already escaped for SOQL if needed).
 */
export function substituteSoqlPlaceholders(soql: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce((acc, [key, value]) => {
    const pattern = new RegExp(`\\{\\{\\s*${escapeRegExp(key)}\\s*\\}\\}`, 'g');
    return acc.replace(pattern, value);
  }, soql);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
