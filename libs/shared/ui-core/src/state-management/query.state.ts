import { queryFilterHasValue } from '@jetstream/shared/ui-utils';
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
  getField,
} from '@jetstreamapp/soql-parser-js';
import { atom, selector } from 'recoil';

export const isRestore = atom<boolean>({
  key: 'query.isRestore',
  default: false,
});

export const isTooling = atom<boolean>({
  key: 'query.isTooling',
  default: false,
});

export const sObjectsState = atom<DescribeGlobalSObjectResult[] | null>({
  key: 'query.sObjectsState',
  default: null,
});

export const sObjectFilterTerm = atom<string>({
  key: 'query.sObjectFilterTerm',
  default: '',
});

export const selectedSObjectState = atom<DescribeGlobalSObjectResult | null>({
  key: 'query.selectedSObjectState',
  default: null,
});

export const queryFieldsKey = atom<string | null>({
  key: 'query.queryFieldsKey',
  default: null,
});

export const queryChildRelationships = atom<ChildRelationship[]>({
  key: 'query.queryChildRelationships',
  default: [],
});

export const queryFieldsMapState = atom<Record<string, QueryFields>>({
  key: 'query.queryFieldsMapState',
  default: {},
});

export const selectedQueryFieldsState = atom<QueryFieldWithPolymorphic[]>({
  key: 'query.selectedQueryFieldsState',
  default: [],
});

export const selectedSubqueryFieldsState = atom<Record<string, QueryFieldWithPolymorphic[]>>({
  key: 'query.selectedSubqueryFieldsState',
  default: {},
});

export const selectQueryField = selector<FieldType[]>({
  key: 'query.selectQueryField',
  get: ({ get }) => {
    const filterFieldFns = get(fieldFilterFunctions).reduce((acc: Record<string, { fn: string; alias: string | null }>, item) => {
      if (!!item.selectedField && !!item.selectedFunction) {
        acc[item.selectedField.field] = { fn: item.selectedFunction, alias: item.alias };
      }
      return acc;
    }, {});
    let fields = convertFieldWithPolymorphicToQueryFields(get(selectedQueryFieldsState), filterFieldFns);
    const fieldsByChildRelName = get(selectedSubqueryFieldsState);
    // Concat subquery fields
    fields = fields.concat(
      orderValues(Object.keys(fieldsByChildRelName))
        // remove subquery if no fields
        .filter((relationshipName) => fieldsByChildRelName[relationshipName].length > 0)
        .map((relationshipName) => {
          const subquery: Subquery = {
            fields: convertFieldWithPolymorphicToQueryFields(fieldsByChildRelName[relationshipName]),
            relationshipName,
          };
          return getField({ subquery });
        })
    );
    return fields;
  },
});

export const filterQueryFieldsState = atom<ListItem[]>({
  key: 'query.filterQueryFieldsState',
  default: [],
});

export const groupByQueryFieldsState = atom<ListItem[]>({
  key: 'query.groupByQueryFieldsState',
  default: [],
});

export const orderByQueryFieldsState = atom<ListItem[]>({
  key: 'query.orderByQueryFieldsState',
  default: [],
});

export type FieldFilterFunction = {
  selectedField: QueryFieldWithPolymorphic | null;
  selectedFunction: string | null;
  alias: string | null;
};

export const fieldFilterFunctions = atom<FieldFilterFunction[]>({
  key: 'query.fieldFilterFunctions',
  default: [
    {
      selectedField: null,
      selectedFunction: null,
      alias: null,
    },
  ],
});

/** Used so that after a query restore happens, the query filters can be re-initialized */
export const queryRestoreKeyState = atom<number>({
  key: 'query.queryRestoreKeyState',
  default: new Date().getTime(),
});

export const selectQueryKeyState = selector<string>({
  key: 'query.selectQueryKeyState',
  get: ({ get }) => {
    const selectedSObject = get(selectedSObjectState);
    const queryRestoreKey = get(queryRestoreKeyState);
    return `${selectedSObject?.name || 'no-sobject'}-${queryRestoreKey}`;
  },
});

export const queryFiltersState = atom<ExpressionType>({
  key: 'query.queryFiltersState',
  default: {
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
  },
});

export function initGroupByClause(key = 0): QueryGroupByClause {
  return { key, field: null, fieldLabel: null, function: null };
}

export const queryGroupByState = atom<QueryGroupByClause[]>({
  key: 'query.queryGroupByState',
  default: [initGroupByClause()],
});

export const selectQueryGroupByBy = selector<(GroupByFieldClause | GroupByFnClause)[]>({
  key: 'query.selectQueryGroupByBy',
  get: ({ get }) =>
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
});

export const queryHavingState = atom<ExpressionType>({
  key: 'query.queryHavingState',
  default: {
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
  },
});

export const queryLimit = atom<string>({
  key: 'query.queryLimit',
  default: '',
});

export const selectQueryLimitHasOverride = selector<boolean>({
  key: 'query.selectQueryLimitHasOverride',
  get: ({ get }) => {
    if (!get(isTooling)) {
      return false;
    }
    const hasRestrictedFieldSelected = (get(selectedQueryFieldsState) || []).some(
      ({ field }) => field === 'FullName' || field === 'Metadata'
    );
    return hasRestrictedFieldSelected;
  },
});

export const selectQueryLimit = selector<number | undefined>({
  key: 'query.selectQueryLimit',
  get: ({ get }) => {
    if (get(selectQueryLimitHasOverride)) {
      return 1;
    }

    const tempQueryLimit = get(queryLimit);
    if (tempQueryLimit) {
      return Number(tempQueryLimit);
    }
  },
});

export const queryLimitSkip = atom<string>({
  key: 'query.queryLimitSkip',
  default: '',
});

export const selectQueryLimitSkip = selector<number | undefined>({
  key: 'query.selectQueryLimitSkip',
  get: ({ get }) => {
    const tempQueryLimitSkip = get(queryLimitSkip);
    if (tempQueryLimitSkip) {
      return Number(tempQueryLimitSkip);
    }
  },
});

export function initOrderByClause(key = 0): QueryOrderByClause {
  return { key, field: null, fieldLabel: null, order: 'ASC', nulls: null };
}

export const queryOrderByState = atom<QueryOrderByClause[]>({
  key: 'query.queryOrderByState',
  default: [initOrderByClause()],
});

export const selectQueryOrderBy = selector<OrderByClause[]>({
  key: 'query.selectQueryOrderBy',
  get: ({ get }) =>
    get(queryOrderByState)
      ?.filter((orderBy) => !!orderBy.field)
      .map(
        (orderBy): OrderByFieldClause => ({
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          field: orderBy.field!,
          nulls: orderBy.nulls || undefined,
          order: orderBy.order,
        })
      ),
});

export const querySoqlState = atom<string>({
  key: 'query.querySoqlState',
  default: '',
});

// SOQL query with count() function
export const querySoqlCountState = atom<string>({
  key: 'query.querySoqlCountState',
  default: '',
});

export const queryIncludeDeletedRecordsState = atom<boolean>({
  key: 'query.queryIncludeDeletedRecordsState',
  default: false,
});

export const hasFiltersConfigured = selector<boolean>({
  key: 'query.hasFiltersConfigured',
  get: ({ get }) =>
    !!get(queryFiltersState)
      .rows?.flatMap((row) => (isExpressionConditionType(row) ? row : row.rows.map((row) => row)))
      .some((row) => queryFilterHasValue(row)),
});

export const hasHavingConfigured = selector<boolean>({
  key: 'query.hasHavingConfigured',
  get: ({ get }) =>
    !!get(queryHavingState)
      .rows?.flatMap((row) => (isExpressionConditionType(row) ? row : row.rows.map((row) => row)))
      .some((row) => queryFilterHasValue(row)),
});

export const hasGroupByConfigured = selector<boolean>({
  key: 'query.hasGroupByConfigured',
  get: ({ get }) => get(queryGroupByState)?.filter((groupBy) => !!groupBy.field).length > 0 || false,
});

export const hasOrderByConfigured = selector<boolean>({
  key: 'query.hasOrderByConfigured',
  get: ({ get }) => get(queryOrderByState).some((orderBy) => !!orderBy.field),
});

export const hasLimitConfigured = selector<boolean>({
  key: 'query.hasLimitConfigured',
  get: ({ get }) => !!get(queryLimit).trim() || !!get(queryLimitSkip).trim(),
});

export const hasFieldFunctionsConfigured = selector<boolean>({
  key: 'query.hasFieldFunctionsConfigured',
  get: ({ get }) => get(fieldFilterFunctions).some((fn) => !!fn.selectedField && !!fn.selectedFunction),
});

export const hasQueryOptionsConfigured = selector<{ standard: number; advanced: number }>({
  key: 'query.hasQueryOptionsConfigured',
  get: ({ get }) => {
    return {
      standard: [get(hasFiltersConfigured), get(hasOrderByConfigured), get(hasLimitConfigured)].filter(Boolean).length,
      advanced: [get(hasFieldFunctionsConfigured), get(hasGroupByConfigured), get(hasHavingConfigured)].filter(Boolean).length,
    };
  },
});
