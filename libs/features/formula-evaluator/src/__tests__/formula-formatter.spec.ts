import { formatFormula } from '@jetstreamapp/sf-formula-parser';
import { describe, expect, test } from 'vitest';

/**
 * The "Format" action in the formula editor delegates entirely to sf-formula-parser. These cases guard
 * the behavior the editor depends on so a parser upgrade that regresses formatting is caught here rather
 * than by a user whose formula no longer deploys.
 */
describe('formatFormula', () => {
  test('preserves double quotes on string literals', () => {
    // Single quotes are a syntax error in a Salesforce formula — rewriting them made "Format" produce
    // formulas that failed to deploy.
    const result = formatFormula('IF(Amount > 100, "High", "Low")');
    expect(result.trim()).toBe('IF(Amount > 100, "High", "Low")');
    expect(result).not.toContain("'");
  });

  test('preserves empty string literals', () => {
    const result = formatFormula('IF(ISBLANK(Description), "", LEFT(Description, 10))');
    expect(result.trim()).toBe('IF(ISBLANK(Description), "", LEFT(Description, 10))');
  });

  test('leaves concatenation formulas intact', () => {
    const result = formatFormula('Name & " - " & TEXT(CloseDate)');
    expect(result.trim()).toBe('Name & " - " & TEXT(CloseDate)');
  });

  test('leaves parenthesized formulas intact', () => {
    const result = formatFormula('(Amount + Tax__c) * 2');
    expect(result.trim()).toBe('(Amount + Tax__c) * 2');
  });

  test('supports formula syntax that is not valid JavaScript', () => {
    expect(formatFormula('Amount <> 0').trim()).toBe('Amount <> 0');
  });

  test('indents nested function calls without altering quotes', () => {
    const formula =
      'IF(AND(ISPICKVAL(StageName,"Closed Won"), Amount > 10000), "Big Win: " & Name, IF(ISBLANK(Description), "None", LEFT(Description, 50)))';
    const result = formatFormula(formula);
    expect(result).not.toContain("'");
    expect(result).toContain('\n');
    expect(result).toContain('"Closed Won"');
  });

  test('throws for unparsable formulas so the caller can leave them alone', () => {
    expect(() => formatFormula('IF(Amount > 100, "High"')).toThrow();
  });
});
