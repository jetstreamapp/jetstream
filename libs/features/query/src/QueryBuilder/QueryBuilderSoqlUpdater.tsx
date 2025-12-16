import { fromQueryState } from '@jetstream/ui-core';
import { composeSoqlQuery } from '@jetstream/ui-core/shared';
import { soqlQueryFormatOptionsState } from '@jetstream/ui/app-state';
import { GroupByFieldClause, GroupByFnClause, Query } from '@jetstreamapp/soql-parser-js';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { FunctionComponent, useEffect } from 'react';

/**
 * This component ensures that the entire state tree is not re-rendered each time some query element needs to be modified
 * Since this has no UI elements and no children, any values updated here do not cause child re-renders
 */

export const QueryBuilderSoqlUpdater: FunctionComponent = () => {
  const soqlQueryFormatOptions = useAtomValue(soqlQueryFormatOptionsState);
  const selectedSObject = useAtomValue(fromQueryState.selectedSObjectState);
  const selectedFields = useAtomValue(fromQueryState.selectQueryField);
  const filters = useAtomValue(fromQueryState.queryFiltersState);
  const havingClauses = useAtomValue(fromQueryState.queryHavingState);
  const groupByClauses = useAtomValue(fromQueryState.selectQueryGroupByBy);
  const orderByClauses = useAtomValue(fromQueryState.selectQueryOrderBy);
  const queryLimit = useAtomValue(fromQueryState.selectQueryLimit);
  const queryLimitSkip = useAtomValue(fromQueryState.selectQueryLimitSkip);
  const [soql, setSoql] = useAtom(fromQueryState.querySoqlState);
  const setSoqlCount = useSetAtom(fromQueryState.querySoqlCountState);

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
      setSoql(composeSoqlQuery(query, soqlQueryFormatOptions, filters, hasGroupBy ? havingClauses : undefined));

      const queryCount: Query = {
        ...query,
        fields: [{ type: 'FieldFunctionExpression', functionName: 'COUNT', parameters: [] }],
        orderBy: undefined,
      };

      if (query.groupBy || query.having) {
        setSoqlCount('');
      } else {
        setSoqlCount(composeSoqlQuery(queryCount, soqlQueryFormatOptions, filters));
      }
    } else if (soql !== '') {
      setSoql('');
      setSoqlCount('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSObject, selectedFields, filters, havingClauses, groupByClauses, orderByClauses, queryLimit, queryLimitSkip]);

  return null;
};

export default QueryBuilderSoqlUpdater;
