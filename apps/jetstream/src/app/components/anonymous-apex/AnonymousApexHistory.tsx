import { css } from '@emotion/react';
import { Grid } from '@jetstream/ui';
import { FunctionComponent, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useRecoilState, useRecoilValue } from 'recoil';
import * as fromApexState from './apex.state';

const PREV_APEX_KEY = '_prev_';

export interface AnonymousApexHistoryProps {
  className?: string;
  onHistorySelected: (apex: string) => void;
}

export const AnonymousApexHistory: FunctionComponent<AnonymousApexHistoryProps> = ({ className, onHistorySelected }) => {
  const historyItems = useRecoilValue(fromApexState.selectApexHistoryState);

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
    <Grid className={className} verticalAlign="center">
      {historyItems.length > 0 && (
        <div className="slds-m-right_x-small">
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
        </div>
      )}
      <div
        css={css`
          min-width: 120px;
        `}
      >
        <Link
          to="/debug-logs"
          title="View debugs logs - If your anonymous apex initiated a background process, such as a batch job, you can view the logs on the debug log page."
        >
          View Debug Logs
        </Link>
      </div>
    </Grid>
  );
};

export default AnonymousApexHistory;
