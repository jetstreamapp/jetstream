/** @jsx jsx */
import { css, jsx } from '@emotion/react';
import { MapOf, SalesforceOrgUi } from '@jetstream/types';
import { Combobox, ComboboxListItem, ComboboxListItemGroup } from '@jetstream/ui';
import groupBy from 'lodash/groupBy';
import { FunctionComponent, useEffect, useState } from 'react';

function getSelectedItemLabel(org?: SalesforceOrgUi) {
  if (!org) {
    return;
  }
  let subtext = '';
  if (org.label !== org.username) {
    subtext += ` (${org.username})`;
  }
  return `${org.label}${subtext}`;
}

function getSelectedItemTitle(org?: SalesforceOrgUi) {
  if (!org) {
    return;
  }
  let subtext = '';
  if (org.label !== org.username) {
    subtext += ` (${org.username})`;
  }
  return `${org.orgInstanceName} - ${org.label}${subtext}`;
}

function orgHasError(org?: SalesforceOrgUi): boolean {
  if (!org) {
    return;
  }
  return !!org.connectionError;
}

export interface OrgsComboboxProps {
  orgs: SalesforceOrgUi[];
  selectedOrg: SalesforceOrgUi;
  label?: string;
  hideLabel?: boolean;
  placeholder?: string;
  isRequired?: boolean;
  onSelected: (org: SalesforceOrgUi) => void;
}

export const OrgsCombobox: FunctionComponent<OrgsComboboxProps> = ({
  orgs,
  selectedOrg,
  label = 'Orgs',
  hideLabel = true,
  placeholder = 'Select an Org',
  isRequired,
  onSelected,
}) => {
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

  return (
    <div
      className="slds-col"
      css={css`
        min-width: 300px;
      `}
    >
      <Combobox
        isRequired={isRequired}
        label={label}
        hideLabel={hideLabel}
        placeholder={placeholder}
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
                label={org.label || org.username}
                secondaryLabel={org.username !== org.label ? org.username : undefined}
                hasError={orgHasError(org)}
                selected={selectedOrg && selectedOrg.uniqueId === org.uniqueId}
                onSelection={(id) => onSelected(org)}
              />
            ))}
          </ComboboxListItemGroup>
        ))}
      </Combobox>
    </div>
  );
};

export default OrgsCombobox;
