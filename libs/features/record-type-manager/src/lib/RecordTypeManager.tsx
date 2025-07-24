/* eslint-disable @typescript-eslint/no-empty-interface, @typescript-eslint/no-empty-object-type */
import { TITLES } from '@jetstream/shared/constants';
import { useTitle } from '@jetstream/shared/ui-utils';
import { SalesforceOrgUi } from '@jetstream/types';
import { StateDebugObserver, fromRecordTypeManagerState } from '@jetstream/ui-core';
import { selectedOrgState } from '@jetstream/ui/app-state';
import { Fragment, FunctionComponent, useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { useResetAtom } from 'jotai/utils';

export interface RecordTypeManagerProps {}

export const RecordTypeManager: FunctionComponent<RecordTypeManagerProps> = () => {
  useTitle(TITLES.MANAGE_PERMISSIONS);
  const location = useLocation();
  const selectedOrg = useAtomValue<SalesforceOrgUi>(selectedOrgState);
  const resetRecordTypes = useResetAtom(fromRecordTypeManagerState.recordTypesState);
  const resetSelectedRecordTypes = useResetAtom(fromRecordTypeManagerState.selectedRecordTypeIds);

  const [priorSelectedOrg, setPriorSelectedOrg] = useState<string | null>(null);

  const hasSelectionsMade = useAtomValue(fromRecordTypeManagerState.hasSelectionsMade);

  // reset everything if the selected org changes
  useEffect(() => {
    if (selectedOrg && !priorSelectedOrg) {
      setPriorSelectedOrg(selectedOrg.uniqueId);
    } else if (selectedOrg && priorSelectedOrg !== selectedOrg.uniqueId) {
      setPriorSelectedOrg(selectedOrg.uniqueId);
      resetRecordTypes();
      resetSelectedRecordTypes();
    } else if (!selectedOrg) {
      resetRecordTypes();
      resetSelectedRecordTypes();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOrg, priorSelectedOrg]);

  return (
    <Fragment>
      <StateDebugObserver
        name="RECORD TYPES SNAPSHOT"
        atoms={[
          ['recordTypesState', fromRecordTypeManagerState.recordTypesState],
          ['selectedRecordTypeIds', fromRecordTypeManagerState.selectedRecordTypeIds],
          ['hasSelectionsMade', fromRecordTypeManagerState.hasSelectionsMade],
          ['recordTypesByFullName', fromRecordTypeManagerState.recordTypesByFullName],
          ['selectedRecordTypes', fromRecordTypeManagerState.selectedRecordTypes],
        ]}
      />
      {location.pathname.endsWith('/editor') && !hasSelectionsMade ? <Navigate to="." /> : <Outlet />}
    </Fragment>
  );
};
