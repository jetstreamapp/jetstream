import { SalesforceOrgUi } from '@jetstream/types';
import { useSetAtom } from 'jotai';
import { useResetAtom } from 'jotai/utils';
import { Fragment, FunctionComponent, useState } from 'react';
import { CreateNewObjectModal } from './CreateNewObjectModal';
import * as fromCreateObjectState from './create-object-state';

export interface CreateNewObjectProps {
  selectedOrg: SalesforceOrgUi;
  initialSelectedProfiles?: string[];
  initialSelectedPermissionSets?: string[];
  onClose: (createdNewObject?: boolean) => void;
}

export const CreateNewObject: FunctionComponent<CreateNewObjectProps> = ({
  selectedOrg,
  initialSelectedProfiles = [],
  initialSelectedPermissionSets = [],
  onClose,
}) => {
  const setSelectedProfiles = useSetAtom(fromCreateObjectState.selectedProfilesState);
  const setSelectedPermissionSets = useSetAtom(fromCreateObjectState.selectedPermissionSetsState);

  const resetLabelState = useResetAtom(fromCreateObjectState.labelState);
  const resetPluralLabelState = useResetAtom(fromCreateObjectState.pluralLabelState);
  const resetStartsWithState = useResetAtom(fromCreateObjectState.startsWithState);
  const resetApiNameState = useResetAtom(fromCreateObjectState.apiNameState);
  const resetDescriptionState = useResetAtom(fromCreateObjectState.descriptionState);
  const resetRecordNameState = useResetAtom(fromCreateObjectState.recordNameState);
  const resetDataTypeState = useResetAtom(fromCreateObjectState.dataTypeState);
  const resetDisplayFormatState = useResetAtom(fromCreateObjectState.displayFormatState);
  const resetStartingNumberState = useResetAtom(fromCreateObjectState.startingNumberState);
  const resetAllowReportsState = useResetAtom(fromCreateObjectState.allowReportsState);
  const resetAllowActivitiesState = useResetAtom(fromCreateObjectState.allowActivitiesState);
  const resetTrackFieldHistoryState = useResetAtom(fromCreateObjectState.trackFieldHistoryState);
  const resetAllowInChatterGroupsState = useResetAtom(fromCreateObjectState.allowInChatterGroupsState);
  const resetAllowSharingBulkStreamingState = useResetAtom(fromCreateObjectState.allowSharingBulkStreamingState);
  const resetAllowSearchState = useResetAtom(fromCreateObjectState.allowSearchState);
  const resetCreateTabState = useResetAtom(fromCreateObjectState.createTabState);
  const resetSelectedTabIconState = useResetAtom(fromCreateObjectState.selectedTabIconState);
  const resetProfilesState = useResetAtom(fromCreateObjectState.profilesState);
  const resetPermissionSetsState = useResetAtom(fromCreateObjectState.permissionSetsState);
  const resetSelectedProfilesState = useResetAtom(fromCreateObjectState.selectedProfilesState);
  const resetSelectedPermissionSetsState = useResetAtom(fromCreateObjectState.selectedPermissionSetsState);
  const resetObjectPermissionsState = useResetAtom(fromCreateObjectState.objectPermissionsState);

  const [modalOpen, setModalOpen] = useState(false);

  const resetAll = () => {
    resetLabelState();
    resetPluralLabelState();
    resetStartsWithState();
    resetApiNameState();
    resetDescriptionState();
    resetRecordNameState();
    resetDataTypeState();
    resetDisplayFormatState();
    resetStartingNumberState();
    resetAllowReportsState();
    resetAllowActivitiesState();
    resetTrackFieldHistoryState();
    resetAllowInChatterGroupsState();
    resetAllowSharingBulkStreamingState();
    resetAllowSearchState();
    resetCreateTabState();
    resetSelectedTabIconState();
    resetProfilesState();
    resetPermissionSetsState();
    resetSelectedProfilesState();
    resetSelectedPermissionSetsState();
    resetObjectPermissionsState();
  };

  const handleClose = (createdNewObject?: boolean) => {
    setModalOpen(false);
    onClose(createdNewObject);
    resetAll();
  };

  return (
    <Fragment>
      <button
        className="slds-button slds-button_neutral"
        onClick={() => {
          resetAll();
          setSelectedProfiles(initialSelectedProfiles);
          setSelectedPermissionSets(initialSelectedPermissionSets);
          setModalOpen(true);
        }}
      >
        Create New Object
      </button>

      {modalOpen && <CreateNewObjectModal onClose={handleClose} selectedOrg={selectedOrg} />}
    </Fragment>
  );
};

export default CreateNewObject;
