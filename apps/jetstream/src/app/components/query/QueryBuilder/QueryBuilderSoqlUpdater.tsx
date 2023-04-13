import { FunctionComponent, useEffect } from 'react';
import { useRecoilState, useRecoilValue } from 'recoil';
import { GroupByFieldClause, GroupByFnClause, Query } from 'soql-parser-js';
import * as fromQueryState from '../query.state';
import { composeSoqlQuery } from '../utils/query-utils';

/**
 * This component ensures that the entire state tree is not re-rendered each time some query element needs to be modified
 * Since this has no UI elements and no children, any values updated here do not cause child re-renders
 */

export const QueryBuilderSoqlUpdater: FunctionComponent = () => {
  const selectedSObject = useRecoilValue(fromQueryState.selectedSObjectState);
  const selectedFields = useRecoilValue(fromQueryState.selectQueryField);
  const filters = useRecoilValue(fromQueryState.queryFiltersState);
  const havingClauses = useRecoilValue(fromQueryState.queryHavingState);
  const groupByClauses = useRecoilValue(fromQueryState.selectQueryGroupByBy);
  const orderByClauses = useRecoilValue(fromQueryState.selectQueryOrderBy);
  const queryLimit = useRecoilValue(fromQueryState.selectQueryLimit);
  const queryLimitSkip = useRecoilValue(fromQueryState.selectQueryLimitSkip);
  const [soql, setSoql] = useRecoilState(fromQueryState.querySoqlState);

  useEffect(() => {
    if (!!selectedSObject && selectedFields?.length > 0) {
      const validGroupByClauses = groupByClauses.filter((item) => !!(item as GroupByFieldClause).field || !!(item as GroupByFnClause).fn);
      const hasGroupBy = !!validGroupByClauses.length;
      const query: Query = {
        sObject: selectedSObject.name,
        fields: selectedFields,
        groupBy: hasGroupBy ? validGroupByClauses : undefined,
        orderBy: orderByClauses,
        limit: queryLimit,
        offset: queryLimitSkip,
      };
      setSoql(composeSoqlQuery(query, filters, hasGroupBy ? havingClauses : undefined));
      // if (queryWorker) {
      //   queryWorker.postMessage({
      //     name: 'composeQuery',
      //     data: {
      //       query: query,
      //       whereExpression: debouncedFilters,
      //     },
      //   });
      // }
    } else if (soql !== '') {
      setSoql('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSObject, selectedFields, filters, havingClauses, groupByClauses, orderByClauses, queryLimit, queryLimitSkip]);

  return null;
};

export default QueryBuilderSoqlUpdater;
