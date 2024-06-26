import { ListItem, QueryGroupByClause } from '@jetstream/types';
import { Icon } from '@jetstream/ui';
import { fromQueryState } from '@jetstream/ui-core';
import { Fragment, useState } from 'react';
import { useRecoilState } from 'recoil';
import QueryGroupByRow from './QueryGroupByRow';

export interface QueryGroupByContainerProps {
  sobject: string;
  fields: ListItem[];
  onLoadRelatedFields: (item: ListItem) => Promise<ListItem[]>;
}

export const QueryGroupByContainer = ({ sobject, fields, onLoadRelatedFields }: QueryGroupByContainerProps) => {
  const [groupByClauses, setGroupByClauses] = useRecoilState(fromQueryState.queryGroupByState);
  const [nextKey, setNextKey] = useState(1);

  function handleUpdate(groupBy: QueryGroupByClause) {
    setGroupByClauses(groupByClauses.map((currItem) => (currItem.key === groupBy.key ? groupBy : currItem)));
  }

  function handleAdd() {
    setGroupByClauses(groupByClauses.concat(fromQueryState.initGroupByClause(nextKey)));
    setNextKey(nextKey + 1);
  }

  function handleDelete(deletedGroupBy: QueryGroupByClause) {
    const tempGroupByClauses = groupByClauses.filter((groupBy) => groupBy.key !== deletedGroupBy.key);
    // ensure there is always at least one group by
    if (tempGroupByClauses.length === 0) {
      tempGroupByClauses.push(fromQueryState.initGroupByClause(nextKey));
      setNextKey(nextKey + 1);
    }
    setGroupByClauses(tempGroupByClauses);
  }

  return (
    <Fragment>
      {groupByClauses.map((groupBy, i) => (
        <QueryGroupByRow
          key={groupBy.key}
          groupNumber={i + 1}
          sobject={sobject}
          fields={fields}
          groupBy={groupBy}
          onChange={handleUpdate}
          onDelete={handleDelete}
          onLoadRelatedFields={onLoadRelatedFields}
        />
      ))}
      <div className="slds-m-top_small">
        <button className="slds-button slds-button_neutral" onClick={handleAdd} disabled={groupByClauses.length >= 5}>
          <Icon type="utility" icon="add" className="slds-button__icon slds-button__icon_left" omitContainer />
          Add Group By
        </button>
      </div>
    </Fragment>
  );
};

export default QueryGroupByContainer;
