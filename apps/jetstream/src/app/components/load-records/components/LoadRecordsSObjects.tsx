import { logger } from '@jetstream/shared/client-logger';
import { describeGlobal } from '@jetstream/shared/data';
import { orderObjectsBy } from '@jetstream/shared/utils';
import { SalesforceOrgUi } from '@jetstream/types';
import { SobjectList } from '@jetstream/ui';
import { DescribeGlobalSObjectResult } from 'jsforce';
import React, { Fragment, FunctionComponent, useEffect, useRef, useState } from 'react';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface LoadRecordsSObjectsProps {
  selectedOrg: SalesforceOrgUi;
  sobjects: DescribeGlobalSObjectResult[];
  selectedSObject: DescribeGlobalSObjectResult;
  onSobjects: (sobjects: DescribeGlobalSObjectResult[]) => void;
  onSelectedSobject: (selectedSObject: DescribeGlobalSObjectResult) => void;
}

export const LoadRecordsSObjects: FunctionComponent<LoadRecordsSObjectsProps> = ({
  selectedOrg,
  sobjects,
  selectedSObject,
  onSobjects,
  onSelectedSobject,
}) => {
  const isMounted = useRef(null);
  // const [sobjects, setSobjects] = useRecoilState(fromLoadRecordsState.sObjectsState);
  // const [selectedSObject, setSelectedSObject] = useRecoilState(fromLoadRecordsState.selectedSObjectState);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>(null);
  // const selectedOrg = useRecoilValue<SalesforceOrgUi>(selectedOrgState);

  useEffect(() => {
    isMounted.current = true;
    return () => (isMounted.current = false);
  }, []);

  useEffect(() => {
    if (selectedOrg && !loading && !errorMessage && !sobjects) {
      (async () => {
        const uniqueId = selectedOrg.uniqueId;
        setLoading(true);
        try {
          const results = await describeGlobal(selectedOrg);
          if (!isMounted.current || uniqueId !== selectedOrg.uniqueId) {
            return;
          }
          onSobjects(orderObjectsBy(results.sobjects.filter(filterSobjectFn), 'label'));
        } catch (ex) {
          logger.error(ex);
          if (!isMounted.current || uniqueId !== selectedOrg.uniqueId) {
            return;
          }
          setErrorMessage(ex.message);
        }
        setLoading(false);
      })();
    }
  }, [selectedOrg, loading, errorMessage, sobjects, onSobjects]);

  function filterSobjectFn(sobject: DescribeGlobalSObjectResult): boolean {
    return (
      sobject.updateable && !sobject.name.endsWith('CleanInfo') && !sobject.name.endsWith('Share') && !sobject.name.endsWith('History')
    );
  }

  return (
    <Fragment>
      <SobjectList
        sobjects={sobjects}
        selectedSObject={selectedSObject}
        loading={loading}
        errorMessage={errorMessage}
        onSelected={onSelectedSobject}
        errorReattempt={() => setErrorMessage(null)}
      />
    </Fragment>
  );
};

export default LoadRecordsSObjects;
