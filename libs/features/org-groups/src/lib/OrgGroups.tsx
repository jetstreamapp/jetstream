import { logger } from '@jetstream/shared/client-logger';
import { ANALYTICS_KEYS, TITLES } from '@jetstream/shared/constants';
import {
  addOrgToGroup,
  createOrgGroup,
  deleteOrgGroup,
  deleteOrgGroupAndAllOrgs,
  getOrgGroups,
  getOrgs,
  updateOrgGroup,
} from '@jetstream/shared/data';
import { APP_ROUTES } from '@jetstream/shared/ui-router';
import { formatNumber, useRollbar, useTitle } from '@jetstream/shared/ui-utils';
import { getErrorMessageAndStackObj, pluralizeIfMultiple } from '@jetstream/shared/utils';
import { AddOrgHandlerFn, Maybe, OrgGroup, OrgGroupCreateUpdatePayload, OrgGroupWithOrgs } from '@jetstream/types';
import {
  AutoFullHeightContainer,
  ConfirmationModalPromise,
  fireToast,
  Grid,
  Icon,
  Page,
  PageHeader,
  PageHeaderActions,
  PageHeaderRow,
  PageHeaderTitle,
} from '@jetstream/ui';
import { AddOrg, useAmplitude, useUpdateOrgs } from '@jetstream/ui-core';
import { fromAppState, getRecentlySelectedOrgForGroup } from '@jetstream/ui/app-state';
import classNames from 'classnames';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { useCallback, useState } from 'react';
import OrgGroupCardCard from './OrgGroupCard';
import { OrgGroupCardNoOrganization } from './OrgGroupCardNoOrganization';
import { OrgGroupModal } from './OrgGroupModal';
import { SalesforceOrgsActions } from './SalesforceOrgsActions';

export function OrgGroups({ onAddOrgHandlerFn }: { onAddOrgHandlerFn?: AddOrgHandlerFn }) {
  useTitle(TITLES.ORG_GROUPS);
  const rollbar = useRollbar();
  const { trackEvent } = useAmplitude();
  const selectedOrg = useAtomValue(fromAppState.selectedOrgStateWithoutPlaceholder);
  const setSelectedOrgId = useSetAtom(fromAppState.selectedOrgIdState);
  const [allOrgs, setOrgs] = useAtom(fromAppState.salesforceOrgsState);
  const orgsWithoutGroup = useAtomValue(fromAppState.salesforceOrgsWithoutGroupSelector);
  const [activeOrgGroupId, setActiveOrgGroupId] = useAtom(fromAppState.ActiveOrgGroupState);
  const setOrgGroupsFromDb = useSetAtom(fromAppState.orgGroupsState);
  const [groups, setGroups] = useAtom(fromAppState.orgGroupsWithOrgsSelector);
  const setSelectedOrgGroup = useSetAtom(fromAppState.ActiveOrgGroupState);
  const [modalState, setModalState] = useState<{ open: boolean; organization?: Maybe<OrgGroupWithOrgs> }>({ open: false });

  const { handleAddOrg } = useUpdateOrgs();

  const handleMoveSfdcOrgToOrgGroup = useCallback(
    async ({ orgGroupId, sfdcOrgUniqueId, action }: { orgGroupId?: Maybe<string>; sfdcOrgUniqueId: string; action: 'add' | 'remove' }) => {
      const allOrgsBackup = [...allOrgs];
      const groupsBackup = [...groups];
      const orgToUpdate = allOrgs.find(({ uniqueId }) => uniqueId === sfdcOrgUniqueId);
      if (!orgToUpdate) {
        return;
      }
      try {
        // Optimistic update UI - update all state prior to DB actions and revert if error

        setOrgs(
          allOrgs.map((org) => {
            if (org.uniqueId !== sfdcOrgUniqueId) {
              return org;
            }
            return {
              ...org,
              jetstreamOrganizationId: action === 'add' ? orgGroupId : null,
            };
          }),
        );

        setGroups(
          groups.map((org) => {
            if (org.id === orgGroupId) {
              if (action === 'add') {
                return {
                  ...org,
                  orgs: [...org.orgs, orgToUpdate],
                };
              }
              return {
                ...org,
                orgs: org.orgs.filter(({ uniqueId }) => uniqueId !== sfdcOrgUniqueId),
              };
            }
            return org;
          }),
        );

        if (sfdcOrgUniqueId === selectedOrg?.uniqueId) {
          setSelectedOrgId(null);
        }

        await addOrgToGroup({
          orgGroupId: action === 'add' ? orgGroupId : null,
          sfdcOrgUniqueId,
        });
        // re-fetch just to make sure our state is accurate without blocking the UI
        getOrgGroups().then(setOrgGroupsFromDb);
        trackEvent(ANALYTICS_KEYS.organizations_moved, { action });
      } catch (ex) {
        // revert org update
        setOrgs(allOrgsBackup);
        setGroups(groupsBackup);
        fireToast({
          message: `Oops! There was a problem moving the Salesforce Org to the Group. Please try again.`,
          type: 'error',
        });
        rollbar.error('Org Group: Error moving org to group', getErrorMessageAndStackObj(ex));
        logger.error('Org Group: Error moving org to group', ex);
      }
    },
    [allOrgs, groups, rollbar, selectedOrg?.uniqueId, setGroups, setOrgGroupsFromDb, setOrgs, setSelectedOrgId, trackEvent],
  );

  const handleCreateOrUpdate = async (orgGroup: OrgGroupCreateUpdatePayload, groupToUpdateId?: string) => {
    let createdOrgGroup: OrgGroup;
    if (groupToUpdateId) {
      trackEvent(ANALYTICS_KEYS.organizations_created, { priorCount: groups.length });
      createdOrgGroup = await updateOrgGroup(groupToUpdateId, orgGroup);
    } else {
      trackEvent(ANALYTICS_KEYS.organizations_updated, { count: groups.length });
      createdOrgGroup = await createOrgGroup(orgGroup);
    }
    setOrgGroupsFromDb(async (_prevGroups) => {
      const prevGroups = await _prevGroups;
      const orgIndex = prevGroups.findIndex(({ id }) => id === createdOrgGroup.id);
      if (orgIndex === -1) {
        return [...prevGroups, createdOrgGroup];
      }
      return prevGroups.map((org, index) => (index === orgIndex ? createdOrgGroup : org));
    });
  };

  const handleDelete = async (organization: OrgGroupWithOrgs) => {
    if (
      await ConfirmationModalPromise({
        header: 'Delete Group',
        confirm: `Delete`,
        content: 'Any Salesforce Orgs will be removed from this organization but will not be deleted.',
      })
    ) {
      await deleteOrgGroup(organization.id);
      setOrgGroupsFromDb(getOrgGroups());
      setOrgs(
        allOrgs.map((org) => {
          if (org.jetstreamOrganizationId !== organization.id) {
            return org;
          }
          return { ...org, jetstreamOrganizationId: null };
        }),
      );
      handleCloseOrganizationModal();
      trackEvent(ANALYTICS_KEYS.organizations_deleted, { priorCount: groups.length });
    }
  };

  const handleDeleteAll = async (organization: OrgGroupWithOrgs) => {
    if (
      await ConfirmationModalPromise({
        header: 'Delete Group and All Salesforce Orgs',
        confirm: `Delete`,
        content: (
          <>
            <p>
              This will permanently delete the <strong>{organization.name}</strong> group and{' '}
              <strong>
                {formatNumber(organization.orgs.length)} Salesforce {pluralizeIfMultiple('org', organization.orgs)}
              </strong>
              .
            </p>
            <p className="slds-text-color_destructive">
              <strong>This action cannot be undone.</strong>
            </p>
          </>
        ),
      })
    ) {
      try {
        await deleteOrgGroupAndAllOrgs(organization.id);
        setOrgGroupsFromDb(getOrgGroups());
        // Remove deleted orgs from state
        setOrgs(allOrgs.filter((org) => org.jetstreamOrganizationId !== organization.id));
        handleCloseOrganizationModal();
        trackEvent(ANALYTICS_KEYS.organizations_deleted_with_orgs, {
          priorCount: groups.length,
          deletedOrgCount: organization.orgs.length,
        });
        fireToast({
          message: `Organization "${organization.name}" and ${organization.orgs.length} ${pluralizeIfMultiple('org', organization.orgs)} deleted successfully`,
          type: 'success',
        });
      } catch (ex) {
        rollbar.error('Org Group: Error deleting group with orgs', getErrorMessageAndStackObj(ex));
        logger.error('Org Group: Error deleting group with orgs', ex);
        fireToast({
          message: `Failed to delete group. Please try again.`,
          type: 'error',
        });
      }
    }
  };

  const handleOrgGroupChange = useCallback(
    (group?: Maybe<OrgGroupWithOrgs>) => {
      setActiveOrgGroupId(group?.id);
      if (group && (!selectedOrg || !group.orgs.find(({ uniqueId }) => uniqueId === selectedOrg.uniqueId))) {
        // Try to select the recently selected org for this group
        const recentOrgId = getRecentlySelectedOrgForGroup(group.id);
        const recentOrgExists = recentOrgId && group.orgs.find(({ uniqueId }) => uniqueId === recentOrgId);

        if (recentOrgExists) {
          setSelectedOrgId(recentOrgId);
        } else {
          const firstOrgUniqueId = group.orgs?.[0]?.uniqueId || null;
          setSelectedOrgId(firstOrgUniqueId);
        }
      } else if (!group && (!selectedOrg || selectedOrg.jetstreamOrganizationId != null)) {
        const orgsWithNoOrganization = allOrgs.filter(({ jetstreamOrganizationId }) => !jetstreamOrganizationId);

        // Try to select the recently selected org for no group
        const recentOrgId = getRecentlySelectedOrgForGroup(null);
        const recentOrgExists = recentOrgId && orgsWithNoOrganization.find(({ uniqueId }) => uniqueId === recentOrgId);

        if (recentOrgExists) {
          setSelectedOrgId(recentOrgId);
        } else {
          const firstUnassignedOrgId = orgsWithNoOrganization?.[0]?.uniqueId || null;
          setSelectedOrgId(firstUnassignedOrgId);
        }
      }
    },
    [allOrgs, selectedOrg, setActiveOrgGroupId, setSelectedOrgId],
  );

  const handleOpenCreateOrganizationModal = async () => {
    trackEvent(ANALYTICS_KEYS.organizations_create_modal_open, { priorCount: groups.length });
    setModalState({ open: true });
  };

  const handleCloseOrganizationModal = async () => {
    setModalState({ open: false });
    setSelectedOrgGroup(null);
  };

  const handleOrgsDeleted = async () => {
    setOrgGroupsFromDb(getOrgGroups());
    const refreshedOrgs = await getOrgs();
    setOrgs(refreshedOrgs);
    trackEvent(ANALYTICS_KEYS.organizations_deleted, { priorCount: allOrgs.length });
  };

  return (
    <Page testId="organization-page">
      <PageHeader>
        <PageHeaderRow>
          <PageHeaderTitle
            icon={{ type: 'standard', icon: 'employee_organization' }}
            label="Salesforce Organization Groups"
            docsPath={APP_ROUTES.SALESFORCE_ORG_GROUPS.DOCS}
          />
          <PageHeaderActions colType="actions" buttonType="list-group">
            <AddOrg
              omitIcon
              className={classNames('slds-button slds-button_neutral slds-button_first')}
              label="Add Salesforce Org"
              onAddOrg={handleAddOrg}
              onAddOrgHandlerFn={onAddOrgHandlerFn}
            />
            <button
              className={classNames('slds-button slds-button_brand', { 'slds-button_last': allOrgs.length === 0 })}
              onClick={() => handleOpenCreateOrganizationModal()}
            >
              <Icon type="utility" icon="add" className="slds-button__icon slds-button__icon_left" />
              Create New Group
            </button>
            {allOrgs.length > 0 && <SalesforceOrgsActions orgs={allOrgs} onOrgsDeleted={handleOrgsDeleted} />}
          </PageHeaderActions>
        </PageHeaderRow>
        <PageHeaderRow>
          <div>
            <p>Groups let you organize your Salesforce Orgs so that you can keep your connections separated.</p>
            <p>When you select a group to work with, only those orgs show up in the org dropdown.</p>
          </div>
        </PageHeaderRow>
      </PageHeader>
      {modalState.open && (
        <OrgGroupModal orgGroup={modalState.organization} onSubmit={handleCreateOrUpdate} onClose={handleCloseOrganizationModal} />
      )}
      <AutoFullHeightContainer bottomBuffer={5} className="slds-p-around_medium">
        <p>Drag and drop to move Salesforce Orgs between groups.</p>
        <p>Tip: To delete multiple Salesforce Orgs, add them to a group and choose the option to delete the group along with the orgs.</p>
        <Grid vertical>
          {groups.map((organization) => (
            <div key={organization.id} className="slds-m-top_x-small">
              <OrgGroupCardCard
                isActive={activeOrgGroupId === organization.id}
                group={organization}
                activeSalesforceOrgId={selectedOrg?.uniqueId}
                onMoveOrg={handleMoveSfdcOrgToOrgGroup}
                onSelected={() => handleOrgGroupChange(organization)}
                onEditOrg={() => {
                  setModalState({ open: true, organization });
                }}
                onDeleteOrg={() => handleDelete(organization)}
                onDeleteOrgWithOrgs={() => handleDeleteAll(organization)}
                onAddOrgHandlerFn={onAddOrgHandlerFn}
              />
            </div>
          ))}
        </Grid>
        <hr className="slds-m-vertical_small" />
        <OrgGroupCardNoOrganization
          isActive={!activeOrgGroupId}
          orgs={orgsWithoutGroup}
          activeSalesforceOrgId={selectedOrg?.uniqueId}
          onSelected={() => handleOrgGroupChange(null)}
          onMoveOrg={handleMoveSfdcOrgToOrgGroup}
          onAddOrgHandlerFn={onAddOrgHandlerFn}
        />
      </AutoFullHeightContainer>
    </Page>
  );
}

export default OrgGroups;
