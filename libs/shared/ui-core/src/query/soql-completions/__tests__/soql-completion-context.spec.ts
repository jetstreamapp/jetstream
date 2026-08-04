import { describe, expect, it } from 'vitest';
import { maskLiteralsAndComments, parseSoqlContext } from '../soql-completion-context';

/**
 * Parses using `|` in the query to mark the cursor, which keeps the test cases readable.
 */
function parseAtCursor(queryWithCursor: string) {
  const cursorOffset = queryWithCursor.indexOf('|');
  expect(cursorOffset, 'test case must include a | cursor marker').toBeGreaterThan(-1);
  return parseSoqlContext(queryWithCursor.slice(0, cursorOffset) + queryWithCursor.slice(cursorOffset + 1), cursorOffset);
}

describe('maskLiteralsAndComments', () => {
  it('preserves offsets while blanking string contents', () => {
    const text = `SELECT Id FROM Case WHERE Subject = 'FROM Account'`;
    const masked = maskLiteralsAndComments(text);
    expect(masked).toHaveLength(text.length);
    expect(masked).toBe(`SELECT Id FROM Case WHERE Subject = '            '`);
  });

  it('does not treat an escaped quote as the end of a literal', () => {
    const text = `WHERE Name = 'O\\'Brien' AND Id = 'x'`;
    const masked = maskLiteralsAndComments(text);
    expect(masked).toHaveLength(text.length);
    expect(masked.slice(masked.indexOf(`AND`))).toBe(`AND Id = ' '`);
  });

  it('blanks line and block comments', () => {
    expect(maskLiteralsAndComments('SELECT Id // FROM Case')).toBe('SELECT Id             ');
    expect(maskLiteralsAndComments('SELECT /* FROM Case */ Id')).toBe('SELECT                 Id');
  });
});

describe('parseSoqlContext - clause detection', () => {
  it.each([
    ['|', 'NONE'],
    ['SELECT |', 'SELECT'],
    ['SELECT Id, Nam| FROM Case', 'SELECT'],
    ['SELECT Id FROM Ca|', 'FROM'],
    ['SELECT Id FROM Case WHERE Sta|', 'WHERE'],
    ['SELECT Id FROM Case USING SCOPE min|', 'USING_SCOPE'],
    ['SELECT Id FROM Case WITH SEC|', 'WITH'],
    ['SELECT COUNT(Id) FROM Case GROUP BY Sta|', 'GROUP_BY'],
    ['SELECT COUNT(Id) FROM Case GROUP BY Status HAVING COUNT(Id) > |', 'HAVING'],
    ['SELECT Id FROM Case ORDER BY Crea|', 'ORDER_BY'],
    ['SELECT Id FROM Case LIMIT 1|', 'LIMIT'],
    ['SELECT Id FROM Case LIMIT 10 OFFSET 1|', 'OFFSET'],
    ['SELECT Id FROM Case FOR VI|', 'FOR'],
  ])('resolves %s to the %s clause', (query, expected) => {
    expect(parseAtCursor(query).clause).toBe(expected);
  });

  it('ignores clause keywords that appear inside a string literal', () => {
    expect(parseAtCursor(`SELECT Id FROM Case WHERE Subject = 'ORDER BY x' AND Prior|`).clause).toBe('WHERE');
  });

  it('ignores clause keywords nested inside a function call', () => {
    expect(parseAtCursor('SELECT Id FROM Case WHERE Id IN (SELECT CaseId FROM CaseComment) AND Sta|').clause).toBe('WHERE');
  });

  it('returns to SELECT after a TYPEOF block closes', () => {
    expect(parseAtCursor('SELECT TYPEOF What WHEN Account THEN Id END, Sub| FROM Event').clause).toBe('SELECT');
    expect(parseAtCursor('SELECT TYPEOF What WHEN Acc|').clause).toBe('TYPEOF');
  });
});

describe('parseSoqlContext - object resolution', () => {
  it('finds the object when the cursor is before the FROM clause', () => {
    // The case that motivated the feature: typing a field before the object has been read
    expect(parseAtCursor('SELECT Sta| FROM Case').fromName).toBe('Case');
  });

  it('handles namespaced and custom object names', () => {
    expect(parseAtCursor('SELECT | FROM My_NS__Custom_Object__c').fromName).toBe('My_NS__Custom_Object__c');
  });

  it('returns null when no object has been typed yet', () => {
    expect(parseAtCursor('SELECT Id, |').fromName).toBeNull();
  });

  it('is not confused by a FROM inside a subquery', () => {
    expect(parseAtCursor('SELECT Id, (SELECT Id FROM Contacts), Nam| FROM Account').fromName).toBe('Account');
  });
});

describe('parseSoqlContext - subqueries', () => {
  it('treats a subquery in the field list as a child relationship', () => {
    const context = parseAtCursor('SELECT Id, (SELECT Nam| FROM Contacts) FROM Account');
    expect(context.isSubquery).toBe(true);
    expect(context.isRelationshipSubquery).toBe(true);
    expect(context.fromName).toBe('Contacts');
    expect(context.parentFromName).toBe('Account');
    expect(context.clause).toBe('SELECT');
  });

  it('treats a subquery in the WHERE clause as a semi-join on a real object', () => {
    const context = parseAtCursor('SELECT Id FROM Account WHERE Id IN (SELECT AccountId FROM Contact WHERE LastNam|)');
    expect(context.isSubquery).toBe(true);
    expect(context.isRelationshipSubquery).toBe(false);
    expect(context.fromName).toBe('Contact');
    expect(context.clause).toBe('WHERE');
  });

  it('stays in the outer scope for parentheses that are not subqueries', () => {
    const context = parseAtCursor(`SELECT Id FROM Case WHERE Status IN ('New', 'Work|`);
    expect(context.isSubquery).toBe(false);
    expect(context.fromName).toBe('Case');
  });

  it('handles a subquery whose closing paren has not been typed yet', () => {
    const context = parseAtCursor('SELECT Id, (SELECT Id FROM Contacts WHERE FirstNam| FROM Account');
    expect(context.isSubquery).toBe(true);
    expect(context.fromName).toBe('Contacts');
    expect(context.clause).toBe('WHERE');
  });
});

describe('parseSoqlContext - relationship paths', () => {
  it('splits a traversal into the path and the fragment being typed', () => {
    const context = parseAtCursor('SELECT Account.Owner.Nam| FROM Contact');
    expect(context.relationshipPath).toEqual(['Account', 'Owner']);
    expect(context.partialWord).toBe('Nam');
  });

  it('reports an empty fragment immediately after a dot', () => {
    const context = parseAtCursor('SELECT Account.| FROM Contact');
    expect(context.relationshipPath).toEqual(['Account']);
    expect(context.partialWord).toBe('');
  });

  it('has no path for a plain field', () => {
    const context = parseAtCursor('SELECT Sta| FROM Case');
    expect(context.relationshipPath).toEqual([]);
    expect(context.partialWord).toBe('Sta');
  });
});

describe('parseSoqlContext - comparison values', () => {
  it.each([
    [`SELECT Id FROM Case WHERE Status = '|`, 'Status'],
    [`SELECT Id FROM Case WHERE Status = |`, 'Status'],
    [`SELECT Id FROM Case WHERE Status != '|`, 'Status'],
    [`SELECT Id FROM Case WHERE Status IN ('New', '|`, 'Status'],
    [`SELECT Id FROM Case WHERE Subject LIKE '|`, 'Subject'],
    [`SELECT Id FROM Case WHERE Account.Type = '|`, 'Account.Type'],
    [`SELECT Id FROM Case WHERE CreatedDate > |`, 'CreatedDate'],
  ])('detects the field being compared in %s', (query, expected) => {
    expect(parseAtCursor(query).comparisonField).toBe(expected);
  });

  it('does not carry a comparison past a logical operator', () => {
    expect(parseAtCursor(`SELECT Id FROM Case WHERE Status = 'New' AND Prior|`).comparisonField).toBeNull();
  });

  it('does not carry a comparison past a closed value list', () => {
    expect(parseAtCursor(`SELECT Id FROM Case WHERE Status IN ('New') |`).comparisonField).toBeNull();
  });

  it('reports no comparison when the cursor is on the field side', () => {
    expect(parseAtCursor('SELECT Id FROM Case WHERE Sta|').comparisonField).toBeNull();
  });
});

describe('parseSoqlContext - string literals', () => {
  it('knows when the cursor sits inside a quoted value', () => {
    expect(parseAtCursor(`SELECT Id FROM Case WHERE Status = 'Ne|'`).isInsideStringLiteral).toBe(true);
    expect(parseAtCursor(`SELECT Id FROM Case WHERE Status = 'New' AND Prior|`).isInsideStringLiteral).toBe(false);
  });
});

describe('parseSoqlContext - clause target tracking', () => {
  it('reports nothing typed yet directly after a clause keyword', () => {
    expect(parseAtCursor('SELECT Id FROM |').wordsAfterClauseKeyword).toBe(0);
  });

  it('counts the partially typed object name', () => {
    expect(parseAtCursor('SELECT Id FROM Ca|').wordsAfterClauseKeyword).toBe(1);
  });

  it('distinguishes a completed object name followed by a space', () => {
    const context = parseAtCursor('SELECT Id FROM Case |');
    expect(context.wordsAfterClauseKeyword).toBe(1);
    expect(context.partialWord).toBe('');
  });
});
