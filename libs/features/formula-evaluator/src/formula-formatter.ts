/**
 * Pretty-printing for Salesforce formulas.
 *
 * There is no formula parser available in the browser, so prettier's JavaScript (babel) parser is used
 * as a stand-in — formula syntax overlaps enough with JS expressions for indentation and line breaking
 * to come out right. The trade-off is that prettier applies JavaScript conventions that are invalid in
 * a formula, so the options below and the post-processing exist purely to undo them:
 *
 * - `singleQuote` MUST stay false. Salesforce string literals require double quotes, so rewriting
 *   `"..."` to `'...'` turns a working formula into one that fails to deploy.
 * - `semi: false` makes prettier prepend an ASI-guard `;` when the expression could otherwise continue
 *   a preceding line (any top-level `&` concatenation hits this). That leading `;` is stripped below.
 *
 * Formulas using syntax that is not valid JavaScript (`<>`, for example) fail to parse; the caller
 * treats that as "leave the formula alone".
 */
export async function formatSalesforceFormula(formula: string): Promise<string> {
  const prettier = await import('prettier/standalone');
  const prettierPluginBabel = await import('prettier/plugins/babel');
  const prettierPluginEstree = await import('prettier/plugins/estree');

  const formatted = await prettier.format(formula, {
    parser: 'babel',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    plugins: [prettierPluginBabel, prettierPluginEstree as any],
    bracketSpacing: false,
    semi: false,
    singleQuote: false,
    trailingComma: 'none',
    useTabs: false,
    tabWidth: 2,
  });

  return stripLeadingSemicolon(formatted);
}

/**
 * Remove the ASI-guard semicolon prettier adds ahead of the expression. It is only ever emitted once,
 * at the very start of the output, and is a syntax error in a Salesforce formula.
 */
function stripLeadingSemicolon(formatted: string): string {
  return formatted.replace(/^(\s*);/, '$1');
}
