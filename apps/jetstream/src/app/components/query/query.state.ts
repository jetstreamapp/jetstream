import { ExpressionType, ListItemGroup, MapOf, QueryFields, QueryOrderByClause } from '@jetstream/types';
import { DescribeGlobalSObjectResult } from 'jsforce';
import { atom, selector } from 'recoil';
import { getField, FieldType, OrderByClause } from 'soql-parser-js';

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

export const queryFieldsMapState = atom<MapOf<QueryFields>>({
  key: 'query.queryFieldsMapState',
  default: {},
});

export const selectedQueryFieldsState = atom<string[]>({
  key: 'query.selectedQueryFieldsState',
  default: [],
});

export const selectQueryField = selector<FieldType[]>({
  key: 'query.selectQueryField',
  get: ({ get }) => get(selectedQueryFieldsState).map((field) => getField(field)),
});

export const filterQueryFieldsState = atom<ListItemGroup[]>({
  key: 'query.filterQueryFieldsState',
  default: [],
});

export const queryFiltersState = atom<ExpressionType>({
  key: 'query.queryFiltersState',
  default: {
    action: 'AND',
    groups: [],
    rows: [
      {
        key: 0,
        selected: {
          resource: '',
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

export const selectQueryLimit = selector<number | undefined>({
  key: 'query.selectQueryLimit',
  get: ({ get }) => {
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

// TODO: move to selector
export const queryIsFavoriteState = atom<boolean>({
  key: 'query.queryIsFavoriteState',
  default: false,
});

// TODO: handle org changes (e.x. subscribe to event and then update store I guess?)
