import { useNonInitialEffect } from '@jetstream/shared/ui-utils';
import { ExpressionType, ListItem, QueryFilterOperator } from '@jetstream/types';
import { ExpressionContainer } from '@jetstream/ui';
import { FunctionComponent, useCallback, useEffect, useRef, useState } from 'react';
import { SetterOrUpdater } from 'recoil';
import { QUERY_FIELD_FUNCTIONS, QUERY_OPERATORS, getResourceTypeFnsFromFields } from '../utils/query-filter.utils';

export interface QueryFilterProps {
  sobject: string;
  fields: ListItem[];
  filtersOrHaving: ExpressionType;
  isHavingClause?: boolean;
  setFiltersOrHaving: SetterOrUpdater<ExpressionType>;
  onLoadRelatedFields: (item: ListItem) => Promise<ListItem[]>;
}

const disableValueForOperators: QueryFilterOperator[] = ['isNull', 'isNotNull'];

export const QueryFilter: FunctionComponent<QueryFilterProps> = ({
  sobject,
  fields,
  filtersOrHaving,
  isHavingClause,
  setFiltersOrHaving,
  onLoadRelatedFields,
}) => {
  const isMounted = useRef(true);

  const [initialQueryFilters] = useState(filtersOrHaving);
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
        setFiltersOrHaving(filters);
      }
    },
    [setFiltersOrHaving]
  );

  return (
    <ExpressionContainer
      expressionInitValue={initialQueryFilters}
      actionLabel="Filter When"
      operatorHelpText="Use the In or Not In operators to match against a list of values."
      resourceLabel="Field"
      resources={fields}
      resourceListHeader={sobject}
      resourceDrillInOnLoad={onLoadRelatedFields}
      functions={isHavingClause ? QUERY_FIELD_FUNCTIONS : undefined}
      operators={QUERY_OPERATORS}
      getResourceTypeFns={getResourceTypeFns}
      disableValueForOperators={disableValueForOperators}
      onChange={handleChange}
    />
  );
};

export default QueryFilter;
