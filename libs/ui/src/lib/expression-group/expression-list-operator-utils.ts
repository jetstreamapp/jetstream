import {
  AndOr,
  ExpressionConditionRowSelectedItems,
  ExpressionConditionType,
  ExpressionGetResourceTypeFns,
  ExpressionRowValueType,
  ExpressionType,
  ListItem,
  Maybe,
  QueryFilterOperator,
} from '@jetstream/types';
import { isExpressionConditionType, isExpressionGroupType } from './expression-utils';

/**
 * Repeated conditions on one field only collapse into a list operator when the conjunction agrees:
 * `A = 1 OR A = 2` is `A IN (1, 2)` and `A != 1 AND A != 2` is `A NOT IN (1, 2)`.
 * The other two combinations (`A = 1 AND A = 2`, `A != 1 OR A != 2`) are degenerate and never collapsed.
 */
const COLLAPSIBLE_OPERATOR_BY_ACTION: Record<AndOr, { from: QueryFilterOperator; to: QueryFilterOperator }> = {
  OR: { from: 'eq', to: 'in' },
  AND: { from: 'ne', to: 'notIn' },
};

/**
 * Single value inputs mapped to the multi value input that replaces them under a list operator.
 * The date and datetime pickers are intentionally absent - they have no multi value equivalent,
 * so rows using them are never offered for conversion.
 */
const MULTI_VALUE_TYPE_BY_SINGLE_VALUE_TYPE: Partial<Record<ExpressionRowValueType, ExpressionRowValueType>> = {
  SELECT: 'SELECT-MULTI',
  TEXT: 'TEXTAREA',
  LOOKUP: 'TEXTAREA',
};

export interface ListOperatorSuggestion {
  /**
   * Identifies the suggestion by what it targets rather than by the rows it currently matches, so that
   * editing a value or adding another condition does not resurrect a suggestion the user dismissed.
   */
  id: string;
  groupKey?: number;
  resource: string;
  fromOperator: QueryFilterOperator;
  toOperator: QueryFilterOperator;
  toOperatorLabel: string;
  rowKeys: number[];
  targetResourceType: ExpressionRowValueType;
  /** merged values from every matched row - trimmed, de-duped, in first-occurrence order */
  values: string[];
}

/** The merged values in the shape the target value input expects */
export function getListOperatorSuggestionValue({ targetResourceType, values }: ListOperatorSuggestion): string | string[] {
  return targetResourceType === 'SELECT-MULTI' ? values : values.join('\n');
}

/**
 * Find sets of conditions that repeat the same field with the same operator and could be replaced by a
 * single `In` / `Not In` condition. Root level rows are evaluated against the expression action and each
 * group's rows against that group's action - both are uniform conjunctions, so collapsing a subset of
 * rows is always equivalent to the original.
 */
export function getListOperatorSuggestions(
  expression: ExpressionType,
  getResourceTypeFns: Maybe<ExpressionGetResourceTypeFns>,
  operators: ListItem[],
): ListOperatorSuggestion[] {
  // Without the resource type functions there is no way to know which value input a list operator would
  // render for the field, so no conversion can be proven safe.
  if (!getResourceTypeFns) {
    return [];
  }

  const rootRows = expression.rows.filter(isExpressionConditionType);
  const suggestions = getSuggestionsForRows(rootRows, expression.action, getResourceTypeFns, operators, {});

  expression.rows.forEach((row) => {
    if (isExpressionGroupType(row)) {
      suggestions.push(...getSuggestionsForRows(row.rows, row.action, getResourceTypeFns, operators, { groupKey: row.key }));
    }
  });

  return suggestions;
}

function getSuggestionsForRows(
  rows: ExpressionConditionType[],
  action: AndOr,
  getResourceTypeFns: ExpressionGetResourceTypeFns,
  operators: ListItem[],
  { groupKey }: { groupKey?: number },
): ListOperatorSuggestion[] {
  const { from: fromOperator, to: toOperator } = COLLAPSIBLE_OPERATOR_BY_ACTION[action];
  const toOperatorLabel = operators.find(({ value }) => value === toOperator)?.label;
  // the list operators are not guaranteed to be offered by every consumer of the expression builder
  if (!toOperatorLabel) {
    return [];
  }

  const rowsByResource = new Map<string, ExpressionConditionType[]>();
  rows
    .filter((row) => isCollapsibleRow(row, fromOperator))
    .forEach((row) => {
      const resourceKey = getResourceKey(row.selected);
      const matchedRows = rowsByResource.get(resourceKey);
      if (matchedRows) {
        matchedRows.push(row);
      } else {
        rowsByResource.set(resourceKey, [row]);
      }
    });

  const suggestions: ListOperatorSuggestion[] = [];
  rowsByResource.forEach((matchedRows) => {
    if (matchedRows.length < 2) {
      return;
    }
    const [firstRow] = matchedRows;
    const sourceResourceType = getRowResourceType(firstRow);
    const targetResourceType = MULTI_VALUE_TYPE_BY_SINGLE_VALUE_TYPE[sourceResourceType];
    // every row must use the same input, otherwise the merged values cannot all be represented
    if (!targetResourceType || matchedRows.some((row) => getRowResourceType(row) !== sourceResourceType)) {
      return;
    }
    const values = mergeRowValues(matchedRows);
    if (!isTargetResourceTypeAvailable(firstRow.selected, toOperator, targetResourceType, values, getResourceTypeFns)) {
      return;
    }
    suggestions.push({
      id: `${groupKey ?? 'root'}|${getResourceKey(firstRow.selected)}|${toOperator}`,
      groupKey,
      resource: firstRow.selected.resource || '',
      fromOperator,
      toOperator,
      toOperatorLabel,
      rowKeys: matchedRows.map(({ key }) => key),
      targetResourceType,
      values,
    });
  });

  return suggestions;
}

function getResourceKey({ resourceGroup, resource }: ExpressionConditionRowSelectedItems): string {
  return `${resourceGroup || ''}|${resource}`;
}

/** The row's resourceType drives which value input is rendered, and defaults to TEXT the same way the row does */
function getRowResourceType(row: ExpressionConditionType): ExpressionRowValueType {
  return row.resourceType || 'TEXT';
}

function isCollapsibleRow(row: ExpressionConditionType, fromOperator: QueryFilterOperator): boolean {
  const { resource, operator, function: fieldFunction, value } = row.selected;
  return (
    !!resource &&
    operator === fromOperator &&
    // aggregate and date functions (the having clause) change how the value is serialized, so they are left alone
    !fieldFunction &&
    (Array.isArray(value) ? value.length > 0 : !!value)
  );
}

function mergeRowValues(rows: ExpressionConditionType[]): string[] {
  const values: string[] = [];
  const seenValues = new Set<string>();
  rows.forEach(({ selected }) => {
    // single value inputs never contain newlines, but splitting also handles a pasted list
    const rowValues = Array.isArray(selected.value) ? selected.value : `${selected.value ?? ''}`.split('\n');
    rowValues.forEach((rowValue) => {
      const value = rowValue.trim();
      if (value && !seenValues.has(value)) {
        seenValues.add(value);
        values.push(value);
      }
    });
  });
  return values;
}

/**
 * A list operator can offer a different set of value inputs than the current operator does - a date field
 * offers a multi-select of relative values but has no multi value date picker, for example. Ask the
 * resource type functions what the list operator would render rather than duplicating field metadata rules.
 */
function isTargetResourceTypeAvailable(
  selected: ExpressionConditionRowSelectedItems,
  toOperator: QueryFilterOperator,
  targetResourceType: ExpressionRowValueType,
  values: string[],
  getResourceTypeFns: ExpressionGetResourceTypeFns,
): boolean {
  const selectedWithListOperator: ExpressionConditionRowSelectedItems = {
    ...selected,
    operator: toOperator,
    resourceType: undefined,
    value: values,
  };
  try {
    const availableTypes = getResourceTypeFns.getTypes?.(selectedWithListOperator);
    if (availableTypes?.length) {
      return availableTypes.some(({ value }) => value === targetResourceType);
    }
    return getResourceTypeFns.getType(selectedWithListOperator) === targetResourceType;
  } catch {
    return false;
  }
}
