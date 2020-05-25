import { describeGlobal } from '@jetstream/shared/data';
import { SobjectList } from '@jetstream/ui';
import { DescribeGlobalSObjectResult } from 'jsforce';
import React, { FunctionComponent, useEffect, useState } from 'react';
import { orderObjectsBy } from '@jetstream/shared/utils';

export interface QueryFieldsProps {
  onSelected: (sobject: DescribeGlobalSObjectResult) => void;
}

export const QuerySObjects: FunctionComponent<QueryFieldsProps> = ({ onSelected }) => {
  const [sobjects, setSobjects] = useState<DescribeGlobalSObjectResult[]>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>(null);

  useEffect(() => {
    if (!loading && !errorMessage && !sobjects) {
      (async () => {
        setLoading(true);
        try {
          const results = await describeGlobal();
          setSobjects(orderObjectsBy(results.sobjects.filter(filterSobjectFn), 'label'));
        } catch (ex) {
          console.error(ex);
          setErrorMessage(ex.message);
        }
        setLoading(false);
      })();
    }
  }, [loading, errorMessage, sobjects]);

  function filterSobjectFn(sobject: DescribeGlobalSObjectResult): boolean {
    return sobject.queryable && !sobject.name.endsWith('CleanInfo');
  }

  return <SobjectList sobjects={sobjects} loading={loading} errorMessage={errorMessage} onSelected={onSelected} />;
};

export default QuerySObjects;
