/** @jsx jsx */
import { css, jsx } from '@emotion/core';
import { MapOf, SalesforceOrgUi } from '@jetstream/types';
import { Combobox, ComboboxListItem, ComboboxListItemGroup } from '@jetstream/ui';
import groupBy from 'lodash/groupBy';
import orderBy from 'lodash/orderBy';
import uniqBy from 'lodash/uniqBy';
import { Fragment, FunctionComponent, useEffect, useState } from 'react';
import { useRecoilState, useRecoilValue } from 'recoil';
import { salesforceOrgsState, selectedOrgIdState, selectedOrgState } from '../../app-state';
import AddOrg from './AddOrg';
import OrgInfoPopover from './OrgInfoPopover';
import OrgPersistence from './OrgPersistence';
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface OrgsDropdownProps {}

function getSelectedItemLabel(org?: SalesforceOrgUi) {
  if (!org) {
    return;
  }
  return `${org.username}`;
}

function getSelectedItemTitle(org?: SalesforceOrgUi) {
  if (!org) {
    return;
  }
  return `${org.orgInstanceName} - ${org.username}`;
}

function orgHasError(org?: SalesforceOrgUi): boolean {
  if (!org) {
    return;
  }
  return !!org.connectionError;
}

export const OrgsDropdown: FunctionComponent<OrgsDropdownProps> = () => {
  // FIXME: Cannot update a component (`Batcher`) while rendering a different component (`OrgsDropdown`)
  // Recoil needs to fix this
  const [orgs, setOrgs] = useRecoilState<SalesforceOrgUi[]>(salesforceOrgsState);
  const [selectedOrgId, setSelectedOrgId] = useRecoilState<string>(selectedOrgIdState);
  const selectedOrg = useRecoilValue<SalesforceOrgUi>(selectedOrgState);
  const [visibleOrgs, setVisibleOrgs] = useState<SalesforceOrgUi[]>([]);
  const [orgsByOrganization, setOrgsByOrganization] = useState<MapOf<SalesforceOrgUi[]>>({});
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

  /**
   *
   * @param org Org to add
   * @param replaceOrgUniqueId Id of org that should be removed from list. Only applicable to fixing org where Id ends up being different
   */
  function handleAddOrg(org: SalesforceOrgUi, replaceOrgUniqueId?: string) {
    const sortedOrgs = uniqBy(
      orderBy([...orgs.filter((org) => (replaceOrgUniqueId ? org.uniqueId !== replaceOrgUniqueId : true)), org], 'username'),
      'uniqueId'
    );
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
            itemLength={7}
            hasError={orgHasError(selectedOrg)}
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
                    hasError={orgHasError(org)}
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
            <OrgInfoPopover org={selectedOrg} onAddOrg={handleAddOrg} />
          </div>
        )}
        <div className="slds-col">
          <AddOrg onAddOrg={handleAddOrg} />
        </div>
      </div>
    </Fragment>
  );
};

export default OrgsDropdown;
