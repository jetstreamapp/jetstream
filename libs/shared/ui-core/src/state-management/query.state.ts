import { convertFiltersToWhereClause, queryFilterHasValue } from '@jetstream/shared/ui-utils';
import { convertFieldWithPolymorphicToQueryFields, orderValues } from '@jetstream/shared/utils';
import {
  ChildRelationship,
  DescribeGlobalSObjectResult,
  ExpressionType,
  ListItem,
  QueryFieldWithPolymorphic,
  QueryFields,
  QueryGroupByClause,
  QueryOrderByClause,
} from '@jetstream/types';
import { isExpressionConditionType } from '@jetstream/ui';
import {
  FieldType,
  GroupByFieldClause,
  GroupByFnClause,
  OrderByClause,
  OrderByFieldClause,
  Subquery,
  WhereClause,
  getField,
} from '@jetstreamapp/soql-parser-js';
import { atom } from 'jotai';
import { atomWithReset } from 'jotai/utils';

export const isRestore = atom<boolean>(false);
export const isTooling = atom<boolean>(false);
export const sObjectsState = atomWithReset<DescribeGlobalSObjectResult[] | null>(null);
export const sObjectFilterTerm = atomWithReset<string>('');
export const selectedSObjectState = atomWithReset<DescribeGlobalSObjectResult | null>(null);
export const queryFieldsKey = atomWithReset<string | null>(null);
export const queryChildRelationships = atomWithReset<ChildRelationship[]>([]);
export const queryFieldsMapState = atomWithReset<Record<string, QueryFields>>({});
export const selectedQueryFieldsState = atomWithReset<QueryFieldWithPolymorphic[]>([]);
export const selectedSubqueryFieldsState = atomWithReset<Record<string, QueryFieldWithPolymorphic[]>>({});

export const querySubqueryFiltersState = atomWithReset<Record<string, ExpressionType>>({});
export const querySubqueryOrderByState = atomWithReset<Record<string, QueryOrderByClause[]>>({});
export const querySubqueryLimitState = atomWithReset<Record<string, string>>({});

/** Drives the page-level subquery config side panel. null = closed. */
export const subqueryConfigPanelState = atomWithReset<{ relationshipName: string; childSObject: string } | null>(null);

function orderByClausesToSoql(orderByClauses: QueryOrderByClause[]): OrderByClause[] {
  return orderByClauses
    .filter((orderBy) => !!orderBy.field)
    .map(
      (orderBy): OrderByFieldClause => ({
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        field: orderBy.field!,
        nulls: orderBy.nulls || undefined,
        order: orderBy.order,
      }),
    );
}

export const selectQueryField = atom<FieldType[]>((get) => {
  const filterFieldFns = get(fieldFilterFunctions).reduce((acc: Record<string, { fn: string; alias: string | null }>, item) => {
    if (!!item.selectedField && !!item.selectedFunction) {
      acc[item.selectedField.field] = { fn: item.selectedFunction, alias: item.alias };
    }
    return acc;
  }, {});
  let fields = convertFieldWithPolymorphicToQueryFields(get(selectedQueryFieldsState), filterFieldFns);
  const fieldsByChildRelName = get(selectedSubqueryFieldsState);
  const subqueryFilters = get(querySubqueryFiltersState);
  const subqueryOrderBys = get(querySubqueryOrderByState);
  const subqueryLimits = get(querySubqueryLimitState);
  // Concat subquery fields
  fields = fields.concat(
    orderValues(Object.keys(fieldsByChildRelName))
      // remove subquery if no fields
      .filter((relationshipName) => fieldsByChildRelName[relationshipName].length > 0)
      .map((relationshipName) => {
        const where = subqueryFilters[relationshipName]
          ? convertFiltersToWhereClause<WhereClause>(subqueryFilters[relationshipName])
          : undefined;
        const orderBy = subqueryOrderBys[relationshipName] ? orderByClausesToSoql(subqueryOrderBys[relationshipName]) : undefined;
        const limitRaw = subqueryLimits[relationshipName];
        const limit = limitRaw && limitRaw.trim() ? Number(limitRaw) : undefined;

        const subquery: Subquery = {
          fields: convertFieldWithPolymorphicToQueryFields(fieldsByChildRelName[relationshipName]),
          relationshipName,
          ...(where ? { where } : {}),
          ...(orderBy && orderBy.length ? { orderBy } : {}),
          ...(typeof limit === 'number' && !Number.isNaN(limit) ? { limit } : {}),
        };
        return getField({ subquery });
      }),
  );
  return fields;
});

export type SubqueryOptionsSummary = {
  filterCount: number;
  hasOrderBy: boolean;
  limit: string | null;
};

/**
 * Per-relationship summary of configured subquery options.
 * Drives the collapsed-accordion badge and any "is configured" checks.
 */
export const subqueryOptionsSummaryState = atom<Record<string, SubqueryOptionsSummary>>((get) => {
  const filters = get(querySubqueryFiltersState);
  const orderBys = get(querySubqueryOrderByState);
  const limits = get(querySubqueryLimitState);
  const keys = new Set<string>([...Object.keys(filters), ...Object.keys(orderBys), ...Object.keys(limits)]);
  const result: Record<string, SubqueryOptionsSummary> = {};
  keys.forEach((key) => {
    const filter = filters[key];
    const filterCount =
      filter?.rows?.flatMap((row) => (isExpressionConditionType(row) ? row : row.rows)).filter((row) => queryFilterHasValue(row)).length ||
      0;
    const hasOrderBy = (orderBys[key] || []).some((orderBy) => !!orderBy.field);
    const limitValue = limits[key]?.trim();
    const limit = limitValue ? limitValue : null;
    if (filterCount || hasOrderBy || limit) {
      result[key] = { filterCount, hasOrderBy, limit };
    }
  });
  return result;
});

export const filterQueryFieldsState = atomWithReset<ListItem[]>([]);
export const groupByQueryFieldsState = atomWithReset<ListItem[]>([]);
export const orderByQueryFieldsState = atomWithReset<ListItem[]>([]);

export type FieldFilterFunction = {
  selectedField: QueryFieldWithPolymorphic | null;
  selectedFunction: string | null;
  alias: string | null;
};

export const fieldFilterFunctions = atomWithReset<FieldFilterFunction[]>([
  {
    selectedField: null,
    selectedFunction: null,
    alias: null,
  },
]);

/** Used so that after a query restore happens, the query filters can be re-initialized */
export const queryRestoreKeyState = atom<number>(new Date().getTime());

export const selectQueryKeyState = atom<string>((get) => {
  const selectedSObject = get(selectedSObjectState);
  const queryRestoreKey = get(queryRestoreKeyState);
  return `${selectedSObject?.name || 'no-sobject'}-${queryRestoreKey}`;
});

export const queryFiltersState = atomWithReset<ExpressionType>({
  action: 'AND',
  rows: [
    {
      key: 0,
      selected: {
        resource: null,
        resourceGroup: null,
        function: null,
        operator: 'eq',
        value: '',
      },
    },
  ],
});

export function initGroupByClause(key = 0): QueryGroupByClause {
  return { key, field: null, fieldLabel: null, function: null };
}

export const queryGroupByState = atomWithReset<QueryGroupByClause[]>([initGroupByClause()]);

export const selectQueryGroupByBy = atom<(GroupByFieldClause | GroupByFnClause)[]>((get) =>
  get(queryGroupByState)
    ?.filter((groupBy) => !!groupBy.field)
    .map((orderBy): GroupByFieldClause | GroupByFnClause => {
      if (orderBy.function) {
        return {
          fn: {
            functionName: orderBy.function,
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            parameters: [orderBy.field!],
          },
        };
      }
      return {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        field: orderBy.field!,
      };
    }),
);

export const queryHavingState = atomWithReset<ExpressionType>({
  action: 'AND',
  rows: [
    {
      key: 0,
      selected: {
        resource: null,
        resourceGroup: null,
        function: null,
        operator: 'eq',
        value: '',
      },
    },
  ],
});

export const queryLimit = atomWithReset<string>('');

export const selectQueryLimitHasOverride = atom<boolean>((get) => {
  if (!get(isTooling)) {
    return false;
  }
  const hasRestrictedFieldSelected = (get(selectedQueryFieldsState) || []).some(
    ({ field }) => field === 'FullName' || field === 'Metadata',
  );
  return hasRestrictedFieldSelected;
});

export const selectQueryLimit = atom<number | undefined>((get) => {
  if (get(selectQueryLimitHasOverride)) {
    return 1;
  }

  const tempQueryLimit = get(queryLimit);
  if (tempQueryLimit) {
    return Number(tempQueryLimit);
  }
});

export const queryLimitSkip = atomWithReset<string>('');

export const selectQueryLimitSkip = atom<number | undefined>((get) => {
  const tempQueryLimitSkip = get(queryLimitSkip);
  if (tempQueryLimitSkip) {
    return Number(tempQueryLimitSkip);
  }
});

export function initOrderByClause(key = 0): QueryOrderByClause {
  return { key, field: null, fieldLabel: null, order: 'ASC', nulls: null };
}

export const queryOrderByState = atomWithReset<QueryOrderByClause[]>([initOrderByClause()]);

export const selectQueryOrderBy = atom<OrderByClause[]>((get) =>
  get(queryOrderByState)
    ?.filter((orderBy) => !!orderBy.field)
    .map(
      (orderBy): OrderByFieldClause => ({
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        field: orderBy.field!,
        nulls: orderBy.nulls || undefined,
        order: orderBy.order,
      }),
    ),
);

export const querySoqlState = atomWithReset<string>('');

// SOQL query with count() function
export const querySoqlCountState = atom<string>('');

export const queryIncludeDeletedRecordsState = atomWithReset<boolean>(false);

export const hasFiltersConfigured = atom<boolean>(
  (get) =>
    !!get(queryFiltersState)
      .rows?.flatMap((row) => (isExpressionConditionType(row) ? row : row.rows.map((row) => row)))
      .some((row) => queryFilterHasValue(row)),
);

export const hasHavingConfigured = atom<boolean>(
  (get) =>
    !!get(queryHavingState)
      .rows?.flatMap((row) => (isExpressionConditionType(row) ? row : row.rows.map((row) => row)))
      .some((row) => queryFilterHasValue(row)),
);

export const hasGroupByConfigured = atom<boolean>(
  (get) => get(queryGroupByState)?.filter((groupBy) => !!groupBy.field).length > 0 || false,
);

export const hasOrderByConfigured = atom<boolean>((get) => get(queryOrderByState).some((orderBy) => !!orderBy.field));

export const hasLimitConfigured = atom<boolean>((get) => !!get(queryLimit).trim() || !!get(queryLimitSkip).trim());

export const hasFieldFunctionsConfigured = atom<boolean>((get) =>
  get(fieldFilterFunctions).some((fn) => !!fn.selectedField && !!fn.selectedFunction),
);

export const hasQueryOptionsConfigured = atom<{ standard: number; advanced: number }>((get) => {
  return {
    standard: [get(hasFiltersConfigured), get(hasOrderByConfigured), get(hasLimitConfigured)].filter(Boolean).length,
    advanced: [get(hasFieldFunctionsConfigured), get(hasGroupByConfigured), get(hasHavingConfigured)].filter(Boolean).length,
  };
});
