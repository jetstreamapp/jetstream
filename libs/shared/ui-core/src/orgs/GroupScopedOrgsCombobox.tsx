import { formatNumber } from '@jetstream/shared/ui-utils';
import { pluralizeFromNumber } from '@jetstream/shared/utils';
import { fromAppState } from '@jetstream/ui/app-state';
import { useAtomValue } from 'jotai';
import { FunctionComponent, useMemo, useState } from 'react';
import { getOrgGroupScope } from './org-group-scope.utils';
import { OrgsCombobox, OrgsComboboxProps } from './OrgsCombobox';

export type GroupScopedOrgsComboboxProps = Omit<OrgsComboboxProps, 'helpText'>;

/**
 * Org picker for choosing an org other than the one selected in the header (deploy targets, compare, filters).
 * Defaults to the orgs in the active org group, matching the header org dropdown, with a link to show every org.
 */
export const GroupScopedOrgsCombobox: FunctionComponent<GroupScopedOrgsComboboxProps> = (props) => {
  const { orgs, selectedOrg, disabled } = props;
  const hasOrgGroups = useAtomValue(fromAppState.orgGroupExistsSelector);
  // Resolved through the group list so a stale stored group id (e.g. deleted in another tab) falls back to "no group"
  const activeGroup = useAtomValue(fromAppState.jetstreamActiveGroupSelector);
  const [showAllOrgs, setShowAllOrgs] = useState(false);

  const { scopedOrgs, hiddenOrgCount, hiddenGroupCount } = useMemo(
    () => getOrgGroupScope({ orgs, hasOrgGroups, activeGroupId: activeGroup?.id, selectedOrgId: selectedOrg?.uniqueId }),
    [orgs, hasOrgGroups, activeGroup?.id, selectedOrg?.uniqueId],
  );

  const scopeDescription = activeGroup ? `orgs in "${activeGroup.name}"` : 'orgs without a group';
  const hiddenOrgsDescription = `${formatNumber(hiddenOrgCount)} more in ${formatNumber(hiddenGroupCount)} ${activeGroup ? 'other ' : ''}${pluralizeFromNumber('group', hiddenGroupCount)}`;

  // A disabled picker cannot be opened, so which orgs it would list is irrelevant
  const helpText =
    hiddenOrgCount > 0 && !disabled ? (
      <span>
        <span>{showAllOrgs ? 'Showing all orgs' : `Showing ${scopeDescription}`} · </span>
        <button
          type="button"
          className="slds-button slds-button_reset slds-text-link_reset slds-text-link"
          onClick={() => setShowAllOrgs((prevValue) => !prevValue)}
        >
          {showAllOrgs ? `Only show ${scopeDescription}` : `Show all orgs (${hiddenOrgsDescription})`}
        </button>
      </span>
    ) : undefined;

  return <OrgsCombobox {...props} orgs={showAllOrgs ? orgs : scopedOrgs} helpText={helpText} />;
};
