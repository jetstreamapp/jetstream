import { SalesforceOrgUi } from '@jetstream/types';
import { Fragment, FunctionComponent, useState } from 'react';
import { useResetRecoilState, useSetRecoilState } from 'recoil';
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
  const setSelectedProfiles = useSetRecoilState(fromCreateObjectState.selectedProfilesState);
  const setSelectedPermissionSets = useSetRecoilState(fromCreateObjectState.selectedPermissionSetsState);

  const resetLabelState = useResetRecoilState(fromCreateObjectState.labelState);
  const resetPluralLabelState = useResetRecoilState(fromCreateObjectState.pluralLabelState);
  const resetStartsWithState = useResetRecoilState(fromCreateObjectState.startsWithState);
  const resetApiNameState = useResetRecoilState(fromCreateObjectState.apiNameState);
  const resetDescriptionState = useResetRecoilState(fromCreateObjectState.descriptionState);
  const resetRecordNameState = useResetRecoilState(fromCreateObjectState.recordNameState);
  const resetDataTypeState = useResetRecoilState(fromCreateObjectState.dataTypeState);
  const resetDisplayFormatState = useResetRecoilState(fromCreateObjectState.displayFormatState);
  const resetStartingNumberState = useResetRecoilState(fromCreateObjectState.startingNumberState);
  const resetAllowReportsState = useResetRecoilState(fromCreateObjectState.allowReportsState);
  const resetAllowActivitiesState = useResetRecoilState(fromCreateObjectState.allowActivitiesState);
  const resetTrackFieldHistoryState = useResetRecoilState(fromCreateObjectState.trackFieldHistoryState);
  const resetAllowInChatterGroupsState = useResetRecoilState(fromCreateObjectState.allowInChatterGroupsState);
  const resetAllowSharingBulkStreamingState = useResetRecoilState(fromCreateObjectState.allowSharingBulkStreamingState);
  const resetAllowSearchState = useResetRecoilState(fromCreateObjectState.allowSearchState);
  const resetCreateTabState = useResetRecoilState(fromCreateObjectState.createTabState);
  const resetSelectedTabIconState = useResetRecoilState(fromCreateObjectState.selectedTabIconState);
  const resetProfilesState = useResetRecoilState(fromCreateObjectState.profilesState);
  const resetPermissionSetsState = useResetRecoilState(fromCreateObjectState.permissionSetsState);
  const resetSelectedProfilesState = useResetRecoilState(fromCreateObjectState.selectedProfilesState);
  const resetSelectedPermissionSetsState = useResetRecoilState(fromCreateObjectState.selectedPermissionSetsState);
  const resetObjectPermissionsState = useResetRecoilState(fromCreateObjectState.objectPermissionsState);

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
