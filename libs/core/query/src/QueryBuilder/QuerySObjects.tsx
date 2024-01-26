import { SalesforceOrgUi } from '@jetstream/types';
import { ConnectedSobjectList } from '@jetstream/ui';
import type { DescribeGlobalSObjectResult } from 'jsforce';
import { FunctionComponent } from 'react';
import { useResetRecoilState } from 'recoil';
import * as fromQueryState from '../query.state';
export interface QuerySObjectsProps {
  selectedOrg: SalesforceOrgUi;
  sobjects: DescribeGlobalSObjectResult[];
  selectedSObject: DescribeGlobalSObjectResult;
  isTooling: boolean;
  setSobjects: (selectedSObject: DescribeGlobalSObjectResult[]) => void;
  setSelectedSObject: (selectedSObject: DescribeGlobalSObjectResult) => void;
}
export const QuerySObjects: FunctionComponent<QuerySObjectsProps> = ({
  selectedOrg,
  selectedSObject,
  sobjects,
  isTooling,
  setSobjects,
  setSelectedSObject,
}) => {
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

  function handleSobjectChange(sobjects: DescribeGlobalSObjectResult[]) {
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
