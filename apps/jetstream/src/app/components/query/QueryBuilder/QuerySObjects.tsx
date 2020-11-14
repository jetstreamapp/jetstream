import { SalesforceOrgUi } from '@jetstream/types';
import { ConnectedSobjectList } from '@jetstream/ui';
import { DescribeGlobalSObjectResult } from 'jsforce';
import React, { Fragment, FunctionComponent } from 'react';
import { useRecoilState, useRecoilValue, useResetRecoilState } from 'recoil';
import { selectedOrgState } from '../../../app-state';
import * as fromQueryState from '../query.state';

export const QuerySObjects: FunctionComponent = () => {
  const selectedOrg = useRecoilValue<SalesforceOrgUi>(selectedOrgState);
  const [sobjects, setSobjects] = useRecoilState(fromQueryState.sObjectsState);
  const [selectedSObject, setSelectedSObject] = useRecoilState(fromQueryState.selectedSObjectState);
  const resetSelectedSubqueryFieldsState = useResetRecoilState(fromQueryState.selectedSubqueryFieldsState);
  const resetQueryFiltersState = useResetRecoilState(fromQueryState.queryFiltersState);
  const resetQueryOrderByState = useResetRecoilState(fromQueryState.queryOrderByState);
  const resetQueryLimit = useResetRecoilState(fromQueryState.queryLimit);
  const resetQueryLimitSkip = useResetRecoilState(fromQueryState.queryLimitSkip);
  const resetQuerySoqlState = useResetRecoilState(fromQueryState.querySoqlState);
  const resetQueryChildRelationships = useResetRecoilState(fromQueryState.queryChildRelationships);
  const resetQueryFieldsMapState = useResetRecoilState(fromQueryState.queryFieldsMapState);
  const resetQueryFieldsKey = useResetRecoilState(fromQueryState.queryFieldsKey);

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
    }
  }

  return (
    <Fragment>
      <ConnectedSobjectList
        selectedOrg={selectedOrg}
        sobjects={sobjects}
        selectedSObject={selectedSObject}
        onSobjects={handleSobjectChange}
        onSelectedSObject={setSelectedSObject}
      />
    </Fragment>
  );
};

export default QuerySObjects;
