import { Maybe, SalesforceOrgUi } from '@jetstream/types';

export interface OrgGroupScope {
  /** Orgs in the active group, plus the selected org even when it is outside the group so its label still renders */
  scopedOrgs: SalesforceOrgUi[];
  hiddenOrgCount: number;
  /** Distinct groups the hidden orgs belong to - ungrouped orgs count as one, like "-No Group-" in the group selector */
  hiddenGroupCount: number;
}

/**
 * Narrows an org list the same way the header org dropdown does (`salesforceOrgsForGroupSelector`): an active group
 * shows only its orgs and no active group shows only ungrouped orgs. Nothing is hidden when no groups are configured.
 */
export function getOrgGroupScope({
  orgs,
  hasOrgGroups,
  activeGroupId,
  selectedOrgId,
}: {
  orgs: SalesforceOrgUi[];
  hasOrgGroups: boolean;
  activeGroupId: Maybe<string>;
  selectedOrgId: Maybe<string>;
}): OrgGroupScope {
  if (!hasOrgGroups) {
    return { scopedOrgs: orgs, hiddenOrgCount: 0, hiddenGroupCount: 0 };
  }

  const scopeGroupId = activeGroupId || null;
  const scopedOrgs: SalesforceOrgUi[] = [];
  const hiddenGroupIds = new Set<string | null>();

  orgs.forEach((org) => {
    const orgGroupId = org.jetstreamOrganizationId || null;
    if (orgGroupId === scopeGroupId || org.uniqueId === selectedOrgId) {
      scopedOrgs.push(org);
    } else {
      hiddenGroupIds.add(orgGroupId);
    }
  });

  return { scopedOrgs, hiddenOrgCount: orgs.length - scopedOrgs.length, hiddenGroupCount: hiddenGroupIds.size };
}
