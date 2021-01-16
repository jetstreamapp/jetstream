import { convertFieldWithPolymorphicToQueryFields, orderStringsBy } from '@jetstream/shared/utils';
import {
  ExpressionType,
  ListItemGroup,
  MapOf,
  QueryFields,
  QueryFieldWithPolymorphic,
  QueryHistoryItem,
  QueryOrderByClause,
} from '@jetstream/types';
import { ChildRelationship, DescribeGlobalSObjectResult } from 'jsforce';
import { atom, selector } from 'recoil';
import { FieldType, getField, OrderByClause, Subquery } from 'soql-parser-js';

export const isRestore = atom<boolean>({
  key: 'query.isRestore',
  default: false,
});

export const isTooling = atom<boolean>({
  key: 'query.isTooling',
  default: false,
});

export const sObjectsState = atom<DescribeGlobalSObjectResult[]>({
  key: 'query.sObjectsState',
  default: null,
});

export const selectedSObjectState = atom<DescribeGlobalSObjectResult>({
  key: 'query.selectedSObjectState',
  default: null,
});

export const queryFieldsKey = atom<string>({
  key: 'query.queryFieldsKey',
  default: null,
});

export const queryChildRelationships = atom<ChildRelationship[]>({
  key: 'query.queryChildRelationships',
  default: [],
});

export const queryFieldsMapState = atom<MapOf<QueryFields>>({
  key: 'query.queryFieldsMapState',
  default: {},
});

export const selectedQueryFieldsState = atom<QueryFieldWithPolymorphic[]>({
  key: 'query.selectedQueryFieldsState',
  default: [],
});

export const selectedSubqueryFieldsState = atom<MapOf<QueryFieldWithPolymorphic[]>>({
  key: 'query.selectedSubqueryFieldsState',
  default: {},
});

export const selectQueryField = selector<FieldType[]>({
  key: 'query.selectQueryField',
  get: ({ get }) => {
    let fields = convertFieldWithPolymorphicToQueryFields(get(selectedQueryFieldsState));
    const fieldsByChildRelName = get(selectedSubqueryFieldsState);
    // Concat subquery fields
    fields = fields.concat(
      orderStringsBy(Object.keys(fieldsByChildRelName))
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

export const filterQueryFieldsState = atom<ListItemGroup[]>({
  key: 'query.filterQueryFieldsState',
  default: [],
});

export const orderByQueryFieldsState = atom<ListItemGroup[]>({
  key: 'query.orderByQueryFieldsState',
  default: [],
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
      .filter((orderBy) => !!orderBy.field)
      .map((orderBy) => ({
        field: orderBy.field,
        nulls: orderBy.nulls,
        order: orderBy.order,
      })),
});

export const querySoqlState = atom<string>({
  key: 'query.querySoqlState',
  default: '',
});

export const queryIncludeDeletedRecordsState = atom<boolean>({
  key: 'query.queryIncludeDeletedRecordsState',
  default: false,
});

export const queryHistoryState = atom<MapOf<QueryHistoryItem>>({
  key: 'query.queryHistory',
  default: {},
});
