import { css } from '@emotion/react';
import { logger } from '@jetstream/shared/client-logger';
import { checkOrgHealth, getOrgs } from '@jetstream/shared/data';
import { APP_ROUTES } from '@jetstream/shared/ui-router';
import { ACCESS_PROFILE_OPERATION_NOT_ALLOWED_MESSAGES, AddOrgHandlerFn, Maybe, OrgGroup, SalesforceOrgUi } from '@jetstream/types';
import { Alert, ariaDisabledButtonProps, Card, EmptyState, fireToast, Grid, Icon, NoAccess2Illustration } from '@jetstream/ui';
import { fromAppState, useCanPerformOperation } from '@jetstream/ui/app-state';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { Fragment, FunctionComponent, useCallback, useState } from 'react';
import { Link } from 'react-router';
import { fromJetstreamEvents, OrgsDropdown } from '..';
import { AddOrg } from './AddOrg';
import { OrgWelcomeInstructions } from './OrgWelcomeInstructions';
import { OrganizationGroupSelector } from './OrganizationGroupSelector';

export interface OrgSelectionRequiredProps {
  /**
   * If provided, this will be used instead of the default addOrg function.
   * This is used in the desktop app to open the browser for the login process.
   */
  onAddOrgHandlerFn?: AddOrgHandlerFn;
  children?: React.ReactNode;
}

export const OrgSelectionRequired: FunctionComponent<OrgSelectionRequiredProps> = ({ onAddOrgHandlerFn, children }) => {
  const [allOrgs, setOrgs] = useAtom(fromAppState.salesforceOrgsState);
  const selectedOrg = useAtomValue(fromAppState.selectedOrgStateWithoutPlaceholder);
  const hasConfiguredOrg = useAtomValue(fromAppState.hasConfiguredOrgState);
  const orgGroups = useAtomValue(fromAppState.orgGroupsState);
  const hasOrgGroupsConfigured = useAtomValue(fromAppState.orgGroupExistsSelector);
  const setActiveOrgGroup = useSetAtom(fromAppState.ActiveOrgGroupState);
  const activeOrgGroup = useAtomValue(fromAppState.jetstreamActiveGroupSelector);
  const setSelectedOrgId = useSetAtom(fromAppState.selectedOrgIdState);
  const canConnectOrgs = useCanPerformOperation('orgs.connect');

  const [loadingRetry, setLoadingRetry] = useState(false);

  const handleAddOrg = useCallback((org: SalesforceOrgUi, switchActiveOrg: boolean) => {
    fromJetstreamEvents.emit({ type: 'addOrg', payload: { org, switchActiveOrg } });
  }, []);

  const handleRetryOrgConnection = async () => {
    try {
      if (!selectedOrg?.uniqueId) {
        return;
      }
      setLoadingRetry(true);
      await checkOrgHealth(selectedOrg);
      setOrgs(getOrgs());
      fireToast({ type: 'success', message: 'Your org is now valid! 🎉' });
    } catch (ex) {
      fireToast({ type: 'error', message: 'Unable to connect to your org, reconnect to Salesforce to keep using this org.' });
      logger.log('Unable to connect to this org.', ex);
    } finally {
      setLoadingRetry(false);
    }
  };

  function handleOrgGroupChange(group: Maybe<OrgGroup>) {
    if (group && (!selectedOrg || !group.orgs.find(({ uniqueId }) => uniqueId === selectedOrg.uniqueId))) {
      if (group.orgs.length === 1) {
        setSelectedOrgId(group.orgs[0].uniqueId);
      } else {
        setSelectedOrgId(null);
      }
    } else if (!group && (!selectedOrg || selectedOrg.jetstreamOrganizationId != null)) {
      const orgsWithNoOrganization = allOrgs.filter(({ jetstreamOrganizationId }) => !jetstreamOrganizationId);
      if (orgsWithNoOrganization.length === 1) {
        setSelectedOrgId(orgsWithNoOrganization[0].uniqueId);
      } else {
        setSelectedOrgId(null);
      }
    }
    setActiveOrgGroup(group?.id);
  }

  return (
    <Fragment>
      {selectedOrg && !selectedOrg.connectionError && children}
      {selectedOrg?.connectionError && (
        <div
          css={css`
            background-color: var(--slds-g-color-surface-container-1, white);
          `}
        >
          <Alert type="error" leadingIcon="error">
            <div>
              <p>There was a problem connecting your org, re-connect your org to fix it.</p>
              <p>If you recently did a sandbox refresh and have a new Organization Id, you will need to delete the old org.</p>
              <p className="slds-m-top_x-small">
                <strong>Message</strong>: {selectedOrg.connectionError}
              </p>
            </div>
          </Alert>
          <div>
            <EmptyState size="large" headline={`Fix your org connection to continue`} illustration={<NoAccess2Illustration />}>
              <Link to={APP_ROUTES.SALESFORCE_ORG_GROUPS.ROUTE} className="slds-button slds-button_neutral slds-m-right_x-small">
                Manage Orgs
              </Link>
              {/* Stays focusable while the retry runs, so keyboard focus is not dropped to <body> */}
              <button
                className="slds-button slds-button_neutral slds-m-right_x-small"
                {...ariaDisabledButtonProps(loadingRetry, handleRetryOrgConnection)}
              >
                <Icon type="utility" icon="refresh" className="slds-button__icon slds-button__icon_left" omitContainer />
                Retry Connection
              </button>
              <AddOrg
                omitIcon
                className="slds-button_brand"
                existingOrg={selectedOrg?.uniqueId ? selectedOrg : undefined}
                label="Reconnect Org"
                popoverLabel="Reconnect Org"
                onAddOrg={handleAddOrg}
                onAddOrgHandlerFn={onAddOrgHandlerFn}
              />
            </EmptyState>
          </div>
        </div>
      )}
      {!selectedOrg && (
        <div>
          {hasConfiguredOrg && (
            <>
              <Alert type="info" leadingIcon="info">
                This action requires an org to be selected.{' '}
                {canConnectOrgs ? 'Select an existing org or connect a new one.' : 'Select an org.'}
              </Alert>
              <Grid vertical align="spread" verticalAlign="center" className="slds-m-top_medium">
                <Card
                  css={css`
                    min-width: 20rem;
                  `}
                  title="Select a Salesforce Org"
                >
                  <OrgsDropdown omitAddOrgsButton omitOrganizationSelector />
                </Card>
                {hasOrgGroupsConfigured && (
                  <Card
                    css={css`
                      min-width: 20rem;
                    `}
                    title={activeOrgGroup ? 'Switch Org Group' : 'Choose an Org Group'}
                  >
                    <OrganizationGroupSelector
                      groups={orgGroups}
                      selectedGroup={activeOrgGroup}
                      salesforceOrgsWithoutGroup={allOrgs.filter((org) => !org.jetstreamOrganizationId).length}
                      onSelection={handleOrgGroupChange}
                    />
                  </Card>
                )}
                {canConnectOrgs && (
                  <Card
                    css={css`
                      min-width: 20rem;
                    `}
                    title="Add a new Salesforce Org"
                  >
                    <AddOrg
                      className="slds-button slds-button_neutral"
                      label="Add Salesforce Org"
                      onAddOrg={handleAddOrg}
                      onAddOrgHandlerFn={onAddOrgHandlerFn}
                    />
                  </Card>
                )}
              </Grid>
            </>
          )}
          {!hasConfiguredOrg && canConnectOrgs && <OrgWelcomeInstructions />}
          {!hasConfiguredOrg && !canConnectOrgs && (
            <EmptyState
              size="large"
              headline="No Salesforce orgs are connected"
              subHeading={`${ACCESS_PROFILE_OPERATION_NOT_ALLOWED_MESSAGES['orgs.connect']} Ask your team administrator to update your access profile.`}
              illustration={<NoAccess2Illustration />}
            />
          )}
        </div>
      )}
    </Fragment>
  );
};

export default OrgSelectionRequired;
