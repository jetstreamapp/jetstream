/* eslint-disable @typescript-eslint/no-unused-vars */
/** @jsx jsx */
import { jsx } from '@emotion/core';
import { logger } from '@jetstream/shared/client-logger';
import { useDebounce } from '@jetstream/shared/ui-utils';
import { WorkerMessage } from '@jetstream/types';
import { Fragment, FunctionComponent, useEffect, useState } from 'react';
import { useRecoilState, useRecoilValue } from 'recoil';
import { Query } from 'soql-parser-js';
import QueryWorker from '../../../workers/query.worker';
import * as fromQueryState from '../query.state';

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
  const [soql, setSoql] = useRecoilState(fromQueryState.querySoqlState);

  const debouncedFilters = useDebounce(filters);

  const [queryWorker] = useState(() => new QueryWorker());

  useEffect(() => {
    if (!!selectedSObject && selectedFields?.length > 0) {
      if (queryWorker) {
        const query: Query = {
          sObject: selectedSObject.name,
          fields: selectedFields,
          orderBy: orderByClauses,
          limit: queryLimit,
          offset: queryLimitSkip,
        };
        queryWorker.postMessage({
          name: 'composeQuery',
          data: {
            query: query,
            whereExpression: debouncedFilters,
          },
        });
      }
    } else if (soql !== '') {
      setSoql('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSObject, selectedFields, debouncedFilters, orderByClauses, queryLimit, queryLimitSkip]);

  useEffect(() => {
    if (queryWorker) {
      queryWorker.onmessage = (event: MessageEvent) => {
        const payload: WorkerMessage<'composeQuery', string> = event.data;
        logger.log({ payload });
        switch (payload.name) {
          case 'composeQuery': {
            if (payload.error) {
              // TODO:
            } else {
              setSoql(payload.data);
            }
            break;
          }
          default:
            break;
        }
      };
    }
  }, [queryWorker, setSoql]);

  return <Fragment />;
};

export default QueryBuilderSoqlUpdater;
