import { css, SerializedStyles } from '@emotion/react';
import { ListItem, ListItemGroup, Maybe, SalesforceOrgUi } from '@jetstream/types';
import { ComboboxWithGroupedItems } from '@jetstream/ui';
import groupBy from 'lodash/groupBy';
import sortBy from 'lodash/sortBy';
import { FunctionComponent, useEffect, useState } from 'react';

function getSelectedItemLabel(item: ListItem<string, SalesforceOrgUi>) {
  const org = item.meta;
  if (!org) {
    return '';
  }
  let subtext = '';
  if (org.label !== org.username) {
    subtext += ` (${org.username})`;
  }
  return `${org.label}${subtext}`;
}

function getSelectedItemTitle(item: ListItem<string, SalesforceOrgUi>) {
  const org = item.meta;
  if (!org) {
    return '';
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

function groupOrgs(orgs: SalesforceOrgUi[]): ListItemGroup<string, SalesforceOrgUi>[] {
  const orgsById = groupBy(sortBy(orgs, ['label']), 'orgName');
  return Object.keys(orgsById).map(
    (key): ListItemGroup => ({
      id: key,
      label: key,
      items: orgsById[key].map((org) => ({
        id: org.uniqueId,
        label: org.label || org.username,
        value: org.uniqueId,
        secondaryLabel: org.username !== org.label ? org.username : undefined,
        secondaryLabelOnNewLine: org.username !== org.label,
        meta: org,
      })),
    })
  );
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
  const [groupedOrgs, setGroupedOrgs] = useState<ListItemGroup<string, SalesforceOrgUi>[]>(() => groupOrgs(orgs));

  useEffect(() => {
    setGroupedOrgs(groupOrgs(orgs));
  }, [orgs]);

  return (
    <div
      className="slds-col"
      css={css`
        ${minWidth ? `min-width: ${minWidth}px;` : undefined}
      `}
      data-testid="orgs-combobox-container"
    >
      <ComboboxWithGroupedItems
        comboboxProps={{
          isRequired: isRequired,
          label: label,
          hideLabel: hideLabel,
          placeholder: placeholder,
          itemLength: 7,
          hasError: orgHasError(selectedOrg),
          disabled: disabled,
          // onInputChange: (filter) => setFilterText(filter),
          // selectedItemLabel: getSelectedItemLabel(selectedOrg),
          // selectedItemTitle: getSelectedItemTitle(selectedOrg),
          inputCss: getSelectedItemStyle(selectedOrg),
        }}
        itemProps={(item) => ({
          hasError: orgHasError(item.meta),
          textBodyCss: getDropdownOrgStyle(item.meta),
        })}
        groups={groupedOrgs}
        onSelected={(item) => onSelected(item.meta)}
        selectedItemId={selectedOrg?.uniqueId}
        selectedItemLabelFn={getSelectedItemLabel}
        selectedItemTitleFn={getSelectedItemTitle}
      />
    </div>
  );
};
