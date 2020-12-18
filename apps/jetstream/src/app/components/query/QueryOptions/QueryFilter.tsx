/* eslint-disable @typescript-eslint/no-unused-vars */
import { useNonInitialEffect } from '@jetstream/shared/ui-utils';
import { ListItemGroup, QueryFilterOperator } from '@jetstream/types';
import { ExpressionContainer } from '@jetstream/ui';
import React, { FunctionComponent, useEffect, useRef, useState } from 'react';
import { useRecoilState } from 'recoil';
import * as fromQueryState from '../query.state';
import { getResourceTypeFnsFromFields, QUERY_OPERATORS } from '../utils/query-filter.utils';

export interface QueryFilterProps {
  fields: ListItemGroup[];
}

const disableValueForOperators: QueryFilterOperator[] = ['isNull', 'isNotNull'];

export const QueryFilter: FunctionComponent<QueryFilterProps> = ({ fields }) => {
  const isMounted = useRef(null);

  const [queryFilters, setQueryFilters] = useRecoilState(fromQueryState.queryFiltersState);
  const [initialQueryFilters] = useState(queryFilters);
  const [getResourceTypeFns, setResourceTypeFns] = useState(() => getResourceTypeFnsFromFields(fields));

  useEffect(() => {
    isMounted.current = true;
    return () => (isMounted.current = false);
  }, []);

  // ensure that we have fields in scope
  useNonInitialEffect(() => {
    setResourceTypeFns(getResourceTypeFnsFromFields(fields));
  }, [fields]);

  return (
    <ExpressionContainer
      expressionInitValue={initialQueryFilters}
      actionLabel="Filter When"
      resourceHelpText="Related fields must be selected to appear in this list and only fields that allow filtering are included."
      resourceLabel="Fields"
      resources={fields}
      operators={QUERY_OPERATORS}
      getResourceTypeFns={getResourceTypeFns}
      disableValueForOperators={disableValueForOperators}
      onChange={(filters) => {
        if (isMounted.current) {
          setQueryFilters(filters);
        }
      }}
    />
  );
};

export default QueryFilter;
