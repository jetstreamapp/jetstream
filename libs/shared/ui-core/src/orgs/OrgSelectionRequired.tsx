import { css } from '@emotion/react';
import { logger } from '@jetstream/shared/client-logger';
import { checkOrgHealth, getOrgs } from '@jetstream/shared/data';
import { AddOrgHandlerFn, JetstreamOrganization, Maybe, SalesforceOrgUi } from '@jetstream/types';
import { Alert, Card, EmptyState, fireToast, Grid, Icon, NoAccess2Illustration } from '@jetstream/ui';
import { fromAppState } from '@jetstream/ui/app-state';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { Fragment, FunctionComponent, useCallback, useState } from 'react';
import { fromJetstreamEvents, OrgsDropdown } from '..';
import AddOrg from './AddOrg';
import { OrgWelcomeInstructions } from './OrgWelcomeInstructions';
import { OrganizationSelector } from './OrganizationSelector';

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
  const jetstreamOrganizations = useAtomValue(fromAppState.jetstreamOrganizationsState);
  const hasOrganizationsConfigured = useAtomValue(fromAppState.jetstreamOrganizationsExistsSelector);
  const setActiveOrganization = useSetAtom(fromAppState.jetstreamActiveOrganizationState);
  const activeOrganization = useAtomValue(fromAppState.jetstreamActiveOrganizationSelector);
  const setSelectedOrgId = useSetAtom(fromAppState.selectedOrgIdState);

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
      {selectedOrg && !selectedOrg.connectionError && children}
      {selectedOrg?.connectionError && (
        <div
          css={css`
            background-color: white;
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
              <button
                className="slds-button slds-button_neutral slds-m-right_x-small"
                onClick={handleRetryOrgConnection}
                disabled={loadingRetry}
              >
                <Icon type="utility" icon="refresh" className="slds-button__icon slds-button__icon_left" omitContainer />
                Retry Connection
              </button>
              <AddOrg className="slds-button_brand" label="Reconnect Org" onAddOrg={handleAddOrg} onAddOrgHandlerFn={onAddOrgHandlerFn} />
            </EmptyState>
          </div>
        </div>
      )}
      {!selectedOrg && (
        <div>
          {hasConfiguredOrg && (
            <>
              <Alert type="info" leadingIcon="info">
                This action requires an org to be selected. Use the org dropdown to configure or select an org.
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
                {hasOrganizationsConfigured && (
                  <Card
                    css={css`
                      min-width: 20rem;
                    `}
                    title={activeOrganization ? 'Switch Organizations' : 'Choose an organization'}
                  >
                    <OrganizationSelector
                      organizations={jetstreamOrganizations}
                      selectedOrganization={activeOrganization}
                      salesforceOrgsWithoutOrganization={allOrgs.filter((org) => !org.jetstreamOrganizationId).length}
                      onSelection={handleOrganizationChange}
                    />
                  </Card>
                )}
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
              </Grid>
            </>
          )}
          {!hasConfiguredOrg && <OrgWelcomeInstructions />}
        </div>
      )}
    </Fragment>
  );
};

export default OrgSelectionRequired;
