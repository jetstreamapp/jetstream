import { SalesforceOrgUi } from '@jetstream/types';
import { ConnectedSobjectList } from '@jetstream/ui';
import React, { Fragment, FunctionComponent } from 'react';
import { useRecoilState, useRecoilValue } from 'recoil';
import { selectedOrgState } from '../../../app-state';
import * as fromQueryState from '../query.state';

export const QuerySObjects: FunctionComponent = () => {
  const [sobjects, setSobjects] = useRecoilState(fromQueryState.sObjectsState);
  const [selectedSObject, setSelectedSObject] = useRecoilState(fromQueryState.selectedSObjectState);
  const selectedOrg = useRecoilValue<SalesforceOrgUi>(selectedOrgState);

  return (
    <Fragment>
      <ConnectedSobjectList
        selectedOrg={selectedOrg}
        sobjects={sobjects}
        selectedSObject={selectedSObject}
        onSobjects={setSobjects}
        onSelectedSObject={setSelectedSObject}
      />
    </Fragment>
  );
};

export default QuerySObjects;
