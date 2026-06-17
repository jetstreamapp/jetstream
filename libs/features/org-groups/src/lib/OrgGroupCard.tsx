import { useDroppable } from '@dnd-kit/react';
import { css } from '@emotion/react';
import { formatNumber } from '@jetstream/shared/ui-utils';
import { AddOrgHandlerFn, DropDownItem, OrgGroupWithOrgs } from '@jetstream/types';
import { ButtonGroupContainer, Card, DropDown, Grid, Icon } from '@jetstream/ui';
import classNames from 'classnames';
import { useMemo } from 'react';
import { SalesforceOrgCardDraggable } from './SalesforceOrgCardDraggable';
import { DraggableSfdcCard, SfdcCardDropTarget } from './organization-group.types';

interface OrgGroupCardCardProps {
  isActive: boolean;
  group: OrgGroupWithOrgs;
  activeSalesforceOrgId?: string;
  onSelected: () => void;
  onEditOrg: () => void;
  onDeleteOrg: () => void;
  onDeleteOrgWithOrgs: () => void;
  /**
   * If provided, this will be used instead of the default addOrg function.
   * This is used in the desktop app to open the browser for the login process.
   */
  onAddOrgHandlerFn?: AddOrgHandlerFn;
}

export function OrgGroupCardCard({
  isActive,
  group,
  activeSalesforceOrgId,
  onSelected,
  onEditOrg,
  onDeleteOrg,
  onDeleteOrgWithOrgs,
  onAddOrgHandlerFn,
}: OrgGroupCardCardProps) {
  const { id, name, description, orgs } = group;
  const orgCount = group.orgs.length;
  // Only accept org cards that aren't already in this group.
  const { ref: dropRef, isDropTarget } = useDroppable({
    id,
    accept: (source) => (source.data as DraggableSfdcCard).organizationId !== id,
    data: { action: 'add', orgGroupId: id } satisfies SfdcCardDropTarget,
  });

  const tertiaryActionMenuItems = useMemo(() => {
    const items: DropDownItem[] = [];
    if (orgCount > 0) {
      items.push(
        { id: 'delete', value: 'Delete Group (Keep Orgs)', icon: { type: 'utility', icon: 'delete', description: 'Delete' } },
        {
          id: 'delete-all',
          value: 'Delete Group and Orgs',
          icon: { type: 'utility', icon: 'delete', description: 'Delete' },
        },
      );
    } else {
      items.push({ id: 'delete', value: 'Delete Group', icon: { type: 'utility', icon: 'delete', description: 'Delete' } });
    }
    return items;
  }, [orgCount]);

  function handleActions(action: 'delete' | 'delete-all') {
    switch (action) {
      case 'delete':
        onDeleteOrg();
        break;
      case 'delete-all':
        onDeleteOrgWithOrgs();
        break;
    }
  }

  return (
    <div
      css={css`
        position: relative;
      `}
    >
      <Card
        ref={dropRef}
        testId={`org-group-card-${group.name}`}
        css={css`
          &.slds-drop-zone::after {
            border-radius: var(--slds-c-card-radius-border, var(--slds-g-radius-border-2, 0.5rem));
          }
          ${isActive
            ? `
            border: 1px solid var(--slds-g-color-brand-base-60, #1b96ff) !important;
            -webkit-box-shadow: 0 0 0 1px var(--slds-g-color-brand-base-60, #1b96ff) inset !important;
            ::after {
            content: '';
            position: absolute;
            top: 0;
            right: 0;
            border-radius: 0 var(--slds-c-card-radius-border, var(--slds-g-radius-border-2, 0.5rem)) 0 0;
            border-left: 1rem solid transparent;
            border-bottom: 1rem solid transparent;
            border-right: 1rem solid transparent;
            border-right-color: var(--slds-g-color-brand-base-60, #1b96ff);
            border-top: 1rem solid transparent;
            border-top-color: var(--slds-g-color-brand-base-60, #1b96ff);
          }`
            : ''}
        `}
        nestedBorder
        className={classNames({ 'slds-drop-zone slds-drop-zone_drag': isDropTarget })}
        title={
          <Grid>
            {name} ({formatNumber(orgCount)})
          </Grid>
        }
        actions={
          <ButtonGroupContainer className="slds-m-right_medium">
            {!isActive && (
              <button className="slds-button slds-button_neutral slds-button_first" onClick={() => onSelected()}>
                Make Active
              </button>
            )}
            <button
              className={classNames('slds-button slds-button_neutral', { 'slds-button_first': isActive, 'slds-button_middle': !isActive })}
              onClick={() => onEditOrg()}
            >
              Edit
            </button>
            <DropDown
              className="slds-button_last"
              dropDownClassName="slds-dropdown_actions"
              position="right"
              items={tertiaryActionMenuItems}
              onSelected={(action) => handleActions(action as 'delete' | 'delete-all')}
            />
          </ButtonGroupContainer>
        }
        bodyClassName="slds-card__body"
      >
        {description && <p className="slds-p-left_small">{description}</p>}
        <Grid
          wrap
          css={css`
            min-height: 8rem;
          `}
        >
          {orgs.map((org) => (
            <div key={org.uniqueId} className="slds-m-around_x-small">
              <SalesforceOrgCardDraggable
                org={org}
                isActive={activeSalesforceOrgId === org.uniqueId}
                onAddOrgHandlerFn={onAddOrgHandlerFn}
              />
            </div>
          ))}
          {!orgs.length && <p className="slds-align_absolute-center">Drag and drop to move salesforce orgs between groups.</p>}
        </Grid>
      </Card>
      {isActive && (
        <Icon
          type="utility"
          icon="check"
          className="slds-icon slds-icon-text-check slds-icon_x-small"
          containerClassname="slds-icon_container slds-visual-picker__text-check"
        />
      )}
    </div>
  );
}

export default OrgGroupCardCard;
