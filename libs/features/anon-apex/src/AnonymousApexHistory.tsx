import { css } from '@emotion/react';
import { APP_ROUTES } from '@jetstream/shared/ui-router';
import { Grid } from '@jetstream/ui';
import { useAtomValue } from 'jotai';
import { FunctionComponent, useCallback } from 'react';
import { Link } from 'react-router-dom';
import * as fromApexState from './apex.state';

const PREV_APEX_KEY = '_prev_';

export interface AnonymousApexHistoryProps {
  className?: string;
  onHistorySelected: (apex: string) => void;
}

export const AnonymousApexHistory: FunctionComponent<AnonymousApexHistoryProps> = ({ className, onHistorySelected }) => {
  const historyItems = useAtomValue(fromApexState.selectApexHistoryState);

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
          to={{ pathname: APP_ROUTES.DEBUG_LOG_VIEWER.ROUTE, search: APP_ROUTES.DEBUG_LOG_VIEWER.SEARCH_PARAM }}
          title="View debugs logs - If your anonymous apex initiated a background process, such as a batch job, you can view the logs on the debug log page."
        >
          View Debug Logs
        </Link>
      </div>
    </Grid>
  );
};

export default AnonymousApexHistory;
