/* eslint-disable @typescript-eslint/no-unused-vars */
import { logger } from '@jetstream/shared/client-logger';
import { query } from '@jetstream/shared/data';
import { formatNumber, useDebounce } from '@jetstream/shared/ui-utils';
import { pluralizeFromNumber } from '@jetstream/shared/utils';
import { SalesforceOrgUi } from '@jetstream/types';
import isNumber from 'lodash/isNumber';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRecoilValue } from 'recoil';
import * as fromQueryState from '../query.state';

export interface QueryCountProps {
  org: SalesforceOrgUi;
}

export const QueryCount = ({ org }: QueryCountProps) => {
  const isMounted = useRef(true);
  const currentReq = useRef(0);
  const selectedSObject = useRecoilValue(fromQueryState.selectedSObjectState);
  const isTooling = useRecoilValue(fromQueryState.isTooling);
  const includeDeleted = useRecoilValue(fromQueryState.queryIncludeDeletedRecordsState);
  const querySoqlCount = useRecoilValue(fromQueryState.querySoqlCountState);
  const debouncedQuerySoqlCount = useDebounce(querySoqlCount);
  const [recordCount, setRecordCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchRecordCount = useCallback(
    async (soql: string) => {
      try {
        currentReq.current++;
        const reqId = currentReq.current;
        setLoading(true);
        const results = await query(org, soql, isTooling, includeDeleted);
        // in case results are out of order, ignore any stale results
        if (!isMounted.current || reqId !== currentReq.current) {
          return;
        }
        setRecordCount(results.queryResults.totalSize);
      } catch (ex) {
        logger.warn('Error getting record count');
        setRecordCount(null);
      } finally {
        setLoading(false);
      }
    },
    [includeDeleted, isTooling, org]
  );

  useEffect(() => {
    currentReq.current++;
    setRecordCount(null);
  }, [org, selectedSObject]);

  useEffect(() => {
    if (debouncedQuerySoqlCount) {
      fetchRecordCount(debouncedQuerySoqlCount);
    } else {
      setRecordCount(null);
    }
  }, [debouncedQuerySoqlCount, fetchRecordCount]);

  if (!org || !selectedSObject || !isNumber(recordCount)) {
    return null;
  }

  return (
    <p className="slds-text-body_small slds-text-color_weak">
      {formatNumber(recordCount)} {pluralizeFromNumber('record', recordCount)}
    </p>
  );
};

export default QueryCount;
