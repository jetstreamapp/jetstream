import { useNonInitialEffect } from '@jetstream/shared/ui-utils';
import { ListItem, Maybe, SalesforceOrgUi, SalesforceUser } from '@jetstream/types';
import { ListWithFilterMultiSelect } from '@jetstream/ui';
import { FunctionComponent, useEffect } from 'react';
import { useUsers } from './utils/useUsers';

export interface DeployMetadataUserListProps {
  selectedOrg: SalesforceOrgUi;
  initialUsers: Maybe<ListItem<string, SalesforceUser>[]>;
  selectedUsers: string[];
  onUsers: (users: ListItem<string, SalesforceUser>[]) => void;
  onSelection: (users: string[]) => void;
}

export const DeployMetadataUserList: FunctionComponent<DeployMetadataUserListProps> = ({
  selectedOrg,
  initialUsers,
  selectedUsers,
  onUsers,
  onSelection,
}) => {
  const { loadUsers, loading, users, hasError, lastRefreshed } = useUsers(selectedOrg, initialUsers);

  useEffect(() => {
    if (users && users.length) {
      onUsers(users);
    }
  }, [users, onUsers]);

  useNonInitialEffect(() => {
    loadUsers();
  }, [selectedOrg]);

  return (
    <ListWithFilterMultiSelect
      labels={{
        listHeading: 'Users',
        filter: 'Filter Users',
        descriptorSingular: 'user',
        descriptorPlural: 'users',
      }}
      allowRefresh
      lastRefreshed={lastRefreshed}
      items={users}
      selectedItems={selectedUsers}
      loading={loading}
      onSelected={onSelection}
      hasError={hasError}
      errorReattempt={loadUsers}
      onRefresh={() => loadUsers(true)}
    />
  );
};

export default DeployMetadataUserList;
