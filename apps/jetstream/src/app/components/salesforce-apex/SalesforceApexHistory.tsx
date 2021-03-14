/** @jsx jsx */
import { jsx } from '@emotion/react';
import { FunctionComponent, useCallback } from 'react';
import { useRecoilState, useRecoilValue } from 'recoil';
import * as fromApexState from './apex.state';

const PREV_APEX_KEY = '_prev_';

export interface SalesforceApexHistoryProps {
  className?: string;
  onHistorySelected: (apex: string) => void;
}

export const SalesforceApexHistory: FunctionComponent<SalesforceApexHistoryProps> = ({ className, onHistorySelected }) => {
  const historyItems = useRecoilValue(fromApexState.selectApexHistoryState);
  // TODO: allow showing across all orgs
  // const [whichOrg, setWhichOrg] = useRecoilState(fromApexState.apexHistoryWhichOrg);

  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      const foundItem = historyItems.find((item) => item.key === event.target.value);
      if (foundItem) {
        onHistorySelected(foundItem.apex);
      }
    },
    [historyItems, onHistorySelected]
  );

  return (
    <div className={className}>
      {historyItems.length > 0 && (
        <select
          className="slds-select"
          id="apex-history"
          // value={`${year}`}
          onChange={handleChange}
        >
          <option value={PREV_APEX_KEY}>-- History --</option>
          {historyItems.map(({ key, label, apex }) => (
            <option key={key} value={key} title={apex}>
              {label}
            </option>
          ))}
        </select>
      )}
    </div>
  );
};

export default SalesforceApexHistory;
