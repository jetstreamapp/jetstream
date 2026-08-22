import { ANALYTICS_KEYS } from '@jetstream/shared/constants';
import { useNonInitialEffect } from '@jetstream/shared/ui-utils';
import { ExpressionType, ListItem, QueryFilterOperator, SalesforceOrgUi } from '@jetstream/types';
import { ExpressionContainer, ListOperatorSuggestion } from '@jetstream/ui';
import { useAmplitude } from '@jetstream/ui-core';
import { QUERY_FIELD_FUNCTIONS, QUERY_OPERATORS, getResourceTypeFnsFromFields } from '@jetstream/ui-core/shared';
import { FunctionComponent, useCallback, useEffect, useRef, useState } from 'react';

export interface QueryFilterProps {
  org: SalesforceOrgUi;
  sobject: string;
  fields: ListItem[];
  filtersOrHaving: ExpressionType;
  isHavingClause?: boolean;
  setFiltersOrHaving: (value: ExpressionType) => void;
  onLoadRelatedFields: (item: ListItem) => Promise<ListItem[]>;
}

const disableValueForOperators: QueryFilterOperator[] = ['isNull', 'isNotNull'];

export const QueryFilter: FunctionComponent<QueryFilterProps> = ({
  org,
  sobject,
  fields,
  filtersOrHaving,
  isHavingClause,
  setFiltersOrHaving,
  onLoadRelatedFields,
}) => {
  const isMounted = useRef(true);
  const { trackEvent } = useAmplitude();

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
    [setFiltersOrHaving],
  );

  const handleConvertToListOperator = useCallback(
    ({ toOperator, rowKeys }: ListOperatorSuggestion) => {
      trackEvent(ANALYTICS_KEYS.query_FilterConvertedToListOperator, {
        operator: toOperator,
        rowCount: rowKeys.length,
        isHavingClause: !!isHavingClause,
      });
    },
    [isHavingClause, trackEvent],
  );

  return (
    <ExpressionContainer
      org={org}
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
      onConvertToListOperator={handleConvertToListOperator}
      onChange={handleChange}
    />
  );
};

export default QueryFilter;
