import { logger } from '@jetstream/shared/client-logger';
import { clearCacheForOrg, describeGlobal } from '@jetstream/shared/data';
import { NOOP, orderObjectsBy } from '@jetstream/shared/utils';
import { SalesforceOrgUi } from '@jetstream/types';
import { SobjectList } from '@jetstream/ui';
import { DescribeGlobalSObjectResult } from 'jsforce';
import React, { Fragment, FunctionComponent, useEffect, useRef, useState } from 'react';
import Grid from '../grid/Grid';
import Icon from '../widgets/Icon';
import Tooltip from '../widgets/Tooltip';
import formatRelative from 'date-fns/formatRelative';

// Store global state so that if a user leaves and comes back and items are restored
// we know the most recent known value to start with instead of no value
let _lastRefreshed: string;

function filterSobjectFn(sobject: DescribeGlobalSObjectResult): boolean {
  return sobject.queryable && !sobject.name.endsWith('CleanInfo');
}

export interface ConnectedSobjectListProps {
  label?: string;
  selectedOrg: SalesforceOrgUi;
  sobjects: DescribeGlobalSObjectResult[];
  selectedSObject: DescribeGlobalSObjectResult;
  filterFn?: (sobject: DescribeGlobalSObjectResult) => boolean;
  onSobjects: (sobjects: DescribeGlobalSObjectResult[]) => void;
  onSelectedSObject: (selectedSObject: DescribeGlobalSObjectResult) => void;
}

export const ConnectedSobjectList: FunctionComponent<ConnectedSobjectListProps> = ({
  label = 'Objects',
  selectedOrg,
  sobjects,
  selectedSObject,
  filterFn = filterSobjectFn,
  onSobjects,
  onSelectedSObject,
}) => {
  const isMounted = useRef(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>(null);
  const [lastRefreshed, setLastRefreshed] = useState<string>(_lastRefreshed);

  useEffect(() => {
    isMounted.current = true;
    return () => (isMounted.current = false);
  }, []);

  useEffect(() => {
    _lastRefreshed = lastRefreshed;
  }, [lastRefreshed]);

  useEffect(() => {
    if (selectedOrg && !loading && !errorMessage && !sobjects) {
      loadObjects().then(NOOP);
    }
  }, [selectedOrg, loading, errorMessage, sobjects, onSobjects]);

  async function loadObjects() {
    const uniqueId = selectedOrg.uniqueId;
    try {
      setLoading(true);
      const resultsWithCache = await describeGlobal(selectedOrg);
      const results = resultsWithCache.data;
      if (!isMounted.current || uniqueId !== selectedOrg.uniqueId) {
        return;
      }
      if (resultsWithCache.cache) {
        const cache = resultsWithCache.cache;
        setLastRefreshed(`Last updated ${formatRelative(cache.age, new Date())}`);
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
  }

  async function handleRefresh() {
    try {
      await clearCacheForOrg(selectedOrg);
      onSobjects(null);
      onSelectedSObject(null);
      await loadObjects();
    } catch (ex) {
      // error
    }
  }

  return (
    <Fragment>
      <Grid>
        <h2 className="slds-text-heading_medium slds-grow slds-text-align_center">{label}</h2>
        <div>
          <Tooltip id={`sobject-list-refresh-tooltip`} content={lastRefreshed}>
            <button className="slds-button slds-button_icon slds-button_icon-container" disabled={loading} onClick={handleRefresh}>
              <Icon
                type="utility"
                icon="refresh"
                description={`Reload objects - Last loaded: foo`}
                className="slds-button__icon"
                omitContainer
              />
            </button>
          </Tooltip>
        </div>
      </Grid>
      <SobjectList
        sobjects={sobjects}
        selectedSObject={selectedSObject}
        loading={loading}
        errorMessage={errorMessage}
        onSelected={onSelectedSObject}
        errorReattempt={() => setErrorMessage(null)}
      />
    </Fragment>
  );
};

export default ConnectedSobjectList;
