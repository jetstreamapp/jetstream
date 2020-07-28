/** @jsx jsx */
import { jsx } from '@emotion/core';
import { SalesforceOrgUi } from '@jetstream/types';
import { Alert } from '@jetstream/ui';
import { Fragment, FunctionComponent } from 'react';
import { useRecoilValue } from 'recoil';
import { selectedOrgState } from '../../app-state';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface OrgSelectionRequiredProps {}

export const OrgSelectionRequired: FunctionComponent<OrgSelectionRequiredProps> = ({ children }) => {
  const selectedOrg = useRecoilValue<SalesforceOrgUi>(selectedOrgState);
  return (
    <Fragment>
      {selectedOrg && children}
      {!selectedOrg && (
        <Alert type="info" leadingIcon="info">
          This action requires an org to be selected. Use the org dropdown to configure or select an org.
        </Alert>
      )}
    </Fragment>
  );
};

export default OrgSelectionRequired;
