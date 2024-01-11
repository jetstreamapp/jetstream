import { css, SerializedStyles } from '@emotion/react';
import { ListItem, ListItemGroup, Maybe, SalesforceOrgUi } from '@jetstream/types';
import { ComboboxWithGroupedItems } from '@jetstream/ui';
import { FunctionComponent } from 'react';

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

export interface OrgsComboboxProps {
  groupedOrgs: ListItemGroup<string, any>[];
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
  groupedOrgs,
  selectedOrg,
  label = 'Orgs',
  hideLabel = true,
  placeholder = 'Select an Org',
  isRequired,
  disabled,
  minWidth = 300,
  onSelected,
}) => {
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

export default OrgsCombobox;
