/** @jsx jsx */
import { css, jsx } from '@emotion/core';
import { MapOf, SalesforceOrg } from '@jetstream/types';
import { Combobox, ComboboxListItem, ComboboxListItemGroup, Icon, Tooltip } from '@jetstream/ui';
import groupBy from 'lodash/groupBy';
import orderBy from 'lodash/orderBy';
import uniqBy from 'lodash/uniqBy';
import { FunctionComponent, useEffect, useState, Fragment } from 'react';
import AddOrg from './AddOrg';
import { useRecoilState, useRecoilValue } from 'recoil';
import { salesforceOrgsState, selectedOrgIdState, selectedOrgState } from '../../app-state';
import OrgPersistence from './OrgPersistence';
import OrgInfoPopover from './OrgInfoPopover';
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface OrgsDropdownProps {}

function getSelectedItemLabel(org?: SalesforceOrg) {
  if (!org) {
    return;
  }
  return `${org.username}`;
}

function getSelectedItemTitle(org?: SalesforceOrg) {
  if (!org) {
    return;
  }
  return `${org.orgInstanceName} - ${org.username}`;
}

export const OrgsDropdown: FunctionComponent<OrgsDropdownProps> = () => {
  const [orgs, setOrgs] = useRecoilState<SalesforceOrg[]>(salesforceOrgsState);
  const [selectedOrgId, setSelectedOrgId] = useRecoilState<string>(selectedOrgIdState);
  const selectedOrg = useRecoilValue<SalesforceOrg>(selectedOrgState);
  const [visibleOrgs, setVisibleOrgs] = useState<SalesforceOrg[]>([]);
  const [orgsByOrganization, setOrgsByOrganization] = useState<MapOf<SalesforceOrg[]>>({});
  const [filterText, setFilterText] = useState<string>('');

  useEffect(() => {
    if (Array.isArray(visibleOrgs)) {
      setOrgsByOrganization(groupBy(visibleOrgs, 'orgName'));
    }
  }, [visibleOrgs]);

  useEffect(() => {
    if (!filterText) {
      setVisibleOrgs(orgs);
    } else {
      setVisibleOrgs(orgs.filter((org) => org.filterText.includes(filterText)));
    }
  }, [orgs, filterText]);

  function addOrg(org: SalesforceOrg) {
    const sortedOrgs = uniqBy(orderBy([...orgs, org], 'username'), 'uniqueId');
    setOrgs(sortedOrgs);
    setSelectedOrgId(org.uniqueId);
  }

  return (
    <Fragment>
      <OrgPersistence />
      <div className="slds-grid slds-grid-no-wrap">
        <div
          className="slds-col"
          css={css`
            min-width: 300px;
          `}
        >
          <Combobox
            label="Orgs"
            hideLabel={true}
            placeholder="Select an Org"
            onInputChange={(filter) => setFilterText(filter)}
            selectedItemLabel={getSelectedItemLabel(selectedOrg)}
            selectedItemTitle={getSelectedItemTitle(selectedOrg)}
          >
            {Object.keys(orgsByOrganization).map((groupKey) => (
              <ComboboxListItemGroup key={groupKey} label={groupKey}>
                {orgsByOrganization[groupKey].map((org) => (
                  <ComboboxListItem
                    key={org.uniqueId}
                    id={org.uniqueId}
                    label={org.username}
                    selected={selectedOrg && selectedOrg.uniqueId === org.uniqueId}
                    onSelection={(id) => setSelectedOrgId(org.uniqueId)}
                  />
                ))}
              </ComboboxListItemGroup>
            ))}
          </Combobox>
        </div>
        {selectedOrg && (
          <div className="slds-col slds-m-left--xx-small slds-p-top--xx-small">
            <OrgInfoPopover org={selectedOrg} />
          </div>
        )}
        <div className="slds-col">
          <AddOrg onAddOrg={addOrg} />
        </div>
      </div>
    </Fragment>
  );
};

export default OrgsDropdown;
