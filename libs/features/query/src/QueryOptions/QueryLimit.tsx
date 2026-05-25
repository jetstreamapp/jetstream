import { useNonInitialEffect } from '@jetstream/shared/ui-utils';
import { REGEX } from '@jetstream/shared/utils';
import { Input } from '@jetstream/ui';
import React, { FunctionComponent } from 'react';

export interface QueryLimitProps {
  limit: string;
  setLimit: (value: string) => void;
  /** Omit to hide the Skip (OFFSET) input — e.g. for subqueries. */
  limitSkip?: string;
  setLimitSkip?: (value: string) => void;
  /** When true, the limit input is forced to "1" and disabled (tooling override). */
  hasLimitOverride?: boolean;
  /** Controls the id attribute of the inputs so multiple instances can coexist. */
  idPrefix?: string;
}

function sanitize(value: string) {
  return value.replace(REGEX.NOT_UNSIGNED_NUMERIC, '');
}

export const QueryLimit: FunctionComponent<QueryLimitProps> = React.memo(
  ({ limit, setLimit, limitSkip, setLimitSkip, hasLimitOverride, idPrefix = 'query-limit' }) => {
    useNonInitialEffect(() => {
      if (hasLimitOverride) {
        setLimit('1');
      } else {
        setLimit('');
      }
      // Only react to override toggles — intentionally omit setLimit to avoid re-firing on every render
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hasLimitOverride]);

    function handleQueryLimitChange(event: React.ChangeEvent<HTMLInputElement>) {
      setLimit(sanitize(event.target.value));
    }

    const limitInputId = `${idPrefix}`;
    const skipInputId = `${idPrefix}-skip`;
    const showSkip = typeof limitSkip === 'string' && typeof setLimitSkip === 'function';

    return (
      <div className="slds-grid slds-gutters_xx-small">
        <Input id={limitInputId} label="Limit" className="slds-col">
          <input
            id={limitInputId}
            className="slds-input"
            placeholder="Max records to return"
            value={limit}
            pattern="[0-9]+"
            disabled={hasLimitOverride}
            onChange={handleQueryLimitChange}
          />
        </Input>
        {showSkip && (
          <Input id={skipInputId} label="Skip" className="slds-col">
            <input
              id={skipInputId}
              className="slds-input"
              placeholder="Records to skip"
              value={limitSkip}
              pattern="[0-9]+"
              onChange={(event) => setLimitSkip?.(sanitize(event.target.value))}
            />
          </Input>
        )}
      </div>
    );
  },
);

export default QueryLimit;
