import { DescribeGlobalSObjectResult } from '@jetstream/types';
import { ConnectedSobjectList } from '@jetstream/ui';
import { fromQueryState } from '@jetstream/ui-core';
import { selectedOrgState } from '@jetstream/ui/app-state';
import { useAtomValue } from 'jotai';
import { useResetAtom } from 'jotai/utils';
import { FunctionComponent } from 'react';

export interface QuerySObjectsProps {
  sobjects: DescribeGlobalSObjectResult[];
  selectedSObject: DescribeGlobalSObjectResult;
  isTooling: boolean;
  setSobjects: (selectedSObject: DescribeGlobalSObjectResult[] | null) => void;
  setSelectedSObject: (selectedSObject: DescribeGlobalSObjectResult | null) => void;
}
export const QuerySObjects: FunctionComponent<QuerySObjectsProps> = ({
  selectedSObject,
  sobjects,
  isTooling,
  setSobjects,
  setSelectedSObject,
}) => {
  const selectedOrg = useAtomValue(selectedOrgState);
  const resetSelectedSubqueryFieldsState = useResetAtom(fromQueryState.selectedSubqueryFieldsState);
  const resetQueryFiltersState = useResetAtom(fromQueryState.queryFiltersState);
  const resetQueryOrderByState = useResetAtom(fromQueryState.queryOrderByState);
  const resetQueryLimit = useResetAtom(fromQueryState.queryLimit);
  const resetQueryLimitSkip = useResetAtom(fromQueryState.queryLimitSkip);
  const resetQuerySoqlState = useResetAtom(fromQueryState.querySoqlState);
  const resetQueryChildRelationships = useResetAtom(fromQueryState.queryChildRelationships);
  const resetQueryFieldsMapState = useResetAtom(fromQueryState.queryFieldsMapState);
  const resetQueryFieldsKey = useResetAtom(fromQueryState.queryFieldsKey);
  const resetQueryIncludeDeletedRecordsState = useResetAtom(fromQueryState.queryIncludeDeletedRecordsState);

  function handleSobjectChange(sobjects: DescribeGlobalSObjectResult[] | null) {
    setSobjects(sobjects);
    if (!sobjects) {
      // sobjects cleared, reset other state
      resetQueryFieldsMapState();
      resetQueryFieldsKey();
      resetSelectedSubqueryFieldsState();
      resetQueryFiltersState();
      resetQueryOrderByState();
      resetQueryLimit();
      resetQueryLimitSkip();
      resetQuerySoqlState();
      resetQueryChildRelationships();
      resetQueryIncludeDeletedRecordsState();
    }
  }

  return (
    <ConnectedSobjectList
      selectedOrg={selectedOrg}
      sobjects={sobjects}
      selectedSObject={selectedSObject}
      recentItemsEnabled
      recentItemsKey="sobject"
      isTooling={isTooling}
      onSobjects={handleSobjectChange}
      onSelectedSObject={setSelectedSObject}
    />
  );
};

export default QuerySObjects;
