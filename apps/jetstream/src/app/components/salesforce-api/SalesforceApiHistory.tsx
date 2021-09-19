import { css } from '@emotion/react';
import { SalesforceApiHistoryRequest } from '@jetstream/types';
import { FunctionComponent, useCallback, useEffect, useState } from 'react';
import { useRecoilValue } from 'recoil';
import * as fromSalesforceApiState from './salesforceApi.state';

const _NO_SELECTION = '_prev_';

export interface SalesforceApiHistoryProps {
  className?: string;
  disabled?: boolean;
  onHistorySelected: (request: SalesforceApiHistoryRequest) => void;
}

export const SalesforceApiHistory: FunctionComponent<SalesforceApiHistoryProps> = ({ className, disabled, onHistorySelected }) => {
  const historyItems = useRecoilValue(fromSalesforceApiState.selectSalesforceApiHistoryState);
  const [value, setValue] = useState(_NO_SELECTION);
  // TODO: allow showing across all orgs
  // const [whichOrg, setWhichOrg] = useRecoilState(fromSalesforceApiState.salesforceApiHistoryWhichOrg);

  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      setValue(event.target.value);
      const foundItem = historyItems.find((item) => item.key === event.target.value);
      if (foundItem) {
        onHistorySelected(foundItem.request);
      }
    },
    [historyItems, onHistorySelected]
  );

  useEffect(() => {
    setValue(_NO_SELECTION);
  }, [historyItems]);

  return (
    <div className={className}>
      {historyItems.length > 0 && (
        <select
          css={css`
            max-width: 200px;
            min-width: 200px;
          `}
          className="slds-select"
          id="apex-history"
          value={value}
          onChange={handleChange}
          disabled={disabled}
        >
          <option value={_NO_SELECTION}>-- History --</option>
          {historyItems.map(({ key, label, response, lastRun, request }) => (
            <option key={key} value={key} title={`${lastRun.toLocaleString()} [${request.method}] ${request.url}`}>
              {response ? `(${response.status} ${response.statusText}) ` : ''} {label}
            </option>
          ))}
        </select>
      )}
    </div>
  );
};

export default SalesforceApiHistory;
