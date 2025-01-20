import { css } from '@emotion/react';
import { JetstreamOrganization, Maybe, SalesforceOrgUi } from '@jetstream/types';
import { Badge, Grid, Icon, Tooltip } from '@jetstream/ui';
import { fromAppState } from '@jetstream/ui/app-state';
import classNames from 'classnames';
import { Fragment, FunctionComponent } from 'react';
import { useRecoilValue, useSetRecoilState } from 'recoil';
import { OrgsCombobox, useOrgPermissions } from '..';
import { hasOrderByConfigured } from '../state-management/query.state';
import AddOrg from './AddOrg';
import { OrganizationSelector } from './OrganizationSelector';
import OrgInfoPopover from './OrgInfoPopover';
import OrgPersistence from './OrgPersistence';
import { useUpdateOrgs } from './useUpdateOrgs';

interface OrgsDropdownProps {
  addOrgsButtonClassName?: string;
  omitAddOrgsButton?: boolean;
  omitOrganizationSelector?: boolean;
}

export const OrgsDropdown: FunctionComponent<OrgsDropdownProps> = ({
  addOrgsButtonClassName,
  omitOrganizationSelector,
  omitAddOrgsButton,
}) => {
  const allOrgs = useRecoilValue(fromAppState.salesforceOrgsState);
  const orgs = useRecoilValue(fromAppState.salesforceOrgsForOrganizationSelector);
  const selectedOrg = useRecoilValue(fromAppState.selectedOrgStateWithoutPlaceholder);
  const { hasMetadataAccess } = useOrgPermissions(selectedOrg);
  const setSelectedOrgId = useSetRecoilState(fromAppState.selectedOrgIdState);
  const orgType = useRecoilValue(fromAppState.selectedOrgType);
  const jetstreamOrganizations = useRecoilValue(fromAppState.jetstreamOrganizationsState);
  const hasOrganizationsConfigured = useRecoilValue(fromAppState.jetstreamOrganizationsExistsSelector);
  const setActiveOrganization = useSetRecoilState(fromAppState.jetstreamActiveOrganizationState);
  const activeOrganization = useRecoilValue(fromAppState.jetstreamActiveOrganizationSelector);

  const { actionInProgress, orgLoading, handleAddOrg, handleRemoveOrg, handleUpdateOrg } = useUpdateOrgs();

  function handleOrganizationChange(organization: Maybe<JetstreamOrganization>) {
    if (organization && (!selectedOrg || !organization.orgs.find(({ uniqueId }) => uniqueId === selectedOrg.uniqueId))) {
      if (organization.orgs.length === 1) {
        setSelectedOrgId(organization.orgs[0].uniqueId);
      } else {
        setSelectedOrgId(null);
      }
    } else if (!organization && (!selectedOrg || selectedOrg.jetstreamOrganizationId != null)) {
      const orgsWithNoOrganization = allOrgs.filter(({ jetstreamOrganizationId }) => !jetstreamOrganizationId);
      if (orgsWithNoOrganization.length === 1) {
        setSelectedOrgId(orgsWithNoOrganization[0].uniqueId);
      } else {
        setSelectedOrgId(null);
      }
    }
    setActiveOrganization(organization?.id);
  }

  return (
    <Fragment>
      <OrgPersistence />
      <Grid vertical>
        {!omitOrganizationSelector && hasOrganizationsConfigured && (
          <OrganizationSelector
            organizations={jetstreamOrganizations}
            selectedOrganization={activeOrganization}
            salesforceOrgsWithoutOrganization={allOrgs.filter((org) => !org.jetstreamOrganizationId).length}
            onSelection={handleOrganizationChange}
          />
        )}
        <Grid
          noWrap
          verticalAlign="center"
          // This is a hack to make the content fit better without having to deal with other spacing considerations
          css={css`
            ${hasOrderByConfigured ? 'zoom: 90%;' : ''}
          `}
        >
          {!hasMetadataAccess && (
            <Tooltip
              id={`limited-org-access`}
              content={`Your user does not have the permission "Modify Metadata Through Metadata API Functions" Or "Modify All Data". Some Jetstream features will not work properly.`}
            >
              <div className={classNames('slds-col slds-p-around_xx-small')}>
                <Badge type="warning" title="Limited Access">
                  <Icon type="utility" icon="warning" className="slds-icon_xx-small slds-m-right_xx-small" />
                  Limited Access
                </Badge>
              </div>
            </Tooltip>
          )}
          <div className={classNames('slds-col slds-p-around_xx-small')}>
            {orgType && (
              <Badge type={orgType === 'Production' ? 'warning' : 'light'} title={orgType}>
                {orgType}
              </Badge>
            )}
          </div>
          <OrgsCombobox
            orgs={orgs}
            selectedOrg={selectedOrg}
            disabled={actionInProgress}
            onSelected={(org: SalesforceOrgUi) => setSelectedOrgId(org.uniqueId)}
          />
          {selectedOrg && (
            <div className="slds-col slds-m-left--xx-small org-info-button">
              <OrgInfoPopover
                org={selectedOrg}
                loading={orgLoading}
                disableOrgActions={actionInProgress}
                onAddOrg={handleAddOrg}
                onRemoveOrg={handleRemoveOrg}
                onUpdateOrg={handleUpdateOrg}
              />
            </div>
          )}
          {!omitAddOrgsButton && (
            <div className="slds-col">
              <AddOrg className={addOrgsButtonClassName} onAddOrg={handleAddOrg} disabled={actionInProgress} />
            </div>
          )}
        </Grid>
      </Grid>
    </Fragment>
  );
};

export default OrgsDropdown;
