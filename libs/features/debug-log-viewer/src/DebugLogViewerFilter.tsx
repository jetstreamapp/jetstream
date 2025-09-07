import { Checkbox, SearchInput } from '@jetstream/ui';
import { forwardRef } from 'react';

export interface DebugLogViewerFilterProps {
  textFilter: string;
  userDebug: boolean;
  hasResults: boolean;
  onTextChange: (value: string) => void;
  onDebugChange: (value: boolean) => void;
}

export const DebugLogViewerFilter = forwardRef<any, DebugLogViewerFilterProps>(
  ({ textFilter, userDebug, hasResults, onTextChange, onDebugChange }, ref) => {
    return (
      <div ref={ref} className="slds-grid slds-grid_vertical-align-center slds-m-bottom_x-small">
        <div className="slds-grow slds-m-right_small">
          <SearchInput id="log-filter" value={textFilter} placeholder="Filter logs" disabled={!hasResults} onChange={onTextChange} />
        </div>
        <Checkbox
          id={`anon-apex-user-debug`}
          label="Limit to User Debug"
          checked={userDebug}
          disabled={!hasResults}
          onChange={onDebugChange}
        />
      </div>
    );
  },
);

export default DebugLogViewerFilter;
