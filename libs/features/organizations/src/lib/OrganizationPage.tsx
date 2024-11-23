import { logger } from '@jetstream/shared/client-logger';
import { ANALYTICS_KEYS, TITLES } from '@jetstream/shared/constants';
import {
  addSfdcOrgToOrganization,
  createJetstreamOrganization,
  deleteJetstreamOrganization,
  getJetstreamOrganizations,
  updateJetstreamOrganization,
} from '@jetstream/shared/data';
import { useRollbar, useTitle } from '@jetstream/shared/ui-utils';
import { getErrorMessageAndStackObj } from '@jetstream/shared/utils';
import { JetstreamOrganization, JetstreamOrganizationCreateUpdatePayload, JetstreamOrganizationWithOrgs, Maybe } from '@jetstream/types';
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
import { AddOrg, fromAppState, useAmplitude, useUpdateOrgs } from '@jetstream/ui-core';
import { useCallback, useState } from 'react';
import { useRecoilState, useRecoilValue, useSetRecoilState } from 'recoil';
import OrganizationCard from './OrganizationCard';
import { OrganizationCardNoOrganization } from './OrganizationCardNoOrganization';
import { OrganizationModal } from './OrganizationModal';

export function Organizations() {
  useTitle(TITLES.ORGANIZATIONS);
  const rollbar = useRollbar();
  const { trackEvent } = useAmplitude();
  const selectedOrg = useRecoilValue(fromAppState.selectedOrgStateWithoutPlaceholder);
  const setSelectedOrgId = useSetRecoilState(fromAppState.selectedOrgIdState);
  const [allOrgs, setOrgs] = useRecoilState(fromAppState.salesforceOrgsState);
  const orgsWithoutOrganization = useRecoilValue(fromAppState.salesforceOrgsWithoutOrganizationSelector);
  const [activeOrganizationId, setActiveOrganizationId] = useRecoilState(fromAppState.jetstreamActiveOrganizationState);
  const setOrganizationsFromDb = useSetRecoilState(fromAppState.jetstreamOrganizationsState);
  const [organizations, setOrganizations] = useRecoilState(fromAppState.jetstreamOrganizationsWithOrgsSelector);
  const setSelectedOrganization = useSetRecoilState(fromAppState.jetstreamActiveOrganizationState);
  const selectedOrganization = useRecoilValue(fromAppState.jetstreamActiveOrganizationSelector);
  const [isModalOpen, setIsModalOption] = useState(false);

  const { handleAddOrg } = useUpdateOrgs();

  const handleMoveSfdcOrgToOrganization = useCallback(
    async ({
      jetstreamOrganizationId,
      sfdcOrgUniqueId,
      action,
    }: {
      jetstreamOrganizationId?: Maybe<string>;
      sfdcOrgUniqueId: string;
      action: 'add' | 'remove';
    }) => {
      const allOrgsBackup = [...allOrgs];
      const organizationsBackup = [...organizations];
      const orgToUpdate = allOrgs.find((org) => org.uniqueId === sfdcOrgUniqueId);
      if (!orgToUpdate) {
        return;
      }
      try {
        // Optimistic update UI - update all state prior to DB actions and revert if error
        setOrgs((orgs) =>
          orgs.map((org) => {
            if (org.uniqueId !== sfdcOrgUniqueId) {
              return org;
            }
            return {
              ...org,
              jetstreamOrganizationId: action === 'add' ? jetstreamOrganizationId : null,
            };
          })
        );
        setOrganizations((prevOrganizations) => {
          return prevOrganizations.map((org) => {
            if (org.id === jetstreamOrganizationId) {
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
          });
        });
        if (sfdcOrgUniqueId === selectedOrg?.uniqueId) {
          setSelectedOrgId(null);
        }
        await addSfdcOrgToOrganization({
          jetstreamOrganizationId: action === 'add' ? jetstreamOrganizationId : null,
          sfdcOrgUniqueId,
        });
        // re-fetch just to make sure our state is accurate without blocking the UI
        getJetstreamOrganizations().then(setOrganizationsFromDb);
        trackEvent(ANALYTICS_KEYS.organizations_moved, { action });
      } catch (ex) {
        // revert org update
        setOrgs(allOrgsBackup);
        setOrganizations(organizationsBackup);
        fireToast({
          message: `Oops! There was a problem moving the Salesforce Org to the Organization. Please try again.`,
          type: 'error',
        });
        rollbar.error('Organizations: Error moving org to organization', getErrorMessageAndStackObj(ex));
        logger.error('Organizations: Error moving org to organization', ex);
      }
    },
    [
      allOrgs,
      organizations,
      rollbar,
      selectedOrg?.uniqueId,
      setOrganizations,
      setOrganizationsFromDb,
      setOrgs,
      setSelectedOrgId,
      trackEvent,
    ]
  );

  const handleCreateOrUpdate = async (organization: JetstreamOrganizationCreateUpdatePayload) => {
    let createdOrg: JetstreamOrganization;
    if (selectedOrganization) {
      trackEvent(ANALYTICS_KEYS.organizations_created, { priorCount: organizations.length });
      createdOrg = await updateJetstreamOrganization(selectedOrganization.id, organization);
    } else {
      trackEvent(ANALYTICS_KEYS.organizations_updated, { count: organizations.length });
      createdOrg = await createJetstreamOrganization(organization);
    }
    setOrganizationsFromDb((prevOrganizations) => {
      const orgIndex = prevOrganizations.findIndex((org) => org.id === createdOrg.id);
      if (orgIndex === -1) {
        return [...prevOrganizations, createdOrg];
      }
      return prevOrganizations.map((org, index) => (index === orgIndex ? createdOrg : org));
    });
  };

  const handleDelete = async (organization: JetstreamOrganizationWithOrgs) => {
    if (
      await ConfirmationModalPromise({
        header: 'Delete Organization',
        content: 'Any Salesforce Orgs will be removed from this organization but will not be deleted.',
      })
    ) {
      await deleteJetstreamOrganization(organization.id);
      setOrganizationsFromDb(await getJetstreamOrganizations());
      setOrgs((orgs) =>
        orgs.map((org) => {
          if (org.jetstreamOrganizationId !== organization.id) {
            return org;
          }
          return { ...org, jetstreamOrganizationId: null };
        })
      );
      handleCloseOrganizationModal();
      trackEvent(ANALYTICS_KEYS.organizations_deleted, { priorCount: organizations.length });
    }
  };

  const handleOrganizationChange = useCallback(
    (organization?: Maybe<JetstreamOrganizationWithOrgs>) => {
      setActiveOrganizationId(organization?.id);
      if (organization && (!selectedOrg || !organization.orgs.find(({ uniqueId }) => uniqueId === selectedOrg.uniqueId))) {
        setSelectedOrgId(organization.orgs[0]?.uniqueId);
      } else if (!organization && (!selectedOrg || selectedOrg.jetstreamOrganizationId != null)) {
        const orgsWithNoOrganization = allOrgs.filter(({ jetstreamOrganizationId }) => !jetstreamOrganizationId);
        setSelectedOrgId(orgsWithNoOrganization[0].uniqueId);
      }
    },
    [allOrgs, selectedOrg, setActiveOrganizationId, setSelectedOrgId]
  );

  const handleOpenCreateOrganizationModal = async () => {
    trackEvent(ANALYTICS_KEYS.organizations_create_modal_open, { priorCount: organizations.length });
    setIsModalOption(true);
  };

  const handleCloseOrganizationModal = async () => {
    setIsModalOption(false);
    setSelectedOrganization(null);
  };

  return (
    <Page testId="organization-page">
      <PageHeader>
        <PageHeaderRow>
          <PageHeaderTitle icon={{ type: 'standard', icon: 'employee_organization' }} label="Organizations" docsPath="/organizations" />
          <PageHeaderActions colType="actions" buttonType="separate">
            <AddOrg className="slds-button slds-button_neutral" label="Add Salesforce Org" onAddOrg={handleAddOrg} />
            <button className="slds-button slds-button_brand" onClick={() => handleOpenCreateOrganizationModal()}>
              <Icon type="utility" icon="add" className="slds-button__icon slds-button__icon_left" />
              Create New Organization
            </button>
          </PageHeaderActions>
        </PageHeaderRow>
        <PageHeaderRow>
          <div>
            <p>Organizations let you group your Salesforce Orgs so that you can keep your connections separated.</p>
            <p>When you select an organization to work with, only those orgs show up in the org dropdown.</p>
          </div>
        </PageHeaderRow>
      </PageHeader>
      {isModalOpen && (
        <OrganizationModal organization={selectedOrganization} onSubmit={handleCreateOrUpdate} onClose={handleCloseOrganizationModal} />
      )}
      <AutoFullHeightContainer bottomBuffer={5} className="slds-p-around_medium">
        <p>Drag and drop to move salesforce orgs between organizations.</p>
        <Grid vertical>
          {organizations.map((organization) => (
            <div key={organization.id} className="slds-m-top_x-small">
              <OrganizationCard
                isActive={activeOrganizationId === organization.id}
                organization={organization}
                activeSalesforceOrgId={selectedOrg?.uniqueId}
                onMoveOrg={handleMoveSfdcOrgToOrganization}
                onSelected={() => handleOrganizationChange(organization)}
                onEditOrg={() => {
                  setIsModalOption(true);
                  setSelectedOrganization(organization.id);
                }}
                onDeleteOrg={() => handleDelete(organization)}
              />
            </div>
          ))}
        </Grid>
        <hr className="slds-m-vertical_small" />
        <OrganizationCardNoOrganization
          isActive={!activeOrganizationId}
          orgs={orgsWithoutOrganization}
          activeSalesforceOrgId={selectedOrg?.uniqueId}
          onSelected={() => handleOrganizationChange(null)}
          onMoveOrg={handleMoveSfdcOrgToOrganization}
        />
      </AutoFullHeightContainer>
    </Page>
  );
}

export default Organizations;
