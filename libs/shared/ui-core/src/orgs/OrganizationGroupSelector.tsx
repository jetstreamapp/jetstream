import { css } from '@emotion/react';
import { APP_ROUTES } from '@jetstream/shared/ui-router';
import { formatNumber } from '@jetstream/shared/ui-utils';
import { pluralizeFromNumber } from '@jetstream/shared/utils';
import { Maybe, OrgGroup } from '@jetstream/types';
import { Badge, Grid, List, Popover, PopoverRef } from '@jetstream/ui';
import { ReactNode, useRef } from 'react';
import { Link } from 'react-router';

/**
 * The selector stacks above the org switcher inside the 3.125rem global header. A normal line box
 * (1.5 × the header font) made the stack overflow the header, and the navbar painted over the bottom
 * of the switcher's focus ring; a single line height keeps the whole stack, ring included, inside.
 */
const compactLineHeightCss = css`
  line-height: 1.2;
`;

const NO_GROUP_KEY = 'no-group';

interface OrganizationGroupSelectorProps {
  groups: OrgGroup[];
  selectedGroup?: Maybe<OrgGroup>;
  salesforceOrgsWithoutGroup: number;
  size?: 'small' | 'medium';
  onSelection: (group?: Maybe<OrgGroup>) => void;
}

interface OrganizationPopoverProps {
  selectedGroup?: Maybe<OrgGroup>;
  groups: OrgGroup[];
  salesforceOrgsWithoutGroup: number;
  children: ReactNode;
  onSelection: (group?: Maybe<OrgGroup>) => void;
}

/** A row in the group list: a group, or the "no group" choice that clears the selection */
interface GroupChoice {
  key: string;
  name: string;
  orgCount: number;
  group: Maybe<OrgGroup>;
}

export function OrganizationGroupSelector({
  groups,
  selectedGroup,
  salesforceOrgsWithoutGroup,
  size,
  onSelection,
}: OrganizationGroupSelectorProps) {
  // One tree for both states: the popover (and so its trigger) must survive a selection, because the
  // popover hands focus back to the trigger when it closes. Rendering a separate tree per state
  // remounted the trigger on every change and dropped keyboard focus to <body>.
  return (
    <Grid className="slds-align_absolute-center" verticalAlign="center" css={compactLineHeightCss}>
      {selectedGroup && (
        <p
          css={css`
            font-size: ${size === 'small' ? '10px;' : '14px'}
            margin-bottom: -2px;
          `}
        >
          {selectedGroup.name}
        </p>
      )}
      <OrganizationGroupPopover
        selectedGroup={selectedGroup}
        groups={groups}
        salesforceOrgsWithoutGroup={salesforceOrgsWithoutGroup}
        onSelection={onSelection}
      >
        {selectedGroup ? 'Switch' : 'Choose Group'}
      </OrganizationGroupPopover>
    </Grid>
  );
}

const OrganizationGroupPopover = ({
  selectedGroup,
  groups,
  salesforceOrgsWithoutGroup,
  children,
  onSelection,
}: OrganizationPopoverProps) => {
  const popoverRef = useRef<PopoverRef>(null);

  const choices: GroupChoice[] = [
    ...groups
      .filter((group) => !selectedGroup || group.id !== selectedGroup.id)
      .map((group) => ({ key: String(group.id), name: group.name, orgCount: group.orgs.length, group })),
    ...(selectedGroup ? [{ key: NO_GROUP_KEY, name: '-No Group-', orgCount: salesforceOrgsWithoutGroup, group: null }] : []),
  ];

  function handleSelection(key: string) {
    const choice = choices.find((candidate) => candidate.key === key);
    onSelection(choice?.group ?? null);
    // Closing returns focus to the trigger (FloatingFocusManager returnFocus)
    popoverRef.current?.close();
  }

  return (
    <Popover
      ref={popoverRef}
      header={
        <header className="slds-popover__header">
          <h2 className="slds-text-heading_small">Select Group</h2>
        </header>
      }
      footer={
        <footer className="slds-popover__footer">
          <Link
            to={{ pathname: APP_ROUTES.SALESFORCE_ORG_GROUPS.ROUTE, search: APP_ROUTES.SALESFORCE_ORG_GROUPS.SEARCH_PARAM }}
            onClick={() => popoverRef.current?.close()}
          >
            Manage Groups
          </Link>
        </footer>
      }
      content={
        <div
          css={css`
            max-height: 50vh;
          `}
        >
          <p>When you choose a group, only Salesforce Orgs within that group will be available for selection.</p>
          {/* One tab stop: ArrowUp/Down move between groups, Enter/Space choose (shared roving List) */}
          <List
            ariaLabel="Org groups"
            className="slds-dropdown_length-5 cursor-pointer"
            items={choices}
            isActive={() => false}
            getContent={(choice: GroupChoice) => ({
              key: choice.key,
              heading: choice.name,
              trailingHeader: (
                <Badge type="light" className="slds-m-left_xx-small">
                  {formatNumber(choice.orgCount)} {pluralizeFromNumber('Org', choice.orgCount)}
                </Badge>
              ),
            })}
            onSelected={handleSelection}
          />
        </div>
      }
      buttonProps={{
        className: 'slds-button slds-m-left_xx-small',
        // "Switch" alone is ambiguous out of context; the visible text stays part of the name (2.5.3)
        'aria-label': selectedGroup ? 'Switch group' : undefined,
      }}
      buttonStyle={{
        fontSize: '10px',
        lineHeight: 'unset',
      }}
    >
      {children}
    </Popover>
  );
};
