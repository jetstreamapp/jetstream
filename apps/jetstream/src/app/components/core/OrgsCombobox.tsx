import { css, SerializedStyles } from '@emotion/react';
import { multiWordObjectFilter } from '@jetstream/shared/utils';
import { MapOf, Maybe, SalesforceOrgUi } from '@jetstream/types';
import { Combobox, ComboboxListItem, ComboboxListItemGroup } from '@jetstream/ui';
import sortBy from 'lodash/sortBy';
import groupBy from 'lodash/groupBy';
import { FunctionComponent, useEffect, useState } from 'react';

function getSelectedItemLabel(org: Maybe<SalesforceOrgUi>) {
  if (!org) {
    return;
  }
  let subtext = '';
  if (org.label !== org.username) {
    subtext += ` (${org.username})`;
  }
  return `${org.label}${subtext}`;
}

function getSelectedItemTitle(org: Maybe<SalesforceOrgUi>) {
  if (!org) {
    return;
  }
  let subtext = '';
  if (org.label !== org.username) {
    subtext += ` (${org.username})`;
  }
  return `${org.orgInstanceName} - ${org.label}${subtext}`;
}

function getSelectedItemStyle(org: Maybe<SalesforceOrgUi>): SerializedStyles | undefined {
  if (!org || !org.color || !!org.connectionError) {
    return;
  }
  return css({
    borderColor: org.color,
    boxShadow: `inset 0 0 0 1px ${org.color}`,
    backgroundClip: 'padding-box',
  });
}

function getDropdownOrgStyle(org: Maybe<SalesforceOrgUi>): SerializedStyles | undefined {
  if (!org || !org.color) {
    return css({
      borderBottom: `solid 0.3rem transparent`,
    });
  }
  return css({
    borderBottom: `solid 0.3rem ${org.color}`,
  });
}

function orgHasError(org: Maybe<SalesforceOrgUi>): boolean {
  if (!org) {
    return false;
  }
  return !!org.connectionError;
}

export interface OrgsComboboxProps {
  orgs: SalesforceOrgUi[];
  selectedOrg: Maybe<SalesforceOrgUi>;
  label?: string;
  hideLabel?: boolean;
  placeholder?: string;
  isRequired?: boolean;
  disabled?: boolean;
  minWidth?: number;
  onSelected: (org: SalesforceOrgUi) => void;
}

export const OrgsCombobox: FunctionComponent<OrgsComboboxProps> = ({
  orgs,
  selectedOrg,
  label = 'Orgs',
  hideLabel = true,
  placeholder = 'Select an Org',
  isRequired,
  disabled,
  minWidth = 300,
  onSelected,
}) => {
  const [visibleOrgs, setVisibleOrgs] = useState<SalesforceOrgUi[]>([]);
  const [orgsByOrganization, setOrgsByOrganization] = useState<MapOf<SalesforceOrgUi[]>>({});
  const [filterText, setFilterText] = useState<string>('');

  useEffect(() => {
    if (Array.isArray(visibleOrgs)) {
      setOrgsByOrganization(groupBy(sortBy(visibleOrgs, ['label']), 'orgName'));
    }
  }, [visibleOrgs]);

  useEffect(() => {
    if (!filterText) {
      setVisibleOrgs(orgs);
    } else {
      setVisibleOrgs(orgs.filter(multiWordObjectFilter(['username', 'label'], filterText)));
    }
  }, [orgs, filterText]);

  return (
    <div
      className="slds-col"
      css={css`
        ${minWidth ? `min-width: ${minWidth}px;` : undefined}
      `}
      data-testid="orgs-combobox-container"
    >
      <Combobox
        isRequired={isRequired}
        label={label}
        hideLabel={hideLabel}
        placeholder={placeholder}
        itemLength={7}
        hasError={orgHasError(selectedOrg)}
        disabled={disabled}
        onInputChange={(filter) => setFilterText(filter)}
        selectedItemLabel={getSelectedItemLabel(selectedOrg)}
        selectedItemTitle={getSelectedItemTitle(selectedOrg)}
        inputCss={getSelectedItemStyle(selectedOrg)}
      >
        {Object.keys(orgsByOrganization).map((groupKey) => (
          <ComboboxListItemGroup key={groupKey} label={groupKey}>
            {orgsByOrganization[groupKey].map((org) => (
              <ComboboxListItem
                key={org.uniqueId}
                id={org.uniqueId}
                label={org.label || org.username}
                secondaryLabel={org.username !== org.label ? org.username : undefined}
                secondaryLabelOnNewLine={org.username !== org.label}
                hasError={orgHasError(org)}
                selected={!!selectedOrg && selectedOrg.uniqueId === org.uniqueId}
                textBodyCss={getDropdownOrgStyle(org)}
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
