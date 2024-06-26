/* eslint-disable @typescript-eslint/no-unused-vars */
import { AscDesc, FirstLast, ListItem, QueryOrderByClause } from '@jetstream/types';
import { Icon } from '@jetstream/ui';
import { fromQueryState } from '@jetstream/ui-core';
import React, { Fragment, FunctionComponent, useState } from 'react';
import { useRecoilState } from 'recoil';
import QueryOrderByRow from './QueryOrderByRow';

export interface QueryOrderByContainerProps {
  sobject: string;
  fields: ListItem[];
  onLoadRelatedFields: (item: ListItem) => Promise<ListItem[]>;
}

const order: ListItem<AscDesc>[] = [
  { id: 'asc', label: 'Ascending (A to Z)', value: 'ASC' },
  { id: 'desc', label: 'Descending (Z to A)', value: 'DESC' },
];

const nulls: ListItem<FirstLast | null>[] = [
  { id: 'nullsIgnore', label: 'Ignore Nulls', value: null },
  { id: 'nullsFirst', label: 'Nulls First', value: 'FIRST' },
  { id: 'nullsLast', label: 'Nulls Last', value: 'LAST' },
];

export const QueryOrderByContainer: FunctionComponent<QueryOrderByContainerProps> = React.memo(
  ({ sobject, fields, onLoadRelatedFields }) => {
    const [orderByClauses, setOrderByClauses] = useRecoilState(fromQueryState.queryOrderByState);
    const [nextKey, setNextKey] = useState(1);

    function handleUpdate(orderby: QueryOrderByClause) {
      setOrderByClauses(orderByClauses.map((currOrderBy) => (currOrderBy.key === orderby.key ? orderby : currOrderBy)));
    }

    function handleAdd() {
      setOrderByClauses(orderByClauses.concat(fromQueryState.initOrderByClause(nextKey)));
      setNextKey(nextKey + 1);
    }

    function handleDelete(deletedOrderby: QueryOrderByClause) {
      const tempOrderByClauses = orderByClauses.filter((orderBy) => orderBy.key !== deletedOrderby.key);
      // ensure there is always at least one order by
      if (tempOrderByClauses.length === 0) {
        tempOrderByClauses.push(fromQueryState.initOrderByClause(nextKey));
        setNextKey(nextKey + 1);
      }
      setOrderByClauses(tempOrderByClauses);
    }

    return (
      <Fragment>
        {orderByClauses.map((orderBy, i) => (
          <QueryOrderByRow
            key={orderBy.key}
            groupNumber={i + 1}
            sobject={sobject}
            fields={fields}
            order={order}
            nulls={nulls}
            orderBy={orderBy}
            onChange={handleUpdate}
            onDelete={handleDelete}
            onLoadRelatedFields={onLoadRelatedFields}
          />
        ))}
        <div className="slds-m-top_small">
          <button className="slds-button slds-button_neutral" onClick={handleAdd} disabled={orderByClauses.length >= 5}>
            <Icon type="utility" icon="add" className="slds-button__icon slds-button__icon_left" omitContainer />
            Add Order By
          </button>
        </div>
      </Fragment>
    );
  }
);

export default QueryOrderByContainer;
