import { ListItem, QueryFieldWithPolymorphic, SalesforceOrgUi, UiSection } from '@jetstream/types';
import { Accordion, ScopedNotification } from '@jetstream/ui';
import { fromQueryState } from '@jetstream/ui-core';
import { useAtom, useAtomValue } from 'jotai';
import { useResetAtom } from 'jotai/utils';
import { useEffect } from 'react';
import QueryFieldFunction from './QueryFieldFunction';
import QueryFilter from './QueryFilter';
import QueryGroupByContainer from './QueryGroupBy';
import QueryFieldFnsTitleSummary from './accordion-titles/QueryFieldFnsTitleSummary';
import QueryFilterTitleSummary from './accordion-titles/QueryFilterTitleSummary';
import QueryGroupByTitleSummary from './accordion-titles/QueryGroupByTitleSummary';

export interface QueryBuilderAdvancedOptionsProps {
  org: SalesforceOrgUi;
  sobject: string;
  selectedFields: QueryFieldWithPolymorphic[];
  filterFields: ListItem[];
  additionalSections?: UiSection[];
  initialOpenIds?: string[];
  onLoadRelatedFields: (item: ListItem) => Promise<ListItem[]>;
}

export const QueryBuilderAdvancedOptions = ({
  org,
  sobject,
  selectedFields,
  filterFields,
  additionalSections = [],
  initialOpenIds = [],
  onLoadRelatedFields,
}: QueryBuilderAdvancedOptionsProps) => {
  const queryKey = useAtomValue(fromQueryState.selectQueryKeyState);
  const hasGroupByClause = useAtomValue(fromQueryState.hasGroupByConfigured);
  const groupByFields = useAtomValue(fromQueryState.groupByQueryFieldsState);
  const hasGroupByConfigured = useAtomValue(fromQueryState.hasGroupByConfigured);
  const hasHavingConfigured = useAtomValue(fromQueryState.hasHavingConfigured);
  const resetQueryHaving = useResetAtom(fromQueryState.queryHavingState);
  const [queryHaving, setQueryHaving] = useAtom(fromQueryState.queryHavingState);

  useEffect(() => {
    if (!hasGroupByConfigured && hasHavingConfigured) {
      resetQueryHaving();
    }
  }, [hasGroupByConfigured, hasHavingConfigured, resetQueryHaving]);

  return (
    <Accordion
      allowMultiple
      initOpenIds={initialOpenIds}
      sections={[
        {
          id: 'fieldFunctions',
          title: 'Field Functions',
          titleSummaryIfCollapsed: <QueryFieldFnsTitleSummary />,
          content: <QueryFieldFunction hasGroupByClause={hasGroupByClause} selectedFields={selectedFields} />,
        },
        {
          id: 'groupBy',
          title: 'Group By',
          titleSummaryIfCollapsed: <QueryGroupByTitleSummary />,
          content: (
            <QueryGroupByContainer key={queryKey} sobject={sobject} fields={groupByFields} onLoadRelatedFields={onLoadRelatedFields} />
          ),
        },
        {
          id: 'having',
          title: 'Having',
          titleSummaryIfCollapsed: <QueryFilterTitleSummary key={queryKey} isHavingClause />,
          content: hasGroupByClause ? (
            <QueryFilter
              key={queryKey}
              org={org}
              sobject={sobject}
              fields={filterFields}
              isHavingClause
              filtersOrHaving={queryHaving}
              setFiltersOrHaving={setQueryHaving}
              onLoadRelatedFields={onLoadRelatedFields}
            />
          ) : (
            <ScopedNotification theme="info">Having can only be combined with Group By</ScopedNotification>
          ),
        },
        ...additionalSections,
      ]}
    />
  );
};

export default QueryBuilderAdvancedOptions;
