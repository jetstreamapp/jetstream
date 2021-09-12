/** @jsx jsx */
import { css, jsx } from '@emotion/react';
import { logger } from '@jetstream/shared/client-logger';
import { SocketAck } from '@jetstream/types';
import { io, Socket } from 'socket.io-client';
import { DefaultEventsMap } from 'socket.io-client/build/typed-events';

export interface OrgSelectionRequiredProps {}

export const OrgSelectionRequired: FunctionComponent<OrgSelectionRequiredProps> = ({ children }) => {
  const selectedOrg = useRecoilValue<SalesforceOrgUi>(fromAppState.selectedOrgState);
  const hasConfiguredOrg = useRecoilValue<boolean>(fromAppState.hasConfiguredOrgState);

  function handleAddOrg(org: SalesforceOrgUi) {
    fromJetstreamEvents.emit({ type: 'addOrg', payload: { org } });
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
            </div>
          </Alert>
          <div>
            <EmptyState size="large" headline={`Fix your org connection to continue`} illustration={<NoAccess2Illustration />}>
              <AddOrg className="slds-button_brand" label="Reconnect Org" onAddOrg={handleAddOrg} />
            </EmptyState>
          </div>
        </div>
      )}
      {!selectedOrg && (
        <div>
          {hasConfiguredOrg && (
            <Alert type="info" leadingIcon="info">
              This action requires an org to be selected. Use the org dropdown to configure or select an org.
            </Alert>
          )}
          {!hasConfiguredOrg && <OrgWelcomeInstructions />}
        </div>
      )}
    </Fragment>
  );
};

export default OrgSelectionRequired;
