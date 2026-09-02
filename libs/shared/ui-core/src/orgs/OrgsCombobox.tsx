import { css, SerializedStyles } from '@emotion/react';
import { getOrgType } from '@jetstream/shared/ui-utils';
import { multiWordObjectFilter } from '@jetstream/shared/utils';
import { ListItem, ListItemGroup, Maybe, SalesforceOrgUi } from '@jetstream/types';
import { Badge, ComboboxWithGroupedItems, ComboboxWithGroupedItemsRef } from '@jetstream/ui';
import classNames from 'classnames';
import groupBy from 'lodash/groupBy';
import sortBy from 'lodash/sortBy';
import { FunctionComponent, ReactNode, Ref, useMemo } from 'react';
import { calculateOrgExpiration } from './useOrgExpiration';

/**
 * Everything a user might reasonably search the org list by. The default combobox filter only looks
 * at `label` and `value`, which hides the username as soon as an org is given a custom label.
 * `uniqueId` (`<organizationId>-<userId>`) is kept so pasting a full org id still works.
 */
const ORG_SEARCH_FIELDS: Array<keyof SalesforceOrgUi> = ['label', 'username', 'orgName', 'organizationId', 'instanceUrl', 'uniqueId'];

const orgFilterFn = (filter: string) => {
  const matchesOrg = multiWordObjectFilter<SalesforceOrgUi>(ORG_SEARCH_FIELDS, filter);
  const matchesItemLabel = multiWordObjectFilter<ListItem<string, SalesforceOrgUi>>(['label'], filter);
  // Items without an org attached (the "All Orgs" choice) can only match on their label
  return (item: ListItem<string, SalesforceOrgUi>) => (item.meta ? matchesOrg(item.meta) : matchesItemLabel(item));
};

const ALL_ORGS_ITEM_ID = '__ALL_ORGS__';

/** Rendered as a headerless group so the choice sits above the per-org groups */
const ALL_ORGS_GROUP: ListItemGroup<string, SalesforceOrgUi> = {
  id: ALL_ORGS_ITEM_ID,
  label: '',
  items: [{ id: ALL_ORGS_ITEM_ID, label: 'All Orgs', value: ALL_ORGS_ITEM_ID }],
};

function getSelectedItemLabel(item: ListItem<string, SalesforceOrgUi>) {
  const org = item.meta;
  if (!org) {
    return item.label;
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
    return item.label;
  }
  let subtext = '';
  if (org.label !== org.username) {
    subtext += ` (${org.username})`;
  }
  return `${org.orgInstanceName} - ${org.label}${subtext}`;
}

/**
 * The color is intentionally kept even when the org has a connection error - knowing which org you
 * are pointed at matters most when something is wrong. The error styling layers on top of it.
 */
function getSelectedItemStyle(org: Maybe<SalesforceOrgUi>): SerializedStyles | undefined {
  if (!org || !org.color) {
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
  return !!org.connectionError || !!org.expirationScheduledFor;
}

function getOrgTypeBadge(org: Maybe<SalesforceOrgUi>) {
  const orgType = getOrgType(org);
  if (!orgType) {
    return undefined;
  }
  return (
    <Badge type={orgType === 'Production' ? 'warning' : 'light'} title={orgType}>
      {orgType}
    </Badge>
  );
}

function groupOrgs(orgs: SalesforceOrgUi[]): ListItemGroup<string, SalesforceOrgUi>[] {
  const orgsById = groupBy(sortBy(orgs, ['label']), 'orgName');
  return Object.keys(orgsById).map((key): ListItemGroup => ({
    id: key,
    label: key,
    items: orgsById[key].map((org) => {
      const { isExpired, expiryDate } = calculateOrgExpiration(org);
      const expiryMessage: Maybe<string> = expiryDate ? `${isExpired ? 'Ended' : 'Ends'} on ${expiryDate}` : undefined;

      return {
        id: org.uniqueId,
        label: org.label || org.username,
        value: org.uniqueId,
        secondaryLabel: org.username !== org.label ? org.username : undefined,
        secondaryLabelOnNewLine: org.username !== org.label,
        tertiaryLabel: expiryMessage,
        meta: org,
      };
    }),
  }));
}

export interface OrgsComboboxProps {
  /** Lets a parent move focus into the org switcher, e.g. after the selected org (and its info popover) is removed */
  ref?: Ref<ComboboxWithGroupedItemsRef>;
  orgs: SalesforceOrgUi[];
  selectedOrg: Maybe<SalesforceOrgUi>;
  label?: string;
  hideLabel?: boolean;
  placeholder?: string;
  helpText?: ReactNode | string;
  containerClassName?: string;
  isRequired?: boolean;
  disabled?: boolean;
  minWidth?: number;
  onSelected: (org: SalesforceOrgUi) => void;
  /**
   * When provided, an "All Orgs" choice is shown above the org list and this is called when it is
   * chosen (instead of onSelected). The choice shows as selected whenever selectedOrg is empty.
   */
  onSelectedAllOrgs?: () => void;
}

export const OrgsCombobox: FunctionComponent<OrgsComboboxProps> = ({
  ref,
  orgs,
  selectedOrg,
  label = 'Orgs',
  hideLabel = true,
  placeholder = 'Select an Org',
  helpText,
  containerClassName,
  isRequired,
  disabled,
  minWidth = 300,
  onSelected,
  onSelectedAllOrgs,
}) => {
  const includeAllOrgs = !!onSelectedAllOrgs;
  const groupedOrgs = useMemo<ListItemGroup<string, SalesforceOrgUi>[]>(
    () => (includeAllOrgs ? [ALL_ORGS_GROUP, ...groupOrgs(orgs)] : groupOrgs(orgs)),
    [orgs, includeAllOrgs],
  );

  return (
    <div
      className={classNames('slds-col', containerClassName)}
      css={css`
        ${minWidth ? `min-width: ${minWidth}px;` : undefined}
      `}
      data-testid="orgs-combobox-container"
    >
      <ComboboxWithGroupedItems
        ref={ref}
        comboboxProps={{
          isRequired,
          label,
          hideLabel,
          placeholder,
          helpText,
          itemLength: 7,
          hasError: orgHasError(selectedOrg),
          disabled,
          inputCss: getSelectedItemStyle(selectedOrg),
          // Usernames often differ only by a trailing sandbox suffix, so the panel is allowed to
          // grow past the input rather than ellipsing away the part that distinguishes the orgs.
          dropdownWidth: { minWidth: '100%', maxWidth: '32rem' },
        }}
        itemProps={(item) => ({
          hasError: orgHasError(item.meta),
          textBodyCss: getDropdownOrgStyle(item.meta),
          labelSuffix: getOrgTypeBadge(item.meta),
          allowWrap: true,
        })}
        groups={groupedOrgs}
        filterFn={orgFilterFn}
        onSelected={(item) => {
          if (item.meta) {
            onSelected(item.meta);
          } else {
            onSelectedAllOrgs?.();
          }
        }}
        selectedItemId={selectedOrg?.uniqueId ?? (includeAllOrgs ? ALL_ORGS_ITEM_ID : undefined)}
        selectedItemLabelFn={getSelectedItemLabel}
        selectedItemTitleFn={getSelectedItemTitle}
      />
    </div>
  );
};
