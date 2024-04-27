import { logger } from '@jetstream/shared/client-logger';
import { clearCacheForOrg, describeGlobal } from '@jetstream/shared/data';
import { useNonInitialEffect } from '@jetstream/shared/ui-utils';
import { orderObjectsBy } from '@jetstream/shared/utils';
import { DescribeGlobalSObjectResult, Maybe, SalesforceOrgUi } from '@jetstream/types';
import { formatRelative } from 'date-fns/formatRelative';
import { Fragment, FunctionComponent, useCallback, useEffect, useRef, useState } from 'react';
import Grid from '../grid/Grid';
import Icon from '../widgets/Icon';
import Tooltip from '../widgets/Tooltip';
import { SobjectList } from './SobjectList';

// Store global state so that if a user leaves and comes back and items are restored
// we know the most recent known value to start with instead of no value
let _lastRefreshed: string;

export function filterSobjectFn(sobject: DescribeGlobalSObjectResult): boolean {
  return sobject.queryable && !sobject.name.endsWith('CleanInfo');
}

export function filterToolingSobjectFn(sobject: DescribeGlobalSObjectResult): boolean {
  return sobject.queryable && sobject.label !== 'Entity';
}

export interface ConnectedSobjectListProps {
  label?: string;
  selectedOrg: SalesforceOrgUi;
  sobjects: Maybe<DescribeGlobalSObjectResult[]>;
  selectedSObject: Maybe<DescribeGlobalSObjectResult>;
  isTooling?: boolean;
  initialSearchTerm?: string;
  filterFn?: (sobject: DescribeGlobalSObjectResult) => boolean;
  onSobjects: (sobjects: DescribeGlobalSObjectResult[] | null) => void;
  onSelectedSObject: (selectedSObject: DescribeGlobalSObjectResult | null) => void;
  onSearchTermChange?: (searchTerm: string) => void;
}

export const ConnectedSobjectList: FunctionComponent<ConnectedSobjectListProps> = ({
  label = 'Objects',
  selectedOrg,
  sobjects,
  selectedSObject,
  isTooling,
  initialSearchTerm,
  filterFn = isTooling ? filterToolingSobjectFn : filterSobjectFn,
  onSobjects,
  onSelectedSObject,
  onSearchTermChange,
}) => {
  const isMounted = useRef(true);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<string>(_lastRefreshed);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    _lastRefreshed = lastRefreshed;
  }, [lastRefreshed]);

  const loadObjects = useCallback(async () => {
    const uniqueId = selectedOrg.uniqueId;
    const priorToolingValue = isTooling;
    try {
      setLoading(true);
      const resultsWithCache = await describeGlobal(selectedOrg, isTooling);
      const results = resultsWithCache.data;
      if (!isMounted.current || uniqueId !== selectedOrg.uniqueId || priorToolingValue !== isTooling) {
        return;
      }
      if (resultsWithCache.cache) {
        const cache = resultsWithCache.cache;
        setLastRefreshed(`Last updated ${formatRelative(cache.age, new Date())}`);
      }
      onSobjects(orderObjectsBy(results.sobjects.filter(filterFn), 'label'));
    } catch (ex) {
      logger.error(ex);
      if (!isMounted.current || uniqueId !== selectedOrg.uniqueId || priorToolingValue !== isTooling) {
        return;
      }
      setErrorMessage(ex.message);
    } finally {
      setLoading(false);
    }
  }, [filterFn, onSobjects, selectedOrg, isTooling]);

  useEffect(() => {
    if (selectedOrg && !loading && !errorMessage && !sobjects) {
      loadObjects();
    }
  }, [selectedOrg, loading, errorMessage, sobjects, onSobjects, loadObjects]);

  useNonInitialEffect(() => {
    if (selectedOrg) {
      onSobjects(null);
      onSelectedSObject(null);
      // loadObjects called by different useEffect
    }
  }, [isTooling]);

  async function handleRefresh() {
    try {
      await clearCacheForOrg(selectedOrg);
      onSobjects(null);
      onSelectedSObject(null);
      // loadObjects called by different useEffect
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
            <button
              data-testid="sobject-list-refresh"
              className="slds-button slds-button_icon slds-button_icon-container"
              disabled={loading}
              onClick={handleRefresh}
            >
              <Icon type="utility" icon="refresh" description={`Reload objects`} className="slds-button__icon" omitContainer />
            </button>
          </Tooltip>
        </div>
      </Grid>
      <SobjectList
        isTooling={isTooling}
        sobjects={sobjects}
        selectedSObject={selectedSObject}
        loading={loading}
        errorMessage={errorMessage}
        initialSearchTerm={initialSearchTerm}
        onSelected={onSelectedSObject}
        errorReattempt={() => setErrorMessage(null)}
        onSearchTermChange={onSearchTermChange}
      />
    </Fragment>
  );
};

export default ConnectedSobjectList;
