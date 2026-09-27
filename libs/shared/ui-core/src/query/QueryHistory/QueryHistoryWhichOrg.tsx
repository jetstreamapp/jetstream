import { SalesforceOrgUi } from '@jetstream/types';
import { AssistiveStatus } from '@jetstream/ui';
import { FunctionComponent } from 'react';
import { OrgLabelBadge, fromQueryHistoryState } from '../..';

export interface QueryHistoryWhichOrgProps {
  selectedOrg: SalesforceOrgUi;
  whichOrg: fromQueryHistoryState.WhichOrgType;
  onChange: (value: fromQueryHistoryState.WhichOrgType) => void;
}

export const QueryHistoryWhichOrg: FunctionComponent<QueryHistoryWhichOrgProps> = ({ selectedOrg, whichOrg, onChange }) => {
  const showingAll = whichOrg === 'ALL';
  return (
    <div>
      {/* One stable button element for both states: swapping between two conditional buttons
          unmounted the control mid-click and dropped keyboard focus to <body> */}
      Showing from {showingAll ? <strong>All Orgs</strong> : <OrgLabelBadge org={selectedOrg} />}
      <button className="slds-button slds-text-link slds-m-left_small" onClick={() => onChange(showingAll ? 'SELECTED' : 'ALL')}>
        {showingAll ? 'Limit to selected org' : 'Show from all orgs'}
      </button>
      <AssistiveStatus message={showingAll ? 'Showing history from all orgs' : `Showing history from ${selectedOrg.label}`} />
    </div>
  );
};

export default QueryHistoryWhichOrg;
