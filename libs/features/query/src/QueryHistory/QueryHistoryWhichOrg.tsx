import { SalesforceOrgUi } from '@jetstream/types';
import { OrgLabelBadge, fromQueryHistoryState } from '@jetstream/ui-core';
import { Fragment, FunctionComponent } from 'react';

export interface QueryHistoryWhichOrgProps {
  selectedOrg: SalesforceOrgUi;
  whichOrg: fromQueryHistoryState.WhichOrgType;
  onChange: (value: fromQueryHistoryState.WhichOrgType) => void;
}

export const QueryHistoryWhichOrg: FunctionComponent<QueryHistoryWhichOrgProps> = ({ selectedOrg, whichOrg, onChange }) => {
  return (
    <Fragment>
      {whichOrg === 'ALL' && (
        <div>
          Showing from <strong>All Orgs</strong>.
          <button className="slds-button slds-text-link slds-m-left_small" onClick={() => onChange('SELECTED')}>
            Limit to selected org
          </button>
        </div>
      )}
      {whichOrg === 'SELECTED' && (
        <div>
          Showing from <OrgLabelBadge org={selectedOrg} />
          <button className="slds-button slds-text-link slds-m-left_small" onClick={() => onChange('ALL')}>
            Show from all orgs
          </button>
        </div>
      )}
    </Fragment>
  );
};

export default QueryHistoryWhichOrg;
