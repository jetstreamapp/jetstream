/* eslint-disable @typescript-eslint/no-unused-vars */
import { useDebounce } from '@jetstream/shared/ui-utils';
import { Fragment, FunctionComponent, useEffect } from 'react';
import { useRecoilState, useRecoilValue } from 'recoil';
import { Query } from 'soql-parser-js';
import * as fromQueryState from '../query.state';
import { composeSoqlQuery } from '../utils/query-utils';

/**
 * This component ensures that the entire state tree is not re-rendered each time some query element needs to be modified
 * Since this has no UI elements and no children, any values updated here do not cause child re-renders
 */

export const QueryBuilderSoqlUpdater: FunctionComponent = () => {
  const selectedSObject = useRecoilValue(fromQueryState.selectedSObjectState);
  const filters = useRecoilValue(fromQueryState.queryFiltersState);
  const orderByClauses = useRecoilValue(fromQueryState.selectQueryOrderBy);
  const queryLimit = useRecoilValue(fromQueryState.selectQueryLimit);
  const queryLimitSkip = useRecoilValue(fromQueryState.selectQueryLimitSkip);
  const selectedFields = useRecoilValue(fromQueryState.selectQueryField);
  const selectedSubqueryFields = useRecoilValue(fromQueryState.selectedSubqueryFieldsState);
  const [soql, setSoql] = useRecoilState(fromQueryState.querySoqlState);

  const debouncedFilters = useDebounce(filters);

  // const [queryWorker] = useState(() => new Worker(new URL('../../../workers/query.worker', import.meta.url)));

  useEffect(() => {
    if (!!selectedSObject && selectedFields?.length > 0) {
      const query: Query = {
        sObject: selectedSObject.name,
        fields: selectedFields,
        orderBy: orderByClauses,
        limit: queryLimit,
        offset: queryLimitSkip,
      };
      setSoql(composeSoqlQuery(query, debouncedFilters));
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
  }, [selectedSObject, selectedFields, debouncedFilters, orderByClauses, queryLimit, queryLimitSkip]);

  // useEffect(() => {
  //   if (queryWorker) {
  //     queryWorker.onmessage = (event: MessageEvent) => {
  //       const payload: WorkerMessage<'composeQuery', string> = event.data;
  //       logger.log({ payload });
  //       switch (payload.name) {
  //         case 'composeQuery': {
  //           if (payload.error) {
  //             // TODO:
  //           } else {
  //             setSoql(payload.data);
  //           }
  //           break;
  //         }
  //         default:
  //           break;
  //       }
  //     };
  //   }
  // }, [queryWorker, setSoql]);

  return <Fragment />;
};

export default QueryBuilderSoqlUpdater;
