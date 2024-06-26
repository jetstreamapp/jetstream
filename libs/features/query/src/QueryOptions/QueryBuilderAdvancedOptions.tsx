import { ListItem, QueryFieldWithPolymorphic, UiSection } from '@jetstream/types';
import { Accordion, ScopedNotification } from '@jetstream/ui';
import { fromQueryState } from '@jetstream/ui-core';
import { useEffect } from 'react';
import { useRecoilState, useRecoilValue, useResetRecoilState } from 'recoil';
import QueryFieldFunction from './QueryFieldFunction';
import QueryFilter from './QueryFilter';
import QueryGroupByContainer from './QueryGroupBy';
import QueryFieldFnsTitleSummary from './accordion-titles/QueryFieldFnsTitleSummary';
import QueryFilterTitleSummary from './accordion-titles/QueryFilterTitleSummary';
import QueryGroupByTitleSummary from './accordion-titles/QueryGroupByTitleSummary';

export interface QueryBuilderAdvancedOptionsProps {
  sobject: string;
  selectedFields: QueryFieldWithPolymorphic[];
  filterFields: ListItem[];
  additionalSections?: UiSection[];
  initialOpenIds?: string[];
  onLoadRelatedFields: (item: ListItem) => Promise<ListItem[]>;
}

export const QueryBuilderAdvancedOptions = ({
  sobject,
  selectedFields,
  filterFields,
  additionalSections = [],
  initialOpenIds = [],
  onLoadRelatedFields,
}: QueryBuilderAdvancedOptionsProps) => {
  const queryKey = useRecoilValue(fromQueryState.selectQueryKeyState);
  const hasGroupByClause = useRecoilValue(fromQueryState.hasGroupByConfigured);
  const groupByFields = useRecoilValue(fromQueryState.groupByQueryFieldsState);
  const hasGroupByConfigured = useRecoilValue(fromQueryState.hasGroupByConfigured);
  const hasHavingConfigured = useRecoilValue(fromQueryState.hasHavingConfigured);
  const resetQueryHaving = useResetRecoilState(fromQueryState.queryHavingState);
  const [queryHaving, setQueryHaving] = useRecoilState(fromQueryState.queryHavingState);

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
