import { DescribeGlobalSObjectResult, SalesforceOrgUi } from '@jetstream/types';
import { ConnectedSobjectList } from '@jetstream/ui';
import { fromQueryState, selectedOrgState } from '@jetstream/ui-core';
import { FunctionComponent } from 'react';
import { useRecoilValue, useResetRecoilState } from 'recoil';

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
  const selectedOrg = useRecoilValue<SalesforceOrgUi>(selectedOrgState);
  const resetSelectedSubqueryFieldsState = useResetRecoilState(fromQueryState.selectedSubqueryFieldsState);
  const resetQueryFiltersState = useResetRecoilState(fromQueryState.queryFiltersState);
  const resetQueryOrderByState = useResetRecoilState(fromQueryState.queryOrderByState);
  const resetQueryLimit = useResetRecoilState(fromQueryState.queryLimit);
  const resetQueryLimitSkip = useResetRecoilState(fromQueryState.queryLimitSkip);
  const resetQuerySoqlState = useResetRecoilState(fromQueryState.querySoqlState);
  const resetQueryChildRelationships = useResetRecoilState(fromQueryState.queryChildRelationships);
  const resetQueryFieldsMapState = useResetRecoilState(fromQueryState.queryFieldsMapState);
  const resetQueryFieldsKey = useResetRecoilState(fromQueryState.queryFieldsKey);
  const resetQueryIncludeDeletedRecordsState = useResetRecoilState(fromQueryState.queryIncludeDeletedRecordsState);

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
      isTooling={isTooling}
      onSobjects={handleSobjectChange}
      onSelectedSObject={setSelectedSObject}
    />
  );
};

export default QuerySObjects;
