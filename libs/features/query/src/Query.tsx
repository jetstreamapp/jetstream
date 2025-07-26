import { TITLES } from '@jetstream/shared/constants';
import { useTitle } from '@jetstream/shared/ui-utils';
import { Spinner } from '@jetstream/ui';
import { fromQueryState, useQueryRestore } from '@jetstream/ui-core';
import { selectedOrgState } from '@jetstream/ui/app-state';
import { useAtomValue } from 'jotai';
import { useResetAtom } from 'jotai/utils';
import { Fragment, useCallback, useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';

export const Query = () => {
  useTitle(TITLES.QUERY);
  const location = useLocation();
  const selectedOrg = useAtomValue(selectedOrgState);
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

  return (
    <Fragment>
      {isRestoring && <Spinner />}
      <Outlet />
    </Fragment>
  );
};

export default Query;
