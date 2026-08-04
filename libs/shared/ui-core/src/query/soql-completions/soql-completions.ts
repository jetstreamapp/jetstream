import { logger } from '@jetstream/shared/client-logger';
import { describeGlobal, describeSObject } from '@jetstream/shared/data';
import { escapeSoqlString } from '@jetstream/shared/ui-utils';
import { getErrorMessage } from '@jetstream/shared/utils';
import { DescribeGlobalSObjectResult, DescribeSObjectResult, Field, SalesforceOrgUi } from '@jetstream/types';
import type { Monaco } from '@monaco-editor/react';
import type * as monaco from 'monaco-editor';
import { parseSoqlContext, SoqlContext } from './soql-completion-context';
import {
  SOQL_AGGREGATE_FUNCTIONS,
  SOQL_CLAUSES_AFTER_FROM,
  SOQL_DATE_FUNCTIONS,
  SOQL_DATE_LITERALS,
  SOQL_FOR_OPTIONS,
  SOQL_GROUP_BY_MODIFIERS,
  SOQL_LOGICAL_OPERATORS,
  SOQL_ORDER_BY_MODIFIERS,
  SOQL_PARAMETERIZED_DATE_LITERALS,
  SOQL_QUERY_STARTERS,
  SOQL_SCOPES,
  SOQL_SELECT_FUNCTIONS,
  SOQL_TYPEOF_KEYWORDS,
  SOQL_VALUE_KEYWORDS,
  SOQL_WITH_OPTIONS,
  SoqlSuggestion,
} from './soql-completion-keywords';

export interface SoqlCompletionOptions {
  /** Read lazily so the provider never has to be re-registered when the user switches orgs */
  getSelectedOrg: () => SalesforceOrgUi | null;
  getIsTooling: () => boolean;
  /**
   * Completion providers are registered against the `soql` language, not an editor, so every SOQL
   * editor currently mounted would otherwise share them. This scopes the provider to one model.
   */
  isRelevantModel: (model: monaco.editor.ITextModel) => boolean;
}

/**
 * Suggestions are sorted by these prefixes so the entries most likely to be wanted lead the list.
 * Monaco sorts on `sortText` lexicographically and only falls back to its own fuzzy score for ties.
 */
const SORT_ORDER = {
  values: '1',
  fields: '2',
  relationships: '3',
  keywords: '4',
};

const TRIGGER_CHARACTERS = ['.', `'`, '(', ','];

/**
 * FILTER_TEXT_MUST_NOT_ADD_SPACES
 *
 * Do not build a `filterText` by joining two values with a space (`'Status Open Status'`) to make an
 * item matchable by both its API name and its label. Once the widget is open, monaco keeps filtering
 * against whatever the user types — including a space. Every item whose `filterText` contains a
 * space then stays in the list, scored on that space rather than on anything meaningful, so typing
 * the space in `SELECT Id, Name` leaves a stale, oddly ordered list open instead of dismissing it.
 *
 * A `filterText` is fine when it holds one value that happens to contain a space (a picklist value
 * like `In Progress`), because there the space is something the user genuinely types.
 */

export function registerSoqlCompletions(monaco: Monaco, options: SoqlCompletionOptions): monaco.IDisposable {
  // Describe results are already cached by the data layer, but memoizing the promises keeps a burst
  // of keystrokes from queuing up redundant cache reads. Lives and dies with the registration.
  const describeCache = new Map<string, Promise<DescribeSObjectResult | null>>();
  const globalDescribeCache = new Map<string, Promise<DescribeGlobalSObjectResult[]>>();

  function cacheKey(suffix: string) {
    const org = options.getSelectedOrg();
    return `${org?.uniqueId}:${options.getIsTooling()}:${suffix.toLowerCase()}`;
  }

  function describeObject(sobjectName: string): Promise<DescribeSObjectResult | null> {
    const key = cacheKey(sobjectName);
    if (!describeCache.has(key)) {
      const org = options.getSelectedOrg();
      const request = !org
        ? Promise.resolve(null)
        : describeSObject(org, sobjectName, options.getIsTooling())
            .then(({ data }) => data)
            .catch((ex) => {
              // Expected while the object name is still being typed. Drop the entry so a name that
              // failed transiently is not stuck without completions for the life of the editor.
              logger.log('[SOQL COMPLETIONS] Could not describe object', sobjectName, getErrorMessage(ex));
              describeCache.delete(key);
              return null;
            });
      describeCache.set(key, request);
    }
    return describeCache.get(key) as Promise<DescribeSObjectResult | null>;
  }

  function describeAllObjects(): Promise<DescribeGlobalSObjectResult[]> {
    const key = cacheKey('@global');
    if (!globalDescribeCache.has(key)) {
      const org = options.getSelectedOrg();
      const request = !org
        ? Promise.resolve([])
        : describeGlobal(org, options.getIsTooling())
            .then(({ data }) => data.sobjects.filter(({ queryable }) => queryable))
            .catch((ex) => {
              logger.warn('[SOQL COMPLETIONS] Could not describe global', getErrorMessage(ex));
              globalDescribeCache.delete(key);
              return [];
            });
      globalDescribeCache.set(key, request);
    }
    return globalDescribeCache.get(key) as Promise<DescribeGlobalSObjectResult[]>;
  }

  /**
   * The object the cursor's scope selects from. A relationship subquery names a child relationship
   * rather than an object, so it has to be resolved through the parent's child relationships.
   */
  async function resolveScopeSObject(context: SoqlContext): Promise<string | null> {
    if (!context.fromName) {
      return null;
    }
    if (context.isRelationshipSubquery && context.parentFromName) {
      const parentDescribe = await describeObject(context.parentFromName);
      const childRelationship = parentDescribe?.childRelationships.find(
        ({ relationshipName }) => relationshipName?.toLowerCase() === context.fromName?.toLowerCase(),
      );
      return childRelationship?.childSObject ?? null;
    }
    return context.fromName;
  }

  /** Walks a relationship path (`Account.Owner`) and returns the fields of the object it lands on */
  async function resolveFieldsForPath(sobjectName: string | null, relationshipPath: string[]): Promise<Field[]> {
    if (!sobjectName) {
      return [];
    }
    let describeResult = await describeObject(sobjectName);

    for (const segment of relationshipPath) {
      const relationshipField = describeResult?.fields.find(
        ({ relationshipName, referenceTo }) => !!referenceTo?.length && relationshipName?.toLowerCase() === segment.toLowerCase(),
      );
      if (!relationshipField) {
        return [];
      }
      describeResult = await describeObject(pickReferenceTarget(relationshipField));
    }

    return describeResult?.fields ?? [];
  }

  async function resolveField(sobjectName: string | null, dottedFieldPath: string): Promise<Field | null> {
    const segments = dottedFieldPath.split('.');
    const fieldName = segments.pop();
    const fields = await resolveFieldsForPath(sobjectName, segments);
    return fields.find(({ name }) => name.toLowerCase() === fieldName?.toLowerCase()) ?? null;
  }

  async function buildSuggestions(context: SoqlContext, range: monaco.IRange): Promise<monaco.languages.CompletionItem[]> {
    const scopeSObject = await resolveScopeSObject(context);
    const fields = () => resolveFieldsForPath(scopeSObject, context.relationshipPath);
    const toItems = (suggestions: SoqlSuggestion[]) => buildKeywordItems(monaco, suggestions, range);

    // Once the clause target has been typed, the useful suggestions become the clauses that follow it
    const isTypingClauseTarget = context.wordsAfterClauseKeyword === 0 || (context.wordsAfterClauseKeyword === 1 && !!context.partialWord);

    if (context.isInsideStringLiteral) {
      return context.comparisonField
        ? buildValueSuggestions(monaco, await resolveField(scopeSObject, context.comparisonField), range, true)
        : [];
    }

    switch (context.clause) {
      case 'NONE':
        return toItems(SOQL_QUERY_STARTERS);

      case 'SELECT': {
        const fieldItems = buildFieldItems(monaco, await fields(), range);
        if (context.relationshipPath.length) {
          return fieldItems;
        }
        const scopeDescribe = scopeSObject ? await describeObject(scopeSObject) : null;
        return [
          ...fieldItems,
          ...buildChildRelationshipSubqueryItems(monaco, scopeDescribe, range),
          ...toItems([
            ...SOQL_AGGREGATE_FUNCTIONS,
            ...SOQL_SELECT_FUNCTIONS,
            ...SOQL_DATE_FUNCTIONS,
            { label: 'FROM', insertText: 'FROM ', detail: 'Clause' },
          ]),
        ];
      }

      case 'FROM': {
        if (!isTypingClauseTarget) {
          return toItems(SOQL_CLAUSES_AFTER_FROM);
        }
        if (context.isRelationshipSubquery && context.parentFromName) {
          return buildChildRelationshipNameItems(monaco, await describeObject(context.parentFromName), range);
        }
        return buildSObjectItems(monaco, await describeAllObjects(), range);
      }

      case 'USING_SCOPE':
        return toItems(isTypingClauseTarget ? SOQL_SCOPES : SOQL_CLAUSES_AFTER_FROM.filter(({ label }) => label !== 'USING SCOPE'));

      case 'WHERE':
      case 'HAVING': {
        const comparisonField = context.comparisonField ? await resolveField(scopeSObject, context.comparisonField) : null;
        const valueItems = buildValueSuggestions(monaco, comparisonField, range, false);
        // A known set of values for the field being compared is the whole answer — mixing in every
        // field and keyword would bury it. Anything else falls through to the general WHERE list.
        if (valueItems.length) {
          return [...valueItems, ...toItems(SOQL_VALUE_KEYWORDS)];
        }
        return [
          ...buildFieldItems(monaco, await fields(), range),
          ...toItems([
            ...SOQL_LOGICAL_OPERATORS,
            ...SOQL_VALUE_KEYWORDS,
            ...(context.clause === 'HAVING' ? SOQL_AGGREGATE_FUNCTIONS : []),
            // The clauses that can still follow — anything ordered before WHERE is no longer valid
            ...SOQL_CLAUSES_AFTER_FROM.filter(({ label }) => label !== 'WHERE' && label !== 'USING SCOPE'),
          ]),
        ];
      }

      case 'GROUP_BY':
        return [
          ...buildFieldItems(
            monaco,
            (await fields()).filter(({ groupable }) => groupable),
            range,
          ),
          ...toItems([...SOQL_GROUP_BY_MODIFIERS, ...SOQL_DATE_FUNCTIONS, { label: 'HAVING', insertText: 'HAVING ', detail: 'Clause' }]),
        ];

      case 'ORDER_BY':
        return [
          ...buildFieldItems(
            monaco,
            (await fields()).filter(({ sortable }) => sortable),
            range,
          ),
          ...toItems([...SOQL_ORDER_BY_MODIFIERS, ...SOQL_DATE_FUNCTIONS]),
        ];

      case 'WITH':
        return toItems(SOQL_WITH_OPTIONS);

      case 'FOR':
        return toItems(SOQL_FOR_OPTIONS);

      case 'LIMIT':
        return toItems(SOQL_CLAUSES_AFTER_FROM.filter(({ label }) => label === 'OFFSET' || label.startsWith('FOR')));

      // OFFSET is the last clause before FOR ..., so nothing else can still follow it
      case 'OFFSET':
        return toItems(SOQL_CLAUSES_AFTER_FROM.filter(({ label }) => label.startsWith('FOR')));

      case 'TYPEOF':
        return [...buildFieldItems(monaco, await fields(), range), ...toItems(SOQL_TYPEOF_KEYWORDS)];

      default:
        return [];
    }
  }

  return monaco.languages.registerCompletionItemProvider('soql', {
    triggerCharacters: TRIGGER_CHARACTERS,
    provideCompletionItems: async (model, position, _completionContext, cancellationToken) => {
      if (!options.isRelevantModel(model)) {
        return { suggestions: [] };
      }

      try {
        const context = parseSoqlContext(model.getValue(), model.getOffsetAt(position));
        const wordUntilPosition = model.getWordUntilPosition(position);
        const range: monaco.IRange = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: wordUntilPosition.startColumn,
          endColumn: wordUntilPosition.endColumn,
        };

        const suggestions = await buildSuggestions(context, range);
        const spacedSuggestions = endsWithComma(model, position, range) ? suggestions.map(withLeadingSpace) : suggestions;

        return { suggestions: cancellationToken.isCancellationRequested ? [] : spacedSuggestions };
      } catch (ex) {
        logger.warn('[SOQL COMPLETIONS] Failed to build suggestions', getErrorMessage(ex));
        return { suggestions: [] };
      }
    },
  });
}

/** True when the text being replaced begins immediately after a comma, with no space between */
function endsWithComma(model: monaco.editor.ITextModel, position: monaco.Position, range: monaco.IRange): boolean {
  return model
    .getValueInRange({
      startLineNumber: position.lineNumber,
      startColumn: 1,
      endLineNumber: position.lineNumber,
      endColumn: range.startColumn,
    })
    .endsWith(',');
}

/**
 * Monaco replaces only the word under the cursor, so a suggestion accepted at `SELECT Id,` would
 * land as `SELECT Id,Name`. Nudging the inserted text over keeps the query readable.
 */
function withLeadingSpace(suggestion: monaco.languages.CompletionItem): monaco.languages.CompletionItem {
  return { ...suggestion, insertText: ` ${suggestion.insertText}` };
}

/**
 * Polymorphic lookups reference more than one object and SOQL forces a single choice when traversing.
 * `User` is the overwhelmingly common intent for `Owner`, otherwise the first target is used.
 */
function pickReferenceTarget({ referenceTo }: Field): string {
  if (!referenceTo?.length) {
    return '';
  }
  return referenceTo.length > 1 && referenceTo.includes('User') ? 'User' : referenceTo[0];
}

function buildKeywordItems(monaco: Monaco, suggestions: SoqlSuggestion[], range: monaco.IRange): monaco.languages.CompletionItem[] {
  return suggestions.map(({ label, insertText, detail, documentation, isSnippet }) => ({
    label,
    detail,
    documentation,
    insertText,
    insertTextRules: isSnippet ? monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet : undefined,
    kind: isSnippet ? monaco.languages.CompletionItemKind.Function : monaco.languages.CompletionItemKind.Keyword,
    sortText: `${SORT_ORDER.keywords}${label}`,
    range,
  }));
}

/**
 * One item per field, plus a second item for each lookup so the relationship can be traversed.
 * The field label is shown beside the API name but deliberately kept out of `filterText` — see
 * the note on FILTER_TEXT_MUST_NOT_ADD_SPACES below.
 */
function buildFieldItems(monaco: Monaco, fields: Field[], range: monaco.IRange): monaco.languages.CompletionItem[] {
  return fields.reduce((items: monaco.languages.CompletionItem[], field) => {
    items.push({
      label: { label: field.name, detail: ` ${field.label}`, description: field.type },
      insertText: field.name,
      kind: monaco.languages.CompletionItemKind.Field,
      sortText: `${SORT_ORDER.fields}${field.name}`,
      range,
    });

    if (field.relationshipName && field.referenceTo?.length) {
      items.push({
        label: { label: `${field.relationshipName}.`, detail: ` ${field.referenceTo.join(', ')}`, description: 'Relationship' },
        filterText: field.relationshipName,
        insertText: `${field.relationshipName}.`,
        kind: monaco.languages.CompletionItemKind.Reference,
        sortText: `${SORT_ORDER.relationships}${field.relationshipName}`,
        // Re-open the list right away so the related object's fields appear without another keystroke
        command: { id: 'editor.action.triggerSuggest', title: 'Suggest' },
        range,
      });
    }

    return items;
  }, []);
}

function buildSObjectItems(
  monaco: Monaco,
  sobjects: DescribeGlobalSObjectResult[],
  range: monaco.IRange,
): monaco.languages.CompletionItem[] {
  return sobjects.map(({ name, label, custom }) => ({
    label: { label: name, detail: ` ${label}`, description: custom ? 'Custom' : 'Standard' },
    insertText: name,
    kind: monaco.languages.CompletionItemKind.Class,
    sortText: `${SORT_ORDER.fields}${name}`,
    range,
  }));
}

function buildChildRelationshipNameItems(
  monaco: Monaco,
  describeResult: DescribeSObjectResult | null,
  range: monaco.IRange,
): monaco.languages.CompletionItem[] {
  return (describeResult?.childRelationships ?? [])
    .filter(({ relationshipName }) => !!relationshipName)
    .map(({ relationshipName, childSObject }) => ({
      label: { label: relationshipName as string, description: childSObject },
      insertText: relationshipName as string,
      kind: monaco.languages.CompletionItemKind.Class,
      sortText: `${SORT_ORDER.fields}${relationshipName}`,
      range,
    }));
}

/** Offers a ready-made child subquery for each child relationship on the object being selected from */
function buildChildRelationshipSubqueryItems(
  monaco: Monaco,
  describeResult: DescribeSObjectResult | null,
  range: monaco.IRange,
): monaco.languages.CompletionItem[] {
  return (describeResult?.childRelationships ?? [])
    .filter(({ relationshipName }) => !!relationshipName)
    .map(({ relationshipName, childSObject }) => ({
      label: { label: `(SELECT ... FROM ${relationshipName})`, description: `${childSObject} subquery` },
      filterText: relationshipName as string,
      insertText: `(SELECT \${1:Id} FROM ${relationshipName})`,
      insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      kind: monaco.languages.CompletionItemKind.Snippet,
      sortText: `${SORT_ORDER.relationships}${relationshipName}`,
      range,
    }));
}

/**
 * Values for the field on the left of a comparison — picklist entries, booleans and date literals.
 * When the cursor is already inside quotes the value is inserted bare, otherwise it is quoted.
 */
function buildValueSuggestions(
  monaco: Monaco,
  field: Field | null,
  range: monaco.IRange,
  isInsideStringLiteral: boolean,
): monaco.languages.CompletionItem[] {
  if (!field) {
    return [];
  }

  // Picklist values are org data and can contain quotes or backslashes, which would otherwise
  // terminate the literal early and leave the user with an invalid query
  const quote = (value: string) => {
    const escapedValue = escapeSoqlString(value);
    return isInsideStringLiteral ? escapedValue : `'${escapedValue}'`;
  };

  if (field.type === 'picklist' || field.type === 'multipicklist') {
    return (field.picklistValues ?? [])
      .filter(({ active }) => active)
      .map(({ value, label }) => ({
        label: { label: value, detail: label && label !== value ? ` ${label}` : undefined, description: 'Picklist value' },
        insertText: quote(value),
        kind: monaco.languages.CompletionItemKind.EnumMember,
        sortText: `${SORT_ORDER.values}${value}`,
        range,
      }));
  }

  if (isInsideStringLiteral) {
    return [];
  }

  if (field.type === 'boolean') {
    return ['TRUE', 'FALSE'].map((value) => ({
      label: value,
      detail: field.name,
      insertText: value,
      kind: monaco.languages.CompletionItemKind.Value,
      sortText: `${SORT_ORDER.values}${value}`,
      range,
    }));
  }

  if (field.type === 'date' || field.type === 'datetime') {
    return [...SOQL_DATE_LITERALS, ...SOQL_PARAMETERIZED_DATE_LITERALS].map(({ label, insertText, detail, isSnippet }) => ({
      label,
      detail,
      insertText,
      insertTextRules: isSnippet ? monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet : undefined,
      kind: monaco.languages.CompletionItemKind.Value,
      sortText: `${SORT_ORDER.values}${label}`,
      range,
    }));
  }

  return [];
}
