import { convertFiltersToWhereClause, queryFilterHasValue } from '@jetstream/shared/ui-utils';
import {
  convertFieldWithPolymorphicToQueryFields,
  getSubqueryPathWithAncestors,
  getSubqueryRelationshipName,
  isDirectChildSubqueryPath,
  isSubqueryPathBelow,
  orderValues,
} from '@jetstream/shared/utils';
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
import { getSubqueryPathFromFieldKey } from '@jetstream/ui-core/shared';
import {
  FieldType,
  GroupByFieldClause,
  GroupByFnClause,
  OrderByClause,
  OrderByFieldClause,
  Subquery,
  WhereClause,
  getField,
  isFieldSubquery,
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
/**
 * Subqueries can be nested, so every subquery map below is keyed by the relationship path from the
 * root object (`Contacts`, `Contacts.Cases`) rather than by relationship name alone.
 */
export const selectedSubqueryFieldsState = atomWithReset<Record<string, QueryFieldWithPolymorphic[]>>({});

export const querySubqueryFiltersState = atomWithReset<Record<string, ExpressionType>>({});
export const querySubqueryOrderByState = atomWithReset<Record<string, QueryOrderByClause[]>>({});
export const querySubqueryLimitState = atomWithReset<Record<string, string>>({});

/** Drives the page-level subquery config side panel. null = closed. */
export const subqueryConfigPanelState = atomWithReset<{ relationshipPath: string; childSObject: string } | null>(null);

function orderByClausesToSoql(orderByClauses: QueryOrderByClause[]): OrderByClause[] {
  return orderByClauses
    .filter((orderBy) => !!orderBy.field)
    .map((orderBy): OrderByFieldClause => ({
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      field: orderBy.field!,
      nulls: orderBy.nulls || undefined,
      order: orderBy.order,
    }));
}

interface SubqueryStateByPath {
  fieldsByPath: Record<string, QueryFieldWithPolymorphic[]>;
  filtersByPath: Record<string, ExpressionType>;
  orderBysByPath: Record<string, QueryOrderByClause[]>;
  limitsByPath: Record<string, string>;
  /** Every configured subquery path, including ancestors that may not have any fields selected of their own */
  allPaths: Set<string>;
}

/**
 * Subquery state is stored in flat maps keyed by relationship path (`Contacts`, `Contacts.Cases`), so the
 * nested SOQL structure is rebuilt here by walking one level at a time.
 *
 * A subquery is only emitted when it, or something nested within it, has fields selected.
 */
function buildSubqueryFields(parentRelationshipPath: string, subqueryState: SubqueryStateByPath): FieldType[] {
  const { fieldsByPath, filtersByPath, orderBysByPath, limitsByPath, allPaths } = subqueryState;

  return orderValues(Array.from(allPaths).filter((path) => isDirectChildSubqueryPath(path, parentRelationshipPath)))
    .map((relationshipPath) => {
      const nestedFields = buildSubqueryFields(relationshipPath, subqueryState);
      const selectedFields = convertFieldWithPolymorphicToQueryFields(fieldsByPath[relationshipPath] || []);
      // remove subquery if neither it nor anything nested within it has fields
      if (selectedFields.length === 0 && nestedFields.length === 0) {
        return null;
      }

      const where = filtersByPath[relationshipPath] ? convertFiltersToWhereClause<WhereClause>(filtersByPath[relationshipPath]) : undefined;
      const orderBy = orderBysByPath[relationshipPath] ? orderByClausesToSoql(orderBysByPath[relationshipPath]) : undefined;
      const limitRaw = limitsByPath[relationshipPath];
      const limit = limitRaw && limitRaw.trim() ? Number(limitRaw) : undefined;

      const subquery: Subquery = {
        fields: selectedFields.concat(nestedFields),
        relationshipName: getSubqueryRelationshipName(relationshipPath),
        ...(where ? { where } : {}),
        ...(orderBy && orderBy.length ? { orderBy } : {}),
        ...(typeof limit === 'number' && !Number.isNaN(limit) ? { limit } : {}),
      };
      return getField({ subquery });
    })
    .filter((field): field is FieldType => !!field);
}

export const selectQueryField = atom<FieldType[]>((get) => {
  const filterFieldFns = get(fieldFilterFunctions).reduce((acc: Record<string, { fn: string; alias: string | null }>, item) => {
    if (!!item.selectedField && !!item.selectedFunction) {
      acc[item.selectedField.field] = { fn: item.selectedFunction, alias: item.alias };
    }
    return acc;
  }, {});
  const fields = convertFieldWithPolymorphicToQueryFields(get(selectedQueryFieldsState), filterFieldFns);
  const fieldsByPath = get(selectedSubqueryFieldsState);

  const allPaths = new Set<string>();
  Object.keys(fieldsByPath).forEach((relationshipPath) => {
    getSubqueryPathWithAncestors(relationshipPath).forEach((path) => allPaths.add(path));
  });

  // Concat subquery fields
  return fields.concat(
    buildSubqueryFields('', {
      fieldsByPath,
      filtersByPath: get(querySubqueryFiltersState),
      orderBysByPath: get(querySubqueryOrderByState),
      limitsByPath: get(querySubqueryLimitState),
      allPaths,
    }),
  );
});

/**
 * Number of top level subqueries the generated query will contain.
 * Derived from the composed fields so it always agrees with the SOQL, including a subquery that only
 * has fields on something nested within it.
 */
export const selectSubqueryCount = atom<number>((get) => get(selectQueryField).filter(isFieldSubquery).length);

/**
 * Clear the filter / order by / limit options for a single subquery, leaving its field selection and any
 * nested subqueries intact.
 */
export const clearSubqueryOptionsForPath = atom(null, (get, set, relationshipPath: string) => {
  const omitPath = <T>(prev: Record<string, T>): Record<string, T> => {
    if (!(relationshipPath in prev)) {
      return prev;
    }
    const next = { ...prev };
    delete next[relationshipPath];
    return next;
  };

  set(querySubqueryFiltersState, omitPath);
  set(querySubqueryOrderByState, omitPath);
  set(querySubqueryLimitState, omitPath);
});

/**
 * Remove every subquery nested beneath `relationshipPath`, including its filter/orderBy/limit options and the
 * field selections backing the field pickers. The subquery at `relationshipPath` itself is left alone, since it
 * belongs to the level above. An empty path is the root object, which clears every subquery.
 */
export const clearSubqueriesBelow = atom(null, (get, set, relationshipPath: string) => {
  const omitClearedPaths = <T>(prev: Record<string, T>): Record<string, T> =>
    Object.keys(prev).reduce((output: Record<string, T>, path) => {
      if (!isSubqueryPathBelow(path, relationshipPath)) {
        output[path] = prev[path];
      }
      return output;
    }, {});

  set(selectedSubqueryFieldsState, omitClearedPaths);
  set(querySubqueryFiltersState, omitClearedPaths);
  set(querySubqueryOrderByState, omitClearedPaths);
  set(querySubqueryLimitState, omitClearedPaths);

  // The pickers read their checkmarks from the fields map, so clear the selections there too.
  // Metadata is left in place so re-expanding a relationship does not have to re-fetch it.
  set(queryFieldsMapState, (prev) =>
    Object.keys(prev).reduce((output: Record<string, QueryFields>, key) => {
      const subqueryPath = getSubqueryPathFromFieldKey(key);
      output[key] =
        subqueryPath !== null && isSubqueryPathBelow(subqueryPath, relationshipPath)
          ? { ...prev[key], selectedFields: new Set<string>() }
          : prev[key];
      return output;
    }, {}),
  );

  const configPanel = get(subqueryConfigPanelState);
  if (configPanel && isSubqueryPathBelow(configPanel.relationshipPath, relationshipPath)) {
    set(subqueryConfigPanelState, null);
  }
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
    .map((orderBy): OrderByFieldClause => ({
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      field: orderBy.field!,
      nulls: orderBy.nulls || undefined,
      order: orderBy.order,
    })),
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
