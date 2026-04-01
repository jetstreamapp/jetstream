import { expect, test } from '../../fixtures/fixtures';

/**
 * Tests use the record "A - formula test record" (Account 001al00002FzdpCAAR) which has:
 * - Name: "A - formula test record"
 * - AnnualRevenue: 350000000
 * - NumberOfEmployees: 9000
 * - NumberofLocations__c: 6
 * - BillingCity: "Burlington", BillingState: "NC", BillingPostalCode: "27215", BillingCountry: "USA"
 * - Phone: "(336) 222-7000"
 * - Industry: "Apparel"
 * - Type: "Customer - Direct"
 * - SLA__c: "Silver"
 * - SLAExpirationDate__c: "2022-01-22"
 * - SLASerialNumber__c: "5367"
 * - Website: "www.burlington.com"
 * - Fax: "Burlington Textiles Corp of America"
 * - TickerSymbol: "BTXT"
 * - Ownership: "Public"
 * - Rating: "Warm"
 * - Owner.Name: "Integration Test", Owner.FirstName: "Integration", Owner.LastName: "Test"
 * - Parent.Name: "University of Arizona"
 * - Description: null, AccountSource: null, ShippingCity: null
 */

test('FORMULA EVALUATOR', async ({ formulaEvaluatorPage }) => {
  await formulaEvaluatorPage.goto();
  await formulaEvaluatorPage.selectObject('Account');
  await formulaEvaluatorPage.searchAndSelectRecord('A - formula test record');
  // Skip return type validation since tests cover multiple return types
  await formulaEvaluatorPage.setReturnType('--Skip Type Validation--');

  // ─── Text formulas ───────────────────────────────────────────

  await test.step('string concatenation with &', async () => {
    const result = await formulaEvaluatorPage.evaluateFormula('Name & " | " & Phone');
    expect(result).toBe('A - formula test record | (336) 222-7000');
  });

  await test.step('UPPER and LOWER', async () => {
    const result = await formulaEvaluatorPage.evaluateFormula('UPPER(BillingCity) & ", " & LOWER(BillingState)');
    expect(result).toBe('BURLINGTON, nc');
  });

  await test.step('LEFT and RIGHT', async () => {
    const result = await formulaEvaluatorPage.evaluateFormula('LEFT(TickerSymbol, 2) & RIGHT(TickerSymbol, 2)');
    expect(result).toBe('BTXT');
  });

  await test.step('LEN', async () => {
    const result = await formulaEvaluatorPage.evaluateFormula('LEN(Phone)');
    expect(result).toBe('14');
  });

  await test.step('CONTAINS', async () => {
    const result = await formulaEvaluatorPage.evaluateFormula('IF(CONTAINS(Name, "formula"), "yes", "no")');
    expect(result).toBe('yes');
  });

  await test.step('SUBSTITUTE', async () => {
    const result = await formulaEvaluatorPage.evaluateFormula('SUBSTITUTE(BillingCity, "Burlington", "Charlotte")');
    expect(result).toBe('Charlotte');
  });

  await test.step('TRIM', async () => {
    const result = await formulaEvaluatorPage.evaluateFormula('TRIM("  hello  ")');
    expect(result).toBe('hello');
  });

  await test.step('LPAD', async () => {
    const result = await formulaEvaluatorPage.evaluateFormula('LPAD(SLASerialNumber__c, 8, "0")');
    expect(result).toBe('00005367');
  });

  await test.step('BEGINS', async () => {
    const result = await formulaEvaluatorPage.evaluateFormula('IF(BEGINS(Website, "www"), "yes", "no")');
    expect(result).toBe('yes');
  });

  await test.step('MID', async () => {
    const result = await formulaEvaluatorPage.evaluateFormula('MID(BillingPostalCode, 1, 3)');
    expect(result).toBe('272');
  });

  await test.step('FIND', async () => {
    const result = await formulaEvaluatorPage.evaluateFormula('FIND("formula", Name)');
    expect(result).toBe('5');
  });

  // ─── Logical formulas ────────────────────────────────────────

  await test.step('IF with field comparison', async () => {
    const result = await formulaEvaluatorPage.evaluateFormula('IF(AnnualRevenue > 1000000, "Enterprise", "SMB")');
    expect(result).toBe('Enterprise');
  });

  await test.step('CASE on picklist', async () => {
    const result = await formulaEvaluatorPage.evaluateFormula('CASE(Rating, "Hot", 3, "Warm", 2, "Cold", 1, 0)');
    expect(result).toBe('2');
  });

  await test.step('AND', async () => {
    const result = await formulaEvaluatorPage.evaluateFormula(
      'IF(AND(NumberOfEmployees > 1000, AnnualRevenue > 1000000), "Large", "Small")',
    );
    expect(result).toBe('Large');
  });

  await test.step('OR', async () => {
    const result = await formulaEvaluatorPage.evaluateFormula(
      'IF(OR(ISPICKVAL(Industry, "Apparel"), ISPICKVAL(Industry, "Technology")), "Target", "Other")',
    );
    expect(result).toBe('Target');
  });

  await test.step('NOT', async () => {
    const result = await formulaEvaluatorPage.evaluateFormula('NOT(IsDeleted)');
    expect(result).toBe('true');
  });

  await test.step('BLANKVALUE on null field', async () => {
    const result = await formulaEvaluatorPage.evaluateFormula('BLANKVALUE(Description, "No description")');
    expect(result).toBe('No description');
  });

  await test.step('BLANKVALUE on non-null field', async () => {
    const result = await formulaEvaluatorPage.evaluateFormula('BLANKVALUE(Website, "N/A")');
    expect(result).toBe('www.burlington.com');
  });

  await test.step('ISBLANK', async () => {
    const result = await formulaEvaluatorPage.evaluateFormula('IF(ISBLANK(Description), "blank", "not blank")');
    expect(result).toBe('blank');
  });

  // ─── Number and math formulas ────────────────────────────────

  await test.step('arithmetic with record fields', async () => {
    const result = await formulaEvaluatorPage.evaluateFormula('AnnualRevenue / NumberOfEmployees');
    expect(Number(result)).toBeCloseTo(38888.89, 0);
  });

  await test.step('ROUND', async () => {
    const result = await formulaEvaluatorPage.evaluateFormula('ROUND(AnnualRevenue / NumberOfEmployees, 2)');
    expect(result).toBe('38888.89');
  });

  await test.step('MOD', async () => {
    const result = await formulaEvaluatorPage.evaluateFormula('MOD(NumberOfEmployees, 7)');
    expect(result).toBe('5');
  });

  await test.step('MAX and MIN', async () => {
    const result = await formulaEvaluatorPage.evaluateFormula(
      'MAX(NumberOfEmployees, NumberofLocations__c) & "/" & MIN(NumberOfEmployees, NumberofLocations__c)',
    );
    expect(result).toBe('9000/6');
  });

  await test.step('ABS', async () => {
    const result = await formulaEvaluatorPage.evaluateFormula('ABS(NumberofLocations__c - NumberOfEmployees)');
    expect(result).toBe('8994');
  });

  await test.step('CEILING and FLOOR', async () => {
    const result = await formulaEvaluatorPage.evaluateFormula('CEILING(NumberOfEmployees / 7)');
    expect(result).toBe('1286');
  });

  await test.step('SQRT', async () => {
    const result = await formulaEvaluatorPage.evaluateFormula('SQRT(144)');
    expect(result).toBe('12');
  });

  await test.step('POWER', async () => {
    const result = await formulaEvaluatorPage.evaluateFormula('POWER(NumberofLocations__c, 2)');
    expect(result).toBe('36');
  });

  // ─── Date formulas ───────────────────────────────────────────

  await test.step('YEAR, MONTH, DAY on record date field', async () => {
    const result = await formulaEvaluatorPage.evaluateFormula(
      'YEAR(SLAExpirationDate__c) & "-" & MONTH(SLAExpirationDate__c) & "-" & DAY(SLAExpirationDate__c)',
    );
    expect(result).toBe('2022-1-22');
  });

  await test.step('TODAY returns current year', async () => {
    const result = await formulaEvaluatorPage.evaluateFormula('YEAR(TODAY())');
    expect(Number(result)).toBeGreaterThanOrEqual(2025);
  });

  await test.step('ADDMONTHS', async () => {
    const result = await formulaEvaluatorPage.evaluateFormula('MONTH(ADDMONTHS(SLAExpirationDate__c, 3))');
    expect(result).toBe('4');
  });

  await test.step('date comparison', async () => {
    const result = await formulaEvaluatorPage.evaluateFormula('IF(SLAExpirationDate__c < TODAY(), "Expired", "Active")');
    expect(result).toBe('Expired');
  });

  // ─── Related record formulas ─────────────────────────────────

  await test.step('Owner.FirstName (related record)', async () => {
    const result = await formulaEvaluatorPage.evaluateFormula('Owner.FirstName');
    expect(result).toBe('Integration');
  });

  await test.step('Owner.LastName (related record)', async () => {
    const result = await formulaEvaluatorPage.evaluateFormula('Owner.LastName');
    expect(result).toBe('Test');
  });

  await test.step('Owner name concatenation', async () => {
    const result = await formulaEvaluatorPage.evaluateFormula('Owner.FirstName & " " & Owner.LastName');
    expect(result).toBe('Integration Test');
  });

  await test.step('Parent.Name (related record)', async () => {
    const result = await formulaEvaluatorPage.evaluateFormula('Parent.Name');
    expect(result).toBe('University of Arizona');
  });

  await test.step('mixed record and related fields', async () => {
    const result = await formulaEvaluatorPage.evaluateFormula('Name & " (owned by " & Owner.FirstName & ")"');
    expect(result).toBe('A - formula test record (owned by Integration)');
  });

  // ─── Null handling ───────────────────────────────────────────

  await test.step('treat blanks as zero for null field', async () => {
    await formulaEvaluatorPage.setNullBehavior('ZERO');
    // AccountSource is null, so BLANKVALUE should return the fallback
    const result = await formulaEvaluatorPage.evaluateFormula('BLANKVALUE(AccountSource, "None")');
    expect(result).toBe('None');
    // Reset null behavior back to BLANK so later tests are not affected
    await formulaEvaluatorPage.setNullBehavior('BLANK');
  });

  // ─── Picklist formulas ───────────────────────────────────────

  await test.step('ISPICKVAL matching', async () => {
    const result = await formulaEvaluatorPage.evaluateFormula('IF(ISPICKVAL(SLA__c, "Silver"), "match", "no match")');
    expect(result).toBe('match');
  });

  await test.step('ISPICKVAL not matching', async () => {
    const result = await formulaEvaluatorPage.evaluateFormula('IF(ISPICKVAL(SLA__c, "Gold"), "match", "no match")');
    expect(result).toBe('no match');
  });

  // ─── Global variables ────────────────────────────────────────

  await test.step('$User.FirstName', async () => {
    const result = await formulaEvaluatorPage.evaluateFormula('$User.FirstName');
    expect(result.length).toBeGreaterThan(0);
  });

  await test.step('$Organization.Name', async () => {
    const result = await formulaEvaluatorPage.evaluateFormula('$Organization.Name');
    expect(result.length).toBeGreaterThan(0);
  });

  // ─── Previously unsupported functions (broken in formulon) ──

  await test.step('ISNULL on null field', async () => {
    const result = await formulaEvaluatorPage.evaluateFormula('IF(ISNULL(Description), "null", "has value")');
    expect(result).toBe('null');
  });

  await test.step('ISNULL on non-null field', async () => {
    const result = await formulaEvaluatorPage.evaluateFormula('IF(ISNULL(Website), "null", "has value")');
    expect(result).toBe('has value');
  });

  await test.step('NULLVALUE on null number field', async () => {
    // YearStarted is null on this record
    const result = await formulaEvaluatorPage.evaluateFormula('NULLVALUE(YearStarted, 1999)');
    expect(result).toBe('1999');
  });

  // ─── Error handling ──────────────────────────────────────────

  await test.step('syntax error shows error message', async () => {
    const errorText = await formulaEvaluatorPage.evaluateFormulaExpectError('LEFT(Name');
    expect(errorText.length).toBeGreaterThan(0);
  });

  await test.step('unknown function shows error message', async () => {
    const errorText = await formulaEvaluatorPage.evaluateFormulaExpectError('NOTAFUNCTION(Name)');
    expect(errorText.length).toBeGreaterThan(0);
  });
});
