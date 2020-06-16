import { describeGlobal } from '@jetstream/shared/data';
import { SobjectList } from '@jetstream/ui';
import { DescribeGlobalSObjectResult } from 'jsforce';
import React, { FunctionComponent, useEffect, useState } from 'react';
import { orderObjectsBy } from '@jetstream/shared/utils';
import { useRecoilValue, useRecoilState } from 'recoil';
import { SalesforceOrg } from '@jetstream/types';
import { selectedOrgState } from '../../app-state';
import * as fromQueryState from './query.state';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface QueryFieldsProps {}

export const QuerySObjects: FunctionComponent<QueryFieldsProps> = () => {
  const [sobjects, setSobjects] = useRecoilState(fromQueryState.sObjectsState);
  const [selectedSObject, setSelectedSObject] = useRecoilState(fromQueryState.selectedSObjectState);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>(null);
  const selectedOrg = useRecoilValue<SalesforceOrg>(selectedOrgState);

  useEffect(() => {
    if (selectedOrg && !loading && !errorMessage && !sobjects) {
      (async () => {
        setLoading(true);
        try {
          const results = await describeGlobal(selectedOrg);
          setSobjects(orderObjectsBy(results.sobjects.filter(filterSobjectFn), 'label'));
        } catch (ex) {
          console.error(ex);
          setErrorMessage(ex.message);
        }
        setLoading(false);
      })();
    }
  }, [selectedOrg, loading, errorMessage, sobjects]);

  function filterSobjectFn(sobject: DescribeGlobalSObjectResult): boolean {
    return sobject.queryable && !sobject.name.endsWith('CleanInfo');
  }

  return (
    <SobjectList
      sobjects={sobjects}
      selectedSObject={selectedSObject}
      loading={loading}
      errorMessage={errorMessage}
      onSelected={setSelectedSObject}
    />
  );
};

export default QuerySObjects;
