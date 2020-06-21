/* eslint-disable @typescript-eslint/no-unused-vars */
import { Input } from '@jetstream/ui';
import React, { FunctionComponent, useState, useEffect } from 'react';
import { useRecoilState } from 'recoil';
import * as fromQueryState from '../query.state';
import { REGEX } from '@jetstream/shared/utils';
import { logger } from '@jetstream/shared/client-logger';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface QueryLimitProps {}

function sanitize(value: string) {
  return value.replace(REGEX.NOT_UNSIGNED_NUMERIC, '');
}

export const QueryLimit: FunctionComponent<QueryLimitProps> = React.memo(() => {
  const [queryLimitState, setQueryLimitState] = useRecoilState(fromQueryState.queryLimit);
  const [queryLimitSkipState, setQueryLimitSkipState] = useRecoilState(fromQueryState.queryLimitSkip);

  const [queryLimit, setQueryLimit] = useState(queryLimitState);
  const [queryLimitSkip, setQueryLimitSkip] = useState(queryLimitSkipState);

  useEffect(() => {
    setTimeout(() => {
      setQueryLimitState(queryLimit);
      setQueryLimitSkipState(queryLimitSkip);
    });
  }, [queryLimit, queryLimitSkip, setQueryLimitState, setQueryLimitSkipState]);

  return (
    <div className="slds-grid slds-gutters_xx-small">
      <Input id="query-limit" label="Limit" className="slds-col">
        <input
          id="query-limit"
          className="slds-input"
          placeholder="Max records to return"
          value={queryLimit}
          pattern="[0-9]+"
          onChange={(event) => setQueryLimit(sanitize(event.target.value))}
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
