import { logger } from '@jetstream/shared/client-logger';
import { useRollbar } from '@jetstream/shared/ui-utils';
import { getErrorMessageAndStackObj } from '@jetstream/shared/utils';
import { Maybe, SalesforceOrgUi } from '@jetstream/types';
import { fireToast } from '@jetstream/ui';
import { fromQueryState, selectedOrgState } from '@jetstream/ui-core';
import { Query, parseQuery } from '@jetstreamapp/soql-parser-js';
import isString from 'lodash/isString';
import { useEffect, useRef, useState } from 'react';
import { useRecoilValue, useResetRecoilState, useSetRecoilState } from 'recoil';
import { QueryRestoreErrors, UserFacingRestoreError, restoreQuery } from './query-restore-utils';

const ERROR_MESSAGES = {
  PARSE_ERROR: 'There was an error parsing your query, please try again or submit a support request if the problem continues.',
};

export type UseQueryRestoreReturnType = [(soqlOverride?: string, toolingOverride?: boolean) => Promise<void>, Maybe<string>];

export const useQueryRestore = (
  soql: Maybe<string> = '',
  isTooling = false,
  options?: {
    // emit toast messages on errors
    silent?: boolean;
    // called when restore is started
    startRestore?: () => void;
    // called when restore is finished
    endRestore?: (isTooling: boolean, fatalError: boolean, errors?: QueryRestoreErrors) => void;
  }
): UseQueryRestoreReturnType => {
  soql = soql || '';
  options = options || {};
  const { silent, startRestore, endRestore } = options;

  const rollbar = useRollbar();

  const isMounted = useRef(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const org = useRecoilValue<SalesforceOrgUi>(selectedOrgState);
  // we should compare setting here vs in a selector - any difference in performance?

  const setIsRestore = useSetRecoilState(fromQueryState.isRestore);
  const setIsTooling = useSetRecoilState(fromQueryState.isTooling);
  const setSObjectsState = useSetRecoilState(fromQueryState.sObjectsState);
  const setSelectedSObjectState = useSetRecoilState(fromQueryState.selectedSObjectState);
  const setQueryFieldsKey = useSetRecoilState(fromQueryState.queryFieldsKey);
  const setQueryChildRelationships = useSetRecoilState(fromQueryState.queryChildRelationships);
  const setQueryFieldsMapState = useSetRecoilState(fromQueryState.queryFieldsMapState);
  const setSelectedQueryFieldsState = useSetRecoilState(fromQueryState.selectedQueryFieldsState);
  const setSelectedSubqueryFieldsState = useSetRecoilState(fromQueryState.selectedSubqueryFieldsState);
  const setFilterQueryFieldsState = useSetRecoilState(fromQueryState.filterQueryFieldsState);
  const setQueryRestoreKeyState = useSetRecoilState(fromQueryState.queryRestoreKeyState);
  const setQueryFiltersState = useSetRecoilState(fromQueryState.queryFiltersState);
  const setQueryHavingState = useSetRecoilState(fromQueryState.queryHavingState);
  const setOrderByQueryFieldsState = useSetRecoilState(fromQueryState.orderByQueryFieldsState);
  const setFieldFilterFunctions = useSetRecoilState(fromQueryState.fieldFilterFunctions);
  const setGroupByQueryFieldsState = useSetRecoilState(fromQueryState.groupByQueryFieldsState);
  const setQueryGroupByState = useSetRecoilState(fromQueryState.queryGroupByState);
  const setQueryOrderByState = useSetRecoilState(fromQueryState.queryOrderByState);
  const setQueryLimit = useSetRecoilState(fromQueryState.queryLimit);
  const setQueryLimitSkip = useSetRecoilState(fromQueryState.queryLimitSkip);

  const resetSelectedSObjectState = useResetRecoilState(fromQueryState.selectedSObjectState);

  const resetFieldFilterFunctions = useResetRecoilState(fromQueryState.fieldFilterFunctions);
  const resetQueryFiltersState = useResetRecoilState(fromQueryState.queryFiltersState);
  const resetQueryHavingState = useResetRecoilState(fromQueryState.queryHavingState);
  const resetQueryGroupByState = useResetRecoilState(fromQueryState.queryGroupByState);
  const resetQueryOrderByState = useResetRecoilState(fromQueryState.queryOrderByState);
  const resetQueryLimit = useResetRecoilState(fromQueryState.queryLimit);
  const resetQueryLimitSkip = useResetRecoilState(fromQueryState.queryLimitSkip);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  async function restore(soqlOverride?: string, toolingOverride = false) {
    const currSoql = isString(soqlOverride) ? soqlOverride : soql;
    setErrorMessage(null);
    let query: Query;
    try {
      query = parseQuery(currSoql || '');
    } catch (ex) {
      setErrorMessage(ERROR_MESSAGES.PARSE_ERROR);
      if (endRestore) {
        // TODO: send error info
        endRestore(true, toolingOverride ?? isTooling);
      }
      return;
    }

    setIsRestore(true);
    if (startRestore) {
      startRestore();
    }

    try {
      const results = await restoreQuery(org, query, toolingOverride ?? isTooling);

      if (isMounted.current) {
        resetSelectedSObjectState();

        setIsTooling(toolingOverride ?? isTooling);
        setFilterQueryFieldsState(results.filterQueryFieldsState);
        setOrderByQueryFieldsState(results.orderByQueryFieldsState);
        setGroupByQueryFieldsState(results.groupByQueryFieldsState);
        results.fieldFilterFunctions ? setFieldFilterFunctions(results.fieldFilterFunctions) : resetFieldFilterFunctions();
        results.queryFiltersState ? setQueryFiltersState(results.queryFiltersState) : resetQueryFiltersState();
        results.queryHavingState ? setQueryHavingState(results.queryHavingState) : resetQueryHavingState();
        results.queryGroupByState ? setQueryGroupByState(results.queryGroupByState) : resetQueryGroupByState();
        results.queryOrderByState ? setQueryOrderByState(results.queryOrderByState) : resetQueryOrderByState();
        results.queryLimit ? setQueryLimit(results.queryLimit) : resetQueryLimit();
        results.queryLimitSkip ? setQueryLimitSkip(results.queryLimitSkip) : resetQueryLimitSkip();

        // The order of these are critical to QueryFields.tsx to ensure no bad init
        setQueryFieldsMapState(results.queryFieldsMapState);
        setQueryFieldsKey(results.queryFieldsKey);

        setSObjectsState(results.sObjectsState);
        setQueryChildRelationships(results.queryChildRelationships);
        setSelectedQueryFieldsState(results.selectedQueryFieldsState);
        setSelectedSubqueryFieldsState(results.selectedSubqueryFieldsState);

        // This must come last to ensure components are not rendered prior to data being set
        setSelectedSObjectState(results.selectedSObjectState);
        // Ensure components are forced to re-initialize
        setQueryRestoreKeyState(new Date().getTime() + Math.random());

        if (endRestore) {
          endRestore(false, toolingOverride ?? isTooling, {
            missingFields: results.missingFields,
            missingSubqueryFields: results.missingSubqueryFields,
            missingMisc: results.missingMisc,
          });
        }

        if (!silent) {
          let doFireToast = false;

          if (results.missingFields.length) {
            doFireToast = true;
          }
          if (Object.values(results.missingSubqueryFields).reduce((numFields, items) => numFields + items.length, 0)) {
            doFireToast = true;
          }
          if (Object.keys(results.missingMisc).length) {
            doFireToast = true;
          }
          if (doFireToast) {
            fireToast({ message: 'Some parts of your query could not be restored.', type: 'info' });
          }
        }
      }
    } catch (ex) {
      if (isMounted.current && endRestore) {
        if (ex instanceof UserFacingRestoreError) {
          setErrorMessage(ex.message);
        } else {
          logger.warn('[QUERY RESTORE][ERROR]', ex);
          setErrorMessage('An unknown error has ocurred while restoring your query');
          rollbar.error('Query Restore Error', { ...getErrorMessageAndStackObj(ex), query: currSoql });
        }
        endRestore(true, toolingOverride ?? isTooling);
      }
    } finally {
      // ensure page has time to catch up - dom takes an moment to render things
      if (isMounted.current) {
        setIsRestore(false);
      }
    }
  }

  return [restore, errorMessage];
};

export default useQueryRestore;
