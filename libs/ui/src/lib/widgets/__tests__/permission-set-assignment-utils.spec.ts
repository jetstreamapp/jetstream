import { escapeSoqlLike, getPermissionSetAssignmentsQuery, getUserSearchQuery, MAX_ASSIGNMENTS } from '../permission-set-assignment-utils';

const PERM_SET_ID = '0PS1t000000AbCdEfG';

describe('escapeSoqlLike', () => {
  test.each([
    ['100%', '100\\%'],
    ['first_name', 'first\\_name'],
    ["O'Brien", "O\\'Brien"],
    ['back\\slash', 'back\\\\slash'],
  ])('escapes LIKE metacharacters in %s', (value, expected) => {
    expect(escapeSoqlLike(value)).toBe(expected);
  });

  test('returns empty input unchanged', () => {
    expect(escapeSoqlLike('')).toBe('');
  });
});

describe('getPermissionSetAssignmentsQuery', () => {
  test('selects the assignment Id so removals can target the assignment record', () => {
    const soql = getPermissionSetAssignmentsQuery(PERM_SET_ID);
    expect(soql).toContain('SELECT Id, PermissionSetId, AssigneeId');
    expect(soql).toContain(`WHERE PermissionSetId = '${PERM_SET_ID}'`);
  });

  test('queries one past the display cap so truncation is detectable', () => {
    expect(getPermissionSetAssignmentsQuery(PERM_SET_ID)).toContain(`LIMIT ${MAX_ASSIGNMENTS + 1}`);
  });

  test('does not filter on Assignee.IsActive — inactive users still hold assignments', () => {
    expect(getPermissionSetAssignmentsQuery(PERM_SET_ID)).not.toContain('IsActive = true');
  });

  test('does not reference IsRevoked, which only exists on API v51.0+', () => {
    expect(getPermissionSetAssignmentsQuery(PERM_SET_ID)).not.toContain('IsRevoked');
  });

  test.each([
    ['empty', ''],
    ['non-alphanumeric', 'not-an-id'],
    ['too long', '0PS1t000000AbCdEfGtooLong'],
    ['quoted', "0PS1t00000'AbCdE"],
    ['16 characters', '0PS1t000000AbCdE'],
    ['17 characters', '0PS1t000000AbCdEf'],
  ])('returns null for an id that is %s', (_label, recordId) => {
    expect(getPermissionSetAssignmentsQuery(recordId)).toBeNull();
  });
});

describe('getUserSearchQuery', () => {
  test('an empty term lists the first page of users so the dropdown is not empty on open', () => {
    const soql = getUserSearchQuery('');
    expect(soql).toContain('WHERE IsActive = true ORDER BY Name');
    expect(soql).toContain('LIMIT 50');
    expect(soql).not.toContain('LIKE');
    expect(getUserSearchQuery('   ')).toBe(soql);
  });

  test('searches name, username, and email for a normal term', () => {
    const soql = getUserSearchQuery('smith');
    expect(soql).toContain("Name LIKE '%smith%'");
    expect(soql).toContain("Username LIKE '%smith%'");
    expect(soql).toContain("Email LIKE '%smith%'");
    expect(soql).toContain('IsActive = true');
  });

  test('matches on Id when the term looks like a Salesforce id', () => {
    const soql = getUserSearchQuery('0051t000000AbCdEfG');
    expect(soql).toContain("Id = '0051t000000AbCdEfG'");
    expect(soql).not.toContain('Email LIKE');
  });

  test.each([
    [16, '0051t000000AbCdE'],
    [17, '0051t000000AbCdEf'],
  ])('a %i character term is not an id — matching it on Id would fail the whole query with MALFORMED_ID', (_length, searchTerm) => {
    const soql = getUserSearchQuery(searchTerm);
    expect(soql).not.toContain('Id =');
    expect(soql).toContain(`Email LIKE '%${searchTerm}%'`);
  });

  test('escapes LIKE metacharacters so a term cannot widen the search', () => {
    expect(getUserSearchQuery('a_b')).toContain("Name LIKE '%a\\_b%'");
  });
});
