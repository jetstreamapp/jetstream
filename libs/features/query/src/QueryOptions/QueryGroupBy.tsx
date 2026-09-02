import { ListItem, QueryGroupByClause } from '@jetstream/types';
import { Icon } from '@jetstream/ui';
import { fromQueryState } from '@jetstream/ui-core';
import { useAtom } from 'jotai';
import { Fragment, useState } from 'react';
import QueryGroupByRow from './QueryGroupByRow';

export interface QueryGroupByContainerProps {
  sobject: string;
  fields: ListItem[];
  onLoadRelatedFields: (item: ListItem) => Promise<ListItem[]>;
}

export const QueryGroupByContainer = ({ sobject, fields, onLoadRelatedFields }: QueryGroupByContainerProps) => {
  const [groupByClauses, setGroupByClauses] = useAtom(fromQueryState.queryGroupByState);
  const [nextKey, setNextKey] = useState(1);

  function handleUpdate(groupBy: QueryGroupByClause) {
    setGroupByClauses(groupByClauses.map((currItem) => (currItem.key === groupBy.key ? groupBy : currItem)));
  }

  function handleAdd() {
    setGroupByClauses(groupByClauses.concat(fromQueryState.initGroupByClause(nextKey)));
    setNextKey(nextKey + 1);
  }

  function handleDelete(deletedGroupBy: QueryGroupByClause) {
    // The delete button unmounts with its row, which would drop keyboard focus to <body> — land on
    // the previous row's delete button (row 0 always exists: an emptied list is refilled with one row)
    const deletedIndex = groupByClauses.findIndex((groupBy) => groupBy.key === deletedGroupBy.key);
    window.setTimeout(() => {
      const deleteButtons = document.querySelectorAll<HTMLElement>(
        '[role="group"][aria-label^="Group by row "] button[title="Delete Condition"]',
      );
      deleteButtons[Math.max(deletedIndex - 1, 0)]?.focus();
    });
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
