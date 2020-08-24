import { orderStringsBy, convertFieldWithPolymorphicToQueryFields } from '@jetstream/shared/utils';
import {
  ExpressionType,
  ListItemGroup,
  MapOf,
  QueryFields,
  QueryHistoryItem,
  QueryOrderByClause,
  QueryFieldWithPolymorphic,
} from '@jetstream/types';
import { ChildRelationship, DescribeGlobalSObjectResult } from 'jsforce';
import { atom, selector } from 'recoil';
import { ComposeFieldTypeof, FieldType, getField, OrderByClause, Subquery } from 'soql-parser-js';

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

function getTypeOfField(polymorphicItems: { field: string; sobject: string; fields: string[] }): FieldType {
  const { field, sobject, fields } = polymorphicItems;
  if (!fields.includes('Id')) {
    // force Id onto query because it will be used in the ELSE section
    fields.unshift('Id');
  }
  const output: ComposeFieldTypeof = {
    field,
    conditions: [
      {
        type: 'WHEN',
        objectType: sobject,
        fieldList: fields,
      },
      {
        type: 'ELSE',
        fieldList: ['Id'],
      },
    ],
  };
  return getField(output);
}

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

export const queryFiltersState = atom<ExpressionType>({
  key: 'query.queryFiltersState',
  default: {
    action: 'AND',
    groups: [],
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

export const queryHistoryState = atom<MapOf<QueryHistoryItem>>({
  key: 'query.queryHistory',
  default: {},
});
