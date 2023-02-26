/* eslint-disable @typescript-eslint/no-unused-vars */
import { useNonInitialEffect } from '@jetstream/shared/ui-utils';
import { ExpressionType, ListItemGroup, QueryFilterOperator } from '@jetstream/types';
import { ExpressionContainer } from '@jetstream/ui';
import { FunctionComponent, useCallback, useEffect, useRef, useState } from 'react';
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
    return () => {
      isMounted.current = false;
    };
  }, []);

  // ensure that we have fields in scope
  useNonInitialEffect(() => {
    setResourceTypeFns(getResourceTypeFnsFromFields(fields));
  }, [fields]);

  const handleChange = useCallback(
    (filters: ExpressionType) => {
      if (isMounted.current) {
        setQueryFilters(filters);
      }
    },
    [setQueryFilters]
  );

  return (
    <ExpressionContainer
      expressionInitValue={initialQueryFilters}
      actionLabel="Filter When"
      resourceHelpText="Related fields must be selected to appear in this list and only fields that allow filtering are included."
      operatorHelpText="Use the In or Not In operators to match against a list of values."
      resourceLabel="Fields"
      resources={fields}
      operators={QUERY_OPERATORS}
      getResourceTypeFns={getResourceTypeFns}
      disableValueForOperators={disableValueForOperators}
      onChange={handleChange}
    />
  );
};

export default QueryFilter;
