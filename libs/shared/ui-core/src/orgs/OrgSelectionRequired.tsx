import { css } from '@emotion/react';
import { logger } from '@jetstream/shared/client-logger';
import { checkOrgHealth, getOrgs } from '@jetstream/shared/data';
import { SalesforceOrgUi } from '@jetstream/types';
import { Alert, EmptyState, Icon, NoAccess2Illustration, fireToast } from '@jetstream/ui';
import { Fragment, FunctionComponent, useCallback, useState } from 'react';
import { useRecoilValue, useSetRecoilState } from 'recoil';
import { fromAppState, fromJetstreamEvents } from '..';
import AddOrg from './AddOrg';
import { OrgWelcomeInstructions } from './OrgWelcomeInstructions';

export interface OrgSelectionRequiredProps {
  children?: React.ReactNode;
}

export const OrgSelectionRequired: FunctionComponent<OrgSelectionRequiredProps> = ({ children }) => {
  const selectedOrg = useRecoilValue<SalesforceOrgUi | undefined>(fromAppState.selectedOrgStateWithoutPlaceholder);
  const hasConfiguredOrg = useRecoilValue<boolean>(fromAppState.hasConfiguredOrgState);
  const setOrgs = useSetRecoilState(fromAppState.salesforceOrgsState);

  const [loadingRetry, setLoadingRetry] = useState(false);

  const handleAddOrg = useCallback((org: SalesforceOrgUi, switchActiveOrg: boolean) => {
    fromJetstreamEvents.emit({ type: 'addOrg', payload: { org, switchActiveOrg } });
  }, []);

  const handleRetryOrgConnection = async () => {
    try {
      if (!selectedOrg) {
        return;
      }
      setLoadingRetry(true);
      await checkOrgHealth(selectedOrg);
      setOrgs(await getOrgs());
      fireToast({ type: 'success', message: 'Your org is now valid.' });
    } catch (ex) {
      fireToast({ type: 'error', message: 'Unable to connect to your org, reconnect to Salesforce to keep using this org.' });
      logger.log('Unable to connect to this org.', ex);
    } finally {
      setLoadingRetry(false);
    }
  };

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
              <AddOrg className="slds-button_brand" label="Reconnect Org" onAddOrg={handleAddOrg} />
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
              <OrgWelcomeInstructions />
            </>
          )}
          {!hasConfiguredOrg && <OrgWelcomeInstructions />}
        </div>
      )}
    </Fragment>
  );
};

export default OrgSelectionRequired;
