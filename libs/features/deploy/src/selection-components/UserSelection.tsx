import { useNonInitialEffect } from '@jetstream/shared/ui-utils';
import { NOOP } from '@jetstream/shared/utils';
import { AllUser, ListItem, SalesforceOrgUi } from '@jetstream/types';
import { Grid, List } from '@jetstream/ui';
import { fromDeployMetadataState } from '@jetstream/ui-core';
import { FunctionComponent, useEffect, useState } from 'react';
import { useRecoilState } from 'recoil';
import DeployMetadataUserList from '../DeployMetadataUserList';
import { RadioButtonItem, RadioButtonSelection } from './RadioButtonSelection';

const USER_SELECTION_RADIO_BUTTONS: RadioButtonItem<AllUser>[] = [
  {
    name: 'all',
    label: 'All Users',
    value: 'all',
  },
  {
    name: 'currentUser',
    label: 'Current User',
    value: 'currentUser',
  },
  {
    name: 'user',
    label: 'Specific Users',
    value: 'user',
  },
];

export interface UserSelectionProps {
  selectedOrg: SalesforceOrgUi;
  requireConfirmSelection?: boolean;
  onSubmit?: () => void;
}

export interface UserSelectionRequireSelectionProps extends UserSelectionProps {
  requireConfirmSelection: true;
  onSubmit: () => void;
}

export const UserSelection: FunctionComponent<UserSelectionProps | UserSelectionRequireSelectionProps> = ({
  selectedOrg,
  requireConfirmSelection,
  onSubmit,
}) => {
  const [_userSelection, _setUserSelection] = useRecoilState<AllUser>(fromDeployMetadataState.userSelectionState);
  const [_usersList, _setUsersList] = useRecoilState(fromDeployMetadataState.usersList);
  const [_selectedUsers, _setSelectedUsers] = useRecoilState(fromDeployMetadataState.selectedUsersState);

  const [userSelection, setUserSelection] = useState(_userSelection);
  const [usersList, setUsersList] = useState(_usersList);
  const [selectedUsers, setSelectedUsers] = useState(_selectedUsers);

  useEffect(() => {
    if (!requireConfirmSelection) {
      _setUserSelection(userSelection);
    }
  }, [userSelection]);

  useEffect(() => {
    if (!requireConfirmSelection) {
      _setUsersList(usersList);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usersList]);

  useEffect(() => {
    if (!requireConfirmSelection) {
      _setSelectedUsers(selectedUsers);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUsers]);

  useNonInitialEffect(() => {
    setUsersList(null);
    setSelectedUsers([]);
  }, [selectedOrg]);

  function handleSubmit() {
    _setUserSelection(userSelection);
    _setUsersList(usersList);
    _setSelectedUsers(selectedUsers);
    onSubmit && onSubmit();
  }

  return (
    <>
      {requireConfirmSelection && (
        <Grid align="center">
          <button
            className="slds-button slds-button_brand"
            onClick={handleSubmit}
            disabled={userSelection === 'user' && selectedUsers.length === 0}
          >
            Submit
          </button>
        </Grid>
      )}
      <div className="slds-align_absolute-center">
        <RadioButtonSelection
          label={'Show metadata modified by which users'}
          items={USER_SELECTION_RADIO_BUTTONS}
          checkedValue={userSelection}
          onChange={(value) => setUserSelection(value as AllUser)}
        />
      </div>
      {userSelection === 'currentUser' && (
        <>
          <hr className="slds-m-vertical_small" />
          <List
            items={[{ id: 'current-user', label: `${selectedOrg.displayName} (ME)`, secondaryLabel: selectedOrg.username }]}
            isMultiSelect
            isActive={() => true}
            onSelected={NOOP}
            getContent={(item: ListItem) => ({
              key: item.id,
              heading: item.label,
              subheading: item.secondaryLabel,
            })}
            disabled
          />
        </>
      )}
      {userSelection === 'user' && (
        <>
          <hr className="slds-m-vertical_small" />
          <DeployMetadataUserList
            selectedOrg={selectedOrg}
            initialUsers={usersList}
            selectedUsers={selectedUsers}
            onUsers={setUsersList}
            onSelection={setSelectedUsers}
          />
        </>
      )}
    </>
  );
};

export default UserSelection;
