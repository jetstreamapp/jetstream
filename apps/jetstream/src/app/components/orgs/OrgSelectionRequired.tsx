/** @jsx jsx */
import { jsx } from '@emotion/core';
import { SalesforceOrgUi } from '@jetstream/types';
import { Alert } from '@jetstream/ui';
import { Fragment, FunctionComponent } from 'react';
import { useRecoilValue } from 'recoil';
import * as fromAppState from '../../app-state';
import { OrgWelcomeInstructions } from './OrgWelcomeInstructions';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface OrgSelectionRequiredProps {}

export const OrgSelectionRequired: FunctionComponent<OrgSelectionRequiredProps> = ({ children }) => {
  const selectedOrg = useRecoilValue<SalesforceOrgUi>(fromAppState.selectedOrgState);
  const hasConfiguredOrg = useRecoilValue<boolean>(fromAppState.hasConfiguredOrgState);

  return (
    <Fragment>
      {selectedOrg && children}
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
