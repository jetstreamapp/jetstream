import { logger } from '@jetstream/shared/client-logger';
import { describeGlobal } from '@jetstream/shared/data';
import { orderObjectsBy } from '@jetstream/shared/utils';
import { SalesforceOrgUi } from '@jetstream/types';
import { SobjectList } from '@jetstream/ui';
import { DescribeGlobalSObjectResult } from 'jsforce';
import React, { Fragment, FunctionComponent, useEffect, useState } from 'react';
import { useRecoilState, useRecoilValue } from 'recoil';
import { selectedOrgState } from '../../../app-state';
import * as fromQueryState from '../query.state';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface QuerySObjectsProps {}

export const QuerySObjects: FunctionComponent<QuerySObjectsProps> = () => {
  const [sobjects, setSobjects] = useRecoilState(fromQueryState.sObjectsState);
  const [selectedSObject, setSelectedSObject] = useRecoilState(fromQueryState.selectedSObjectState);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>(null);
  const selectedOrg = useRecoilValue<SalesforceOrgUi>(selectedOrgState);

  useEffect(() => {
    if (selectedOrg && !loading && !errorMessage && !sobjects) {
      (async () => {
        setLoading(true);
        try {
          const results = await describeGlobal(selectedOrg);
          setSobjects(orderObjectsBy(results.sobjects.filter(filterSobjectFn), 'label'));
        } catch (ex) {
          logger.error(ex);
          setErrorMessage(ex.message);
        }
        setLoading(false);
      })();
    }
  }, [selectedOrg, loading, errorMessage, sobjects, setSobjects]);

  function filterSobjectFn(sobject: DescribeGlobalSObjectResult): boolean {
    return sobject.queryable && !sobject.name.endsWith('CleanInfo');
  }

  return (
    <Fragment>
      <SobjectList
        sobjects={sobjects}
        selectedSObject={selectedSObject}
        loading={loading}
        errorMessage={errorMessage}
        onSelected={setSelectedSObject}
        errorReattempt={() => setErrorMessage(null)}
      />
    </Fragment>
  );
};

export default QuerySObjects;
