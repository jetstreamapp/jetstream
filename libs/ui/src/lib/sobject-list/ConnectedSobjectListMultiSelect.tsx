import { logger } from '@jetstream/shared/client-logger';
import { clearCacheForOrg, describeGlobal } from '@jetstream/shared/data';
import { NOOP, orderObjectsBy } from '@jetstream/shared/utils';
import { DescribeGlobalSObjectResult, Maybe, RecentHistoryItemType, SalesforceOrgUi } from '@jetstream/types';
import { recentHistoryItemsDb } from '@jetstream/ui/db';
import { formatRelative } from 'date-fns/formatRelative';
import { useLiveQuery } from 'dexie-react-hooks';
import { forwardRef, Fragment, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import Grid from '../grid/Grid';
import Icon from '../widgets/Icon';
import Tooltip from '../widgets/Tooltip';
import {
  filterSobjects,
  getDefaultSobjectFilters,
  getHasFiltersApplied,
  ObjectFilterValues,
  SobjectFieldListFilter,
} from './SobjectListFilter';
import { SobjectListMultiSelect } from './SobjectListMultiSelect';

// Store global state so that if a user leaves and comes back and items are restored
// we know the most recent known value to start with instead of no value
let _lastRefreshed: string;

function filterSobjectFn(sobject: DescribeGlobalSObjectResult): boolean {
  return sobject.queryable && !sobject.name.endsWith('CleanInfo');
}

export interface ConnectedSobjectListMultiSelectRef {
  refresh: () => void;
}

export interface ConnectedSobjectListMultiSelectProps {
  label?: string;
  selectedOrg: SalesforceOrgUi;
  sobjects: Maybe<DescribeGlobalSObjectResult[]>;
  selectedSObjects: string[];
  allowSelectAll?: boolean;
  retainSelectionOnRefresh?: boolean;
  recentItemsEnabled?: boolean;
  recentItemsKey?: RecentHistoryItemType;
  filterFn?: (sobject: DescribeGlobalSObjectResult | null) => boolean;
  onSobjects: (sobjects: DescribeGlobalSObjectResult[] | null) => void;
  onSelectedSObjects: (selectedSObjects: string[]) => void;
  onRefresh?: () => void;
}

export const ConnectedSobjectListMultiSelect = forwardRef<any, ConnectedSobjectListMultiSelectProps>(
  (
    {
      label = 'Objects',
      selectedOrg,
      sobjects,
      selectedSObjects,
      allowSelectAll,
      retainSelectionOnRefresh,
      recentItemsEnabled,
      recentItemsKey,
      filterFn = filterSobjectFn,
      onSobjects,
      onSelectedSObjects,
      onRefresh,
    },
    ref
  ) => {
    const isMounted = useRef(true);
    const [loading, setLoading] = useState<boolean>(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [lastRefreshed, setLastRefreshed] = useState<string>(_lastRefreshed);

    const [selectedFilters, setSelectedFilters] = useState<ObjectFilterValues>(() => getDefaultSobjectFilters());

    useImperativeHandle<any, { refresh: () => void }>(ref, () => ({
      refresh() {
        handleRefresh();
      },
    }));

    useEffect(() => {
      isMounted.current = true;
      return () => {
        isMounted.current = false;
      };
    }, []);

    useEffect(() => {
      _lastRefreshed = lastRefreshed;
    }, [lastRefreshed]);

    const recentItems = useLiveQuery(async () => {
      if (recentItemsEnabled && recentItemsKey && sobjects) {
        return recentHistoryItemsDb.getRecentHistoryFromRecords({ orgUniqueId: selectedOrg.uniqueId, recentItemsKey, records: sobjects });
      }
      return null;
    }, [sobjects]);

    const { sobjectsFiltered, recentItemsFiltered } = useMemo(() => {
      if (!sobjects || !recentItems || !getHasFiltersApplied(selectedFilters)) {
        return {
          sobjectsFiltered: sobjects,
          recentItemsFiltered: recentItems,
        };
      }
      const sobjectsFiltered = filterSobjects(sobjects, selectedFilters);
      const recentItemsFiltered = filterSobjects(recentItems, selectedFilters);
      return { sobjectsFiltered, recentItemsFiltered };
    }, [recentItems, selectedFilters, sobjects]);

    const loadObjects = useCallback(async () => {
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
          setLastRefreshed(`Last updated from Salesforce ${formatRelative(cache.age, new Date())}`);
        }
        onSobjects(orderObjectsBy(results.sobjects.filter(filterFn), 'label'));
      } catch (ex) {
        logger.error(ex);
        if (!isMounted.current || uniqueId !== selectedOrg.uniqueId) {
          return;
        }
        setErrorMessage(ex.message);
      }
      setLoading(false);
    }, [filterFn, onSobjects, selectedOrg]);

    useEffect(() => {
      if (selectedOrg && !loading && !errorMessage && !sobjects) {
        loadObjects().then(NOOP);
      }
    }, [selectedOrg, loading, errorMessage, sobjects, onSobjects, loadObjects]);

    async function handleRefresh() {
      try {
        await clearCacheForOrg(selectedOrg);
        onSobjects(null);
        if (!retainSelectionOnRefresh) {
          onSelectedSObjects([]);
        }
        await loadObjects();
        if (isMounted.current) {
          onRefresh && onRefresh();
        }
      } catch (ex) {
        // error
      }
    }

    return (
      <Fragment>
        <Grid>
          <h2 className="slds-text-heading_medium slds-grow slds-text-align_center">
            {label}
            <SobjectFieldListFilter onChange={setSelectedFilters} />
          </h2>
          <div>
            <Tooltip id={`sobject-list-refresh-tooltip`} content={lastRefreshed}>
              <button className="slds-button slds-button_icon slds-button_icon-container" disabled={loading} onClick={handleRefresh}>
                <Icon type="utility" icon="refresh" description={`Reload objects`} className="slds-button__icon" omitContainer />
              </button>
            </Tooltip>
          </div>
        </Grid>
        <SobjectListMultiSelect
          sobjects={sobjectsFiltered}
          selectedSObjects={selectedSObjects}
          loading={loading}
          errorMessage={errorMessage}
          allowSelectAll={allowSelectAll}
          recentItemsEnabled={recentItemsEnabled}
          recentItems={recentItemsFiltered}
          onSelected={onSelectedSObjects}
          errorReattempt={() => setErrorMessage(null)}
        />
      </Fragment>
    );
  }
);

export default ConnectedSobjectListMultiSelect;
