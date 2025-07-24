import { TITLES } from '@jetstream/shared/constants';
import { useLocationState, useTitle } from '@jetstream/shared/ui-utils';
import { SalesforceOrgUi } from '@jetstream/types';
import { Spinner } from '@jetstream/ui';
import { StateDebugObserver, fromQueryState, useQueryRestore } from '@jetstream/ui-core';
import { selectedOrgState } from '@jetstream/ui/app-state';
import { Fragment, useCallback, useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { useResetAtom } from 'jotai/utils';

export const Query = () => {
  useTitle(TITLES.QUERY);
  const location = useLocation();
  const locationState = useLocationState<{ soql?: string }>();
  const navigate = useNavigate();
  const selectedOrg = useAtomValue<SalesforceOrgUi>(selectedOrgState);
  const querySoqlState = useAtomValue(fromQueryState.querySoqlState);
  const isTooling = useAtomValue(fromQueryState.isTooling);
  const resetSobjects = useResetAtom(fromQueryState.sObjectsState);
  const resetSelectedSObject = useResetAtom(fromQueryState.selectedSObjectState);
  const resetSObjectFilterTerm = useResetAtom(fromQueryState.sObjectFilterTerm);
  const resetQueryFieldsKey = useResetAtom(fromQueryState.queryFieldsKey);
  const resetQueryFieldsMapState = useResetAtom(fromQueryState.queryFieldsMapState);
  const resetSelectedQueryFieldsState = useResetAtom(fromQueryState.selectedQueryFieldsState);
  const resetSelectedSubqueryFieldsState = useResetAtom(fromQueryState.selectedSubqueryFieldsState);
  const resetQueryFiltersState = useResetAtom(fromQueryState.queryFiltersState);
  const resetQueryHavingState = useResetAtom(fromQueryState.queryHavingState);
  const resetFieldFilterFunctions = useResetAtom(fromQueryState.fieldFilterFunctions);
  const resetQueryGroupByState = useResetAtom(fromQueryState.queryGroupByState);
  const resetQueryLimitSkip = useResetAtom(fromQueryState.queryLimitSkip);
  const resetQueryOrderByState = useResetAtom(fromQueryState.queryOrderByState);
  const resetQuerySoqlState = useResetAtom(fromQueryState.querySoqlState);

  const [priorSelectedOrg, setPriorSelectedOrg] = useState<string | null>(null);

  const [isRestoring, setIsRestoring] = useState(false);
  const startRestore = useCallback(() => setIsRestoring(true), []);
  const endRestore = useCallback(() => setIsRestoring(false), []);
  const [restore, errorMessage] = useQueryRestore(null, false, { startRestore: startRestore, endRestore: endRestore });

  // reset everything if the selected org changes
  useEffect(() => {
    if (selectedOrg && !priorSelectedOrg) {
      setPriorSelectedOrg(selectedOrg.uniqueId);
    } else if (selectedOrg && priorSelectedOrg !== selectedOrg.uniqueId) {
      const soql = querySoqlState;
      const tooling = isTooling;
      setPriorSelectedOrg(selectedOrg.uniqueId);
      resetSobjects();
      resetSelectedSObject();
      resetSObjectFilterTerm();
      resetQueryFieldsKey();
      resetQueryFieldsMapState();
      resetSelectedQueryFieldsState();
      resetSelectedSubqueryFieldsState();
      resetQueryFiltersState();
      resetQueryHavingState();
      resetFieldFilterFunctions();
      resetQueryGroupByState();
      resetQueryLimitSkip();
      resetQueryOrderByState();
      resetQuerySoqlState();

      if (location.pathname === '/query') {
        restore(soql, tooling);
      }
    } else if (!selectedOrg) {
      resetSobjects();
      resetSelectedSObject();
      resetSObjectFilterTerm();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOrg, priorSelectedOrg]);

  // safeguard to ensure that loading does not stay forever
  useEffect(() => {
    if (errorMessage && isRestoring) {
      setIsRestoring(false);
    }
  }, [errorMessage, isRestoring]);

  if (location.pathname.endsWith('/editor') && !querySoqlState && !locationState?.soql) {
    navigate('..');
  }

  return (
    <Fragment>
      <StateDebugObserver
        name="QUERY SNAPSHOT"
        atoms={[
          ['selectedSObjectState', fromQueryState.selectedSObjectState],
          ['queryFieldsKey', fromQueryState.queryFieldsKey],
          ['queryFieldsMapState', fromQueryState.queryFieldsMapState],
          ['selectedQueryFieldsState', fromQueryState.selectedQueryFieldsState],
          ['selectedSubqueryFieldsState', fromQueryState.selectedSubqueryFieldsState],
          ['queryFiltersState', fromQueryState.queryFiltersState],
          ['filterQueryFieldsState', fromQueryState.filterQueryFieldsState],
          ['queryHavingState', fromQueryState.queryHavingState],
          ['fieldFilterFunctions', fromQueryState.fieldFilterFunctions],
          ['queryGroupByState', fromQueryState.queryGroupByState],
          ['selectQueryKeyState', fromQueryState.selectQueryKeyState],
          ['queryLimit', fromQueryState.queryLimit],
          ['queryLimitSkip', fromQueryState.queryLimitSkip],
          ['queryOrderByState', fromQueryState.queryOrderByState],
        ]}
      />
      {isRestoring && <Spinner />}
      <Outlet />
    </Fragment>
  );
};

export default Query;
