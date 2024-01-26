import { SalesforceOrgUi } from '@jetstream/types';
import { OrgLabelBadge } from '@jetstream/ui';
import { Fragment, FunctionComponent } from 'react';
import { WhichOrgType } from './query-history.state';

export interface QueryHistoryWhichOrgProps {
  selectedOrg: SalesforceOrgUi;
  whichOrg: WhichOrgType;
  onChange: (value: WhichOrgType) => void;
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
