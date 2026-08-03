/**
 * Cursor-context detection for the SOQL editors.
 *
 * `parseQuery()` from soql-parser-js is deliberately not used here — it throws on the incomplete
 * queries that exist while somebody is mid-keystroke, which is exactly when completions are needed.
 * These routines walk the raw text instead and tolerate anything the user has typed so far.
 */

export type SoqlClause =
  | 'NONE'
  | 'SELECT'
  | 'FROM'
  | 'USING_SCOPE'
  | 'WHERE'
  | 'WITH'
  | 'GROUP_BY'
  | 'HAVING'
  | 'ORDER_BY'
  | 'LIMIT'
  | 'OFFSET'
  | 'FOR'
  | 'TYPEOF';

export interface SoqlContext {
  clause: SoqlClause;
  /** Name following `FROM` in the scope containing the cursor — an object name, or a child relationship name for a relationship subquery */
  fromName: string | null;
  /** `FROM` name of the enclosing scope, used to resolve a child relationship subquery back to a real object */
  parentFromName: string | null;
  isSubquery: boolean;
  /** True for `SELECT Id, (SELECT ...) FROM Account` (child relationship), false for `WHERE Id IN (SELECT ...)` (semi-join on a real object) */
  isRelationshipSubquery: boolean;
  /** Relationship segments typed before the cursor — `Account.Owner.Na` yields `['Account', 'Owner']` */
  relationshipPath: string[];
  /** Identifier fragment immediately before the cursor — `Account.Owner.Na` yields `'Na'` */
  partialWord: string;
  isInsideStringLiteral: boolean;
  /** Depth-0 words between the clause keyword and the cursor, used to tell `FROM |` apart from `FROM Account |` */
  wordsAfterClauseKeyword: number;
  /** Field on the left of a comparison operator when the cursor sits in the value position — `Status = 'Ne` yields `'Status'` */
  comparisonField: string | null;
}

interface ParenPair {
  open: number;
  close: number;
}

interface Scope {
  /** First offset inside the scope */
  start: number;
  /** Offset just past the last character of the scope */
  end: number;
  /** Offset of the `(` that opened the scope, or -1 for the root scope */
  openParenIndex: number;
}

/** Words that terminate a value expression, used to reject a stale comparison operator match */
const VALUE_TERMINATING_WORDS = /\b(AND|OR|NOT|SELECT|FROM|WHERE|GROUP|ORDER|HAVING|LIMIT|OFFSET|WITH|FOR|USING)\b/i;

const COMPARISON_EXPRESSION = /([A-Za-z_][A-Za-z0-9_.]*)\s*(!=|<>|<=|>=|=|<|>|\bLIKE\b|\bNOT\s+IN\b|\bIN\b|\bINCLUDES\b|\bEXCLUDES\b)\s*/gi;

/** Parens and bare words — the tokens needed to track nesting and spot clause keywords */
const STRUCTURE_TOKEN = /[()]|[A-Za-z_][A-Za-z0-9_]*/g;

/** Same as above but allows dots, so `FROM My_Namespace__Object__c` is captured as one token */
const STRUCTURE_TOKEN_WITH_DOTS = /[()]|[A-Za-z_][A-Za-z0-9_.]*/g;

export function parseSoqlContext(text: string, cursorOffset: number): SoqlContext {
  const masked = maskLiteralsAndComments(text);
  const offset = Math.max(0, Math.min(cursorOffset, masked.length));

  const { scope, parentScope } = findScopes(masked, offset);
  const { clause, wordsAfterClauseKeyword } = findClauseAt(masked, scope, offset);
  const { relationshipPath, partialWord } = splitIdentifierBeforeCursor(masked, offset);

  const isSubquery = scope.openParenIndex >= 0;

  return {
    clause,
    fromName: findFromName(masked, scope),
    parentFromName: parentScope ? findFromName(masked, parentScope) : null,
    isSubquery,
    isRelationshipSubquery: isSubquery && !!parentScope && findClauseAt(masked, parentScope, scope.openParenIndex).clause === 'SELECT',
    relationshipPath,
    partialWord,
    isInsideStringLiteral: countQuotes(masked, offset) % 2 === 1,
    wordsAfterClauseKeyword,
    comparisonField: findComparisonField(masked, scope, offset),
  };
}

/**
 * Blanks out the interior of string literals and the entirety of comments while preserving every
 * offset, so ranges computed against the masked text still line up with the original. All structural
 * scanning runs against masked text — otherwise `WHERE Subject = 'FROM me'` would be read as a clause.
 */
export function maskLiteralsAndComments(text: string): string {
  const chars = text.split('');
  let index = 0;

  while (index < text.length) {
    if (text[index] === `'`) {
      index++;
      while (index < text.length) {
        // A backslash escape consumes the character after it, so an escaped quote does not close the literal
        if (text[index] === '\\' && index + 1 < text.length) {
          chars[index] = ' ';
          chars[index + 1] = ' ';
          index += 2;
          continue;
        }
        if (text[index] === `'`) {
          index++;
          break;
        }
        chars[index] = ' ';
        index++;
      }
      continue;
    }

    if (text[index] === '/' && text[index + 1] === '/') {
      while (index < text.length && text[index] !== '\n') {
        chars[index] = ' ';
        index++;
      }
      continue;
    }

    if (text[index] === '/' && text[index + 1] === '*') {
      chars[index] = ' ';
      chars[index + 1] = ' ';
      index += 2;
      while (index < text.length) {
        if (text[index] === '*' && text[index + 1] === '/') {
          chars[index] = ' ';
          chars[index + 1] = ' ';
          index += 2;
          break;
        }
        chars[index] = ' ';
        index++;
      }
      continue;
    }

    index++;
  }

  return chars.join('');
}

function countQuotes(masked: string, offset: number): number {
  let count = 0;
  for (let index = 0; index < offset; index++) {
    if (masked[index] === `'`) {
      count++;
    }
  }
  return count;
}

/**
 * Locates the innermost subquery containing the cursor plus its enclosing scope. Parentheses that do
 * not open a subquery — `COUNT(Id)`, `IN ('a', 'b')` — are transparent, the cursor stays in the
 * surrounding scope.
 */
function findScopes(masked: string, offset: number): { scope: Scope; parentScope: Scope | null } {
  const rootScope: Scope = { start: 0, end: masked.length, openParenIndex: -1 };

  const enclosingSubqueries = findParenPairs(masked)
    .filter(({ open, close }) => open < offset && offset <= close)
    .sort((a, b) => b.open - a.open)
    .filter(({ open, close }) => /^\s*SELECT\b/i.test(masked.slice(open + 1, close)))
    .map<Scope>(({ open, close }) => ({ start: open + 1, end: close, openParenIndex: open }));

  if (!enclosingSubqueries.length) {
    return { scope: rootScope, parentScope: null };
  }

  return {
    scope: enclosingSubqueries[0],
    parentScope: enclosingSubqueries[1] ?? rootScope,
  };
}

function findParenPairs(masked: string): ParenPair[] {
  const pairs: ParenPair[] = [];
  const openIndexes: number[] = [];

  for (let index = 0; index < masked.length; index++) {
    if (masked[index] === '(') {
      openIndexes.push(index);
    } else if (masked[index] === ')') {
      const open = openIndexes.pop();
      if (open !== undefined) {
        pairs.push({ open, close: index });
      }
    }
  }

  // An unclosed paren is the common case while typing — treat it as running to the end of the text
  while (openIndexes.length) {
    pairs.push({ open: openIndexes.pop() as number, close: masked.length });
  }

  return pairs;
}

/**
 * Walks the scope up to the cursor and returns the clause keyword most recently passed. Only
 * depth-0 words count, so keywords buried in a nested subquery or function call do not leak out.
 */
function findClauseAt(masked: string, scope: Scope, offset: number): { clause: SoqlClause; wordsAfterClauseKeyword: number } {
  const words = collectDepthZeroWords(masked.slice(scope.start, Math.min(offset, scope.end)), STRUCTURE_TOKEN);

  let clause: SoqlClause = 'NONE';
  let clauseKeywordIndex = -1;

  for (let index = 0; index < words.length; index++) {
    const word = words[index].toUpperCase();
    const nextWord = words[index + 1]?.toUpperCase();

    switch (word) {
      case 'SELECT':
      case 'FROM':
      case 'WHERE':
      case 'WITH':
      case 'HAVING':
      case 'LIMIT':
      case 'OFFSET':
      case 'FOR':
      case 'TYPEOF':
        clause = word;
        clauseKeywordIndex = index;
        break;
      case 'END':
        // Closes a `TYPEOF ... END` block, which only ever appears within the field list
        if (clause === 'TYPEOF') {
          clause = 'SELECT';
          clauseKeywordIndex = index;
        }
        break;
      case 'GROUP':
      case 'ORDER':
        if (nextWord === 'BY') {
          clause = word === 'GROUP' ? 'GROUP_BY' : 'ORDER_BY';
          index++;
          clauseKeywordIndex = index;
        }
        break;
      case 'USING':
        if (nextWord === 'SCOPE') {
          clause = 'USING_SCOPE';
          index++;
          clauseKeywordIndex = index;
        }
        break;
      default:
        break;
    }
  }

  return { clause, wordsAfterClauseKeyword: clauseKeywordIndex === -1 ? words.length : words.length - 1 - clauseKeywordIndex };
}

/**
 * Reads the object (or child relationship) name after the scope's `FROM`. Scans the whole scope
 * rather than stopping at the cursor, since `SELECT Sta| FROM Case` needs the name typed after it.
 */
function findFromName(masked: string, scope: Scope): string | null {
  const words = collectDepthZeroWords(masked.slice(scope.start, scope.end), STRUCTURE_TOKEN_WITH_DOTS);
  const fromIndex = words.findIndex((word) => word.toUpperCase() === 'FROM');
  if (fromIndex === -1) {
    return null;
  }
  return words[fromIndex + 1] ?? null;
}

function collectDepthZeroWords(text: string, tokenPattern: RegExp): string[] {
  const words: string[] = [];
  let depth = 0;
  let match: RegExpExecArray | null;

  tokenPattern.lastIndex = 0;
  while ((match = tokenPattern.exec(text)) !== null) {
    if (match[0] === '(') {
      depth++;
    } else if (match[0] === ')') {
      depth = Math.max(0, depth - 1);
    } else if (depth === 0) {
      words.push(match[0]);
    }
  }

  return words;
}

function splitIdentifierBeforeCursor(masked: string, offset: number): { relationshipPath: string[]; partialWord: string } {
  let start = offset;
  while (start > 0 && /[A-Za-z0-9_.]/.test(masked[start - 1])) {
    start--;
  }

  const segments = masked.slice(start, offset).split('.');
  const partialWord = segments.pop() ?? '';

  return { relationshipPath: segments.filter(Boolean), partialWord };
}

/**
 * Detects that the cursor is in the value position of a comparison so picklist values, booleans and
 * date literals can be offered for the field on the left. Rejects a match whose trailing text has
 * already moved on to another expression.
 */
function findComparisonField(masked: string, scope: Scope, offset: number): string | null {
  const text = masked.slice(scope.start, Math.min(offset, scope.end));

  let lastMatch: RegExpExecArray | null = null;
  let match: RegExpExecArray | null;

  COMPARISON_EXPRESSION.lastIndex = 0;
  while ((match = COMPARISON_EXPRESSION.exec(text)) !== null) {
    lastMatch = match;
  }

  if (!lastMatch) {
    return null;
  }

  const trailingText = text.slice(lastMatch.index + lastMatch[0].length);
  if (trailingText.includes(')') || VALUE_TERMINATING_WORDS.test(trailingText)) {
    return null;
  }

  return lastMatch[1];
}
