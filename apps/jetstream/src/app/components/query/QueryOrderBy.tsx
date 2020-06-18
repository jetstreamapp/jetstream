/* eslint-disable @typescript-eslint/no-unused-vars */
import { ExpressionType, ListItem, QueryFilterOperator, ListItemGroup, AscDesc, FirstLast } from '@jetstream/types';
import { ExpressionContainer, Combobox, ComboboxListItemGroup, ComboboxListItem, Picklist, FormRowButton } from '@jetstream/ui';
import React, { FunctionComponent, useState, useEffect, Fragment } from 'react';
import * as fromQueryState from './query.state';
import { useRecoilState } from 'recoil';
import QueryOrderBy from './QueryOrderByRow';

export interface QueryOrderByContainerProps {
  fields: ListItemGroup[];
}

const order: ListItem<string, AscDesc>[] = [
  { id: 'asc', label: 'Ascending (A to Z)', value: 'ASC' },
  { id: 'desc', label: 'Descending (Z to A)', value: 'DESC' },
];

const nulls: ListItem<string, FirstLast | null>[] = [
  { id: 'nullsIgnore', label: 'Ignore Nulls', value: null },
  { id: 'nullsFirst', label: 'Nulls First', value: 'FIRST' },
  { id: 'nullsLast', label: 'Nulls Last', value: 'LAST' },
];

export const QueryOrderByContainer: FunctionComponent<QueryOrderByContainerProps> = ({ fields }) => {
  const [orderByClauses, setOrderByClauses] = useRecoilState(fromQueryState.queryOrderByState);
  const [nextKey, setNextKey] = useState(1);
  // const [initialOrderBy] = useState(orderByClauses); // TODO: do we need this?

  return (
    <Fragment>
      {orderByClauses.map((orderBy) => (
        <QueryOrderBy
          key={orderBy.key}
          fields={fields}
          order={order}
          nulls={nulls}
          orderBy={orderBy}
          onChange={(updatedOrderby) => {
            // FIXME: allow multiple clauses - find correct item
            // maybe change store to use object instead of array
            setOrderByClauses([updatedOrderby]);
          }}
          onDelete={(deletedOrderby) => {
            // FIXME:
            setOrderByClauses([{ key: nextKey, field: null, fieldLabel: null, order: 'ASC', nulls: null }]);
            setNextKey(nextKey + 1);
          }}
        />
      ))}
    </Fragment>
  );
};

export default QueryOrderByContainer;
