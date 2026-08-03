/**
 * Static SOQL vocabulary offered by the editor completions. Kept free of any monaco import so the
 * lists stay plain data — the provider turns them into completion items.
 *
 * `snippet` entries use monaco's tab-stop syntax (`${1:placeholder}`) and are flagged by the caller.
 */

export interface SoqlSuggestion {
  label: string;
  insertText: string;
  detail?: string;
  documentation?: string;
  isSnippet?: boolean;
}

function keyword(label: string, detail = 'Keyword'): SoqlSuggestion {
  return { label, insertText: label, detail };
}

function snippet(label: string, insertText: string, detail: string, documentation?: string): SoqlSuggestion {
  return { label, insertText, detail, documentation, isSnippet: true };
}

/** Date literals that take no argument */
export const SOQL_DATE_LITERALS: SoqlSuggestion[] = [
  'YESTERDAY',
  'TODAY',
  'TOMORROW',
  'LAST_WEEK',
  'THIS_WEEK',
  'NEXT_WEEK',
  'LAST_MONTH',
  'THIS_MONTH',
  'NEXT_MONTH',
  'LAST_90_DAYS',
  'NEXT_90_DAYS',
  'THIS_QUARTER',
  'LAST_QUARTER',
  'NEXT_QUARTER',
  'THIS_YEAR',
  'LAST_YEAR',
  'NEXT_YEAR',
  'THIS_FISCAL_QUARTER',
  'LAST_FISCAL_QUARTER',
  'NEXT_FISCAL_QUARTER',
  'THIS_FISCAL_YEAR',
  'LAST_FISCAL_YEAR',
  'NEXT_FISCAL_YEAR',
].map((literal) => keyword(literal, 'Date literal'));

/** Date literals parameterized with `:n`, offered as snippets so the cursor lands on the number */
export const SOQL_PARAMETERIZED_DATE_LITERALS: SoqlSuggestion[] = [
  'LAST_N_DAYS',
  'NEXT_N_DAYS',
  'N_DAYS_AGO',
  'LAST_N_WEEKS',
  'NEXT_N_WEEKS',
  'N_WEEKS_AGO',
  'LAST_N_MONTHS',
  'NEXT_N_MONTHS',
  'N_MONTHS_AGO',
  'LAST_N_QUARTERS',
  'NEXT_N_QUARTERS',
  'N_QUARTERS_AGO',
  'LAST_N_YEARS',
  'NEXT_N_YEARS',
  'N_YEARS_AGO',
  'LAST_N_FISCAL_QUARTERS',
  'NEXT_N_FISCAL_QUARTERS',
  'N_FISCAL_QUARTERS_AGO',
  'LAST_N_FISCAL_YEARS',
  'NEXT_N_FISCAL_YEARS',
  'N_FISCAL_YEARS_AGO',
].map((literal) => snippet(`${literal}:n`, `${literal}:\${1:1}`, 'Date literal'));

export const SOQL_AGGREGATE_FUNCTIONS: SoqlSuggestion[] = [
  snippet('COUNT()', 'COUNT()', 'Aggregate function', 'Returns the number of rows matching the query'),
  snippet('COUNT(field)', 'COUNT(${1:field})', 'Aggregate function', 'Returns the number of rows where the field is not null'),
  snippet('COUNT_DISTINCT(field)', 'COUNT_DISTINCT(${1:field})', 'Aggregate function', 'Returns the number of distinct non-null values'),
  snippet('SUM(field)', 'SUM(${1:field})', 'Aggregate function'),
  snippet('AVG(field)', 'AVG(${1:field})', 'Aggregate function'),
  snippet('MIN(field)', 'MIN(${1:field})', 'Aggregate function'),
  snippet('MAX(field)', 'MAX(${1:field})', 'Aggregate function'),
];

/** Functions valid within the field list */
export const SOQL_SELECT_FUNCTIONS: SoqlSuggestion[] = [
  snippet('FIELDS(ALL)', 'FIELDS(ALL)', 'Field set', 'Selects every field — requires a LIMIT of 200 or fewer'),
  snippet('FIELDS(CUSTOM)', 'FIELDS(CUSTOM)', 'Field set', 'Selects every custom field — requires a LIMIT of 200 or fewer'),
  snippet('FIELDS(STANDARD)', 'FIELDS(STANDARD)', 'Field set', 'Selects every standard field'),
  snippet('toLabel(field)', 'toLabel(${1:field})', 'Function', 'Returns the translated value of a picklist or record type field'),
  snippet('FORMAT(field)', 'FORMAT(${1:field})', 'Function', 'Applies the user locale formatting to a number, date or currency'),
  snippet('convertCurrency(field)', 'convertCurrency(${1:field})', 'Function', "Converts a currency amount to the user's currency"),
  snippet(
    'convertTimezone(dateField)',
    'convertTimezone(${1:dateField})',
    'Function',
    "Converts a date/time to the user's timezone — only valid inside a date function",
  ),
  snippet(
    'TYPEOF ... END',
    'TYPEOF ${1:PolymorphicField}\n\tWHEN ${2:ObjectName} THEN ${3:Id}\n\tELSE ${4:Id}\nEND',
    'Polymorphic fields',
    'Selects different fields depending on the type of a polymorphic relationship',
  ),
];

/** Date functions valid in the field list, GROUP BY, HAVING and ORDER BY */
export const SOQL_DATE_FUNCTIONS: SoqlSuggestion[] = [
  'CALENDAR_MONTH',
  'CALENDAR_QUARTER',
  'CALENDAR_YEAR',
  'DAY_IN_MONTH',
  'DAY_IN_WEEK',
  'DAY_IN_YEAR',
  'DAY_ONLY',
  'FISCAL_MONTH',
  'FISCAL_QUARTER',
  'FISCAL_YEAR',
  'HOUR_IN_DAY',
  'WEEK_IN_MONTH',
  'WEEK_IN_YEAR',
].map((fn) => snippet(`${fn}(dateField)`, `${fn}(\${1:dateField})`, 'Date function'));

export const SOQL_LOGICAL_OPERATORS: SoqlSuggestion[] = [keyword('AND', 'Operator'), keyword('OR', 'Operator'), keyword('NOT', 'Operator')];

export const SOQL_VALUE_KEYWORDS: SoqlSuggestion[] = [keyword('NULL', 'Value'), keyword('TRUE', 'Value'), keyword('FALSE', 'Value')];

export const SOQL_SCOPES: SoqlSuggestion[] = [
  { label: 'everything', insertText: 'everything', detail: 'Scope', documentation: 'All records the user can see' },
  { label: 'delegated', insertText: 'delegated', detail: 'Scope', documentation: 'Records delegated to the user' },
  { label: 'mine', insertText: 'mine', detail: 'Scope', documentation: 'Records owned by the user' },
  { label: 'mineAndMyGroups', insertText: 'mineAndMyGroups', detail: 'Scope', documentation: "The user's records and their queue records" },
  { label: 'my_territory', insertText: 'my_territory', detail: 'Scope' },
  { label: 'my_team_territory', insertText: 'my_team_territory', detail: 'Scope' },
  { label: 'team', insertText: 'team', detail: 'Scope' },
  { label: 'allPrivate', insertText: 'allPrivate', detail: 'Scope', documentation: 'Records with a private sharing setting' },
];

export const SOQL_WITH_OPTIONS: SoqlSuggestion[] = [
  keyword('SECURITY_ENFORCED', 'Filter'),
  keyword('USER_MODE', 'Filter'),
  keyword('SYSTEM_MODE', 'Filter'),
  snippet('DATA CATEGORY', 'DATA CATEGORY ${1:Category} AT ${2:Value}', 'Filter'),
];

export const SOQL_FOR_OPTIONS: SoqlSuggestion[] = [
  { label: 'VIEW', insertText: 'VIEW', detail: 'Clause', documentation: 'Updates the last viewed date on the returned records' },
  {
    label: 'REFERENCE',
    insertText: 'REFERENCE',
    detail: 'Clause',
    documentation: 'Updates the last referenced date on the returned records',
  },
  { label: 'UPDATE', insertText: 'UPDATE', detail: 'Clause', documentation: 'Locks the returned records' },
];

export const SOQL_ORDER_BY_MODIFIERS: SoqlSuggestion[] = [
  keyword('ASC', 'Sort order'),
  keyword('DESC', 'Sort order'),
  { label: 'NULLS FIRST', insertText: 'NULLS FIRST', detail: 'Sort order' },
  { label: 'NULLS LAST', insertText: 'NULLS LAST', detail: 'Sort order' },
];

export const SOQL_GROUP_BY_MODIFIERS: SoqlSuggestion[] = [
  snippet('ROLLUP(field)', 'ROLLUP(${1:field})', 'Grouping', 'Adds subtotals for each grouping plus a grand total'),
  snippet('CUBE(field)', 'CUBE(${1:field})', 'Grouping', 'Adds subtotals for every combination of the groupings'),
];

/**
 * Clauses that may follow `FROM`, in the order Salesforce requires them. Offered once the object
 * name has been typed so the query can be built out without reaching for the docs.
 */
export const SOQL_CLAUSES_AFTER_FROM: SoqlSuggestion[] = [
  snippet('USING SCOPE', 'USING SCOPE ${1:everything}', 'Clause'),
  keyword('WHERE', 'Clause'),
  keyword('WITH SECURITY_ENFORCED', 'Clause'),
  { label: 'GROUP BY', insertText: 'GROUP BY ', detail: 'Clause' },
  { label: 'ORDER BY', insertText: 'ORDER BY ', detail: 'Clause' },
  { label: 'LIMIT', insertText: 'LIMIT ', detail: 'Clause' },
  { label: 'OFFSET', insertText: 'OFFSET ', detail: 'Clause' },
  { label: 'FOR VIEW', insertText: 'FOR VIEW', detail: 'Clause' },
];

/** Offered when the editor is empty or the cursor sits before any recognizable clause */
export const SOQL_QUERY_STARTERS: SoqlSuggestion[] = [
  snippet('SELECT ... FROM ...', 'SELECT ${1:Id}\nFROM ${2:Object}', 'Query', 'Starts a new SOQL query'),
  keyword('SELECT', 'Clause'),
];

export const SOQL_TYPEOF_KEYWORDS: SoqlSuggestion[] = [
  snippet('WHEN ... THEN ...', 'WHEN ${1:ObjectName} THEN ${2:Id}', 'TYPEOF'),
  snippet('ELSE', 'ELSE ${1:Id}', 'TYPEOF'),
  keyword('END', 'TYPEOF'),
];
