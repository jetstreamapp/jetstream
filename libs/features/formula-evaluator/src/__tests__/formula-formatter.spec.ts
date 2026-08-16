import { describe, expect, test } from 'vitest';
import { formatSalesforceFormula } from '../formula-formatter';

describe('formatSalesforceFormula', () => {
  test('preserves double quotes on string literals', async () => {
    // Single quotes are a syntax error in a Salesforce formula — rewriting them made "Format" produce
    // formulas that failed to deploy.
    const result = await formatSalesforceFormula('IF(Amount > 100, "High", "Low")');
    expect(result.trim()).toBe('IF(Amount > 100, "High", "Low")');
    expect(result).not.toContain("'");
  });

  test('preserves empty string literals', async () => {
    const result = await formatSalesforceFormula('IF(ISBLANK(Description), "", LEFT(Description, 10))');
    expect(result.trim()).toBe('IF(ISBLANK(Description), "", LEFT(Description, 10))');
  });

  test('does not emit a leading semicolon for concatenation formulas', async () => {
    const result = await formatSalesforceFormula('Name & " - " & TEXT(CloseDate)');
    expect(result.trim()).toBe('Name & " - " & TEXT(CloseDate)');
  });

  test('does not emit a leading semicolon for parenthesized formulas', async () => {
    const result = await formatSalesforceFormula('(Amount + Tax__c) * 2');
    expect(result.trim()).toBe('(Amount + Tax__c) * 2');
  });

  test('indents nested function calls without altering quotes', async () => {
    const formula =
      'IF(AND(ISPICKVAL(StageName,"Closed Won"), Amount > 10000), "Big Win: " & Name, IF(ISBLANK(Description), "None", LEFT(Description, 50)))';
    const result = await formatSalesforceFormula(formula);
    expect(result).not.toContain("'");
    expect(result).not.toMatch(/^\s*;/);
    expect(result).toContain('\n');
    expect(result).toContain('"Closed Won"');
  });

  test('rejects formula syntax that is not valid JavaScript so the caller can leave it alone', async () => {
    await expect(formatSalesforceFormula('Amount <> 0')).rejects.toThrow();
  });
});
