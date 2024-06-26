import { TITLES } from '@jetstream/shared/constants';
import { useTitle } from '@jetstream/shared/ui-utils';
import { SalesforceOrgUi } from '@jetstream/types';
import { StateDebugObserver, selectedOrgState } from '@jetstream/ui-core';
import { Fragment, FunctionComponent, useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useRecoilValue, useResetRecoilState } from 'recoil';
import * as fromMassUpdateState from './mass-update-records.state';

export const MassUpdateRecords: FunctionComponent = () => {
  useTitle(TITLES.MASS_UPDATE_RECORDS);
  const location = useLocation();
  const selectedOrg = useRecoilValue<SalesforceOrgUi>(selectedOrgState);
  const resetRowMapState = useResetRecoilState(fromMassUpdateState.rowsMapState);
  const resetSObjectsState = useResetRecoilState(fromMassUpdateState.sObjectsState);
  const resetSelectedSObjectsState = useResetRecoilState(fromMassUpdateState.selectedSObjectsState);

  const isConfigured = useRecoilValue(fromMassUpdateState.isConfigured);

  const [priorSelectedOrg, setPriorSelectedOrg] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      setPriorSelectedOrg(selectedOrg.uniqueId);
      resetRowMapState();
      resetSelectedSObjectsState();
    };
  }, []);

  // reset everything if the selected org changes
  useEffect(() => {
    if (selectedOrg && !priorSelectedOrg) {
      setPriorSelectedOrg(selectedOrg.uniqueId);
    } else if (selectedOrg && priorSelectedOrg !== selectedOrg.uniqueId) {
      setPriorSelectedOrg(selectedOrg.uniqueId);
      resetRowMapState();
      resetSObjectsState();
      resetSelectedSObjectsState();
    } else if (!selectedOrg) {
      resetRowMapState();
      resetSObjectsState();
      resetSelectedSObjectsState();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOrg, priorSelectedOrg]);

  return (
    <Fragment>
      <StateDebugObserver
        name="CREATE FIELDS SNAPSHOT"
        atoms={[
          ['sObjectsState', fromMassUpdateState.sObjectsState],
          ['selectedSObjectsState', fromMassUpdateState.selectedSObjectsState],
          ['rowsState', fromMassUpdateState.rowsState],
          ['rowsMapState', fromMassUpdateState.rowsMapState],
          ['sObjectsState', fromMassUpdateState.sObjectsState],
          ['selectedSObjectsState', fromMassUpdateState.selectedSObjectsState],
          ['isConfigured', fromMassUpdateState.isConfigured],
        ]}
      />
      {location.pathname.endsWith('/deployment') && !isConfigured ? <Navigate to="." /> : <Outlet />}
    </Fragment>
  );
};
