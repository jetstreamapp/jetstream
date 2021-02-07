/* eslint-disable @typescript-eslint/no-unused-vars */
import { useNonInitialEffect } from '@jetstream/shared/ui-utils';
import { REGEX } from '@jetstream/shared/utils';
import { Input } from '@jetstream/ui';
import React, { FunctionComponent, useEffect, useState } from 'react';
import { useRecoilState, useRecoilValue } from 'recoil';
import * as fromQueryState from '../query.state';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface QueryLimitProps {}

function sanitize(value: string) {
  return value.replace(REGEX.NOT_UNSIGNED_NUMERIC, '');
}

export const QueryLimit: FunctionComponent<QueryLimitProps> = React.memo(() => {
  const hasLimitOverride = useRecoilValue(fromQueryState.selectQueryLimitHasOverride);
  const [queryLimitState, setQueryLimitState] = useRecoilState(fromQueryState.queryLimit);
  const [queryLimitSkipState, setQueryLimitSkipState] = useRecoilState(fromQueryState.queryLimitSkip);

  // const [queryLimitPriorValue, setQueryLimitPriorValue] = useState(queryLimitState);
  const [queryLimit, setQueryLimit] = useState(queryLimitState);
  const [queryLimitSkip, setQueryLimitSkip] = useState(queryLimitSkipState);

  // If local state changes to something different, update globally
  // ignore limit change if in override mode
  useEffect(() => {
    if (queryLimitState !== queryLimit) {
      setQueryLimitState(queryLimit);
    }

    if (queryLimitSkip !== queryLimitSkipState) {
      setQueryLimitSkipState(queryLimitSkip);
    }
  }, [hasLimitOverride, queryLimit, queryLimitSkip, queryLimitSkipState, queryLimitState, setQueryLimitSkipState, setQueryLimitState]);

  useNonInitialEffect(() => {
    if (hasLimitOverride) {
      setQueryLimit('1');
    } else {
      setQueryLimit('');
    }
  }, [hasLimitOverride, setQueryLimitState]);

  // If state changes to something different, update locally
  useNonInitialEffect(() => {
    if (queryLimitState !== queryLimit) {
      setQueryLimit(queryLimit);
    }
    if (queryLimitSkipState !== queryLimitSkip) {
      setQueryLimitSkip(queryLimitState);
    }
  }, [queryLimitState, queryLimitSkipState, queryLimit, queryLimitSkip]);

  function handleQueryLimitChange(event: React.ChangeEvent<HTMLInputElement>) {
    const value = sanitize(event.target.value);
    setQueryLimit(value);
  }

  return (
    <div className="slds-grid slds-gutters_xx-small">
      <Input id="query-limit" label="Limit" className="slds-col">
        <input
          id="query-limit"
          className="slds-input"
          placeholder="Max records to return"
          value={queryLimit}
          pattern="[0-9]+"
          disabled={hasLimitOverride}
          onChange={handleQueryLimitChange}
        />
      </Input>
      <Input id="query-limit-skip" label="Skip" className="slds-col">
        <input
          id="query-limit-skip"
          className="slds-input"
          placeholder="Records to skip"
          value={queryLimitSkip}
          pattern="[0-9]+"
          onChange={(event) => setQueryLimitSkip(sanitize(event.target.value))}
        />
      </Input>
    </div>
  );
});

export default QueryLimit;
