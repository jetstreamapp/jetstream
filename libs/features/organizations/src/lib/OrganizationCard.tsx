import { css } from '@emotion/react';
import { formatNumber } from '@jetstream/shared/ui-utils';
import { JetstreamOrganizationWithOrgs } from '@jetstream/types';
import { ButtonGroupContainer, Card, DropDown, Grid, Icon } from '@jetstream/ui';
import classNames from 'classnames';
import { useDrop } from 'react-dnd';
import SalesforceOrgCardDraggable from './SalesforceOrgCardDraggable';
import { DraggableSfdcCard } from './organization.types';

interface OrganizationCardProps {
  isActive: boolean;
  organization: JetstreamOrganizationWithOrgs;
  activeSalesforceOrgId?: string;
  onSelected: () => void;
  onEditOrg: () => void;
  onMoveOrg: (data: { jetstreamOrganizationId: string; sfdcOrgUniqueId: string; action: 'add' }) => void;
  onDeleteOrg: () => void;
}

export function OrganizationCard({
  isActive,
  organization,
  activeSalesforceOrgId,
  onSelected,
  onEditOrg,
  onMoveOrg,
  onDeleteOrg,
}: OrganizationCardProps) {
  const { id, name, description, orgs } = organization;
  const orgCount = organization.orgs.length;
  const [{ isOver, canDrop }, dropRef] = useDrop<DraggableSfdcCard, any, { isOver: boolean; canDrop: boolean }>(
    {
      accept: 'SalesforceOrg',
      collect: (monitor) => {
        return {
          isOver: monitor.isOver(),
          canDrop: monitor.canDrop(),
        };
      },
      canDrop: (item, monitor) => {
        return item.organizationId !== id && monitor.isOver();
      },
      drop: (item, monitor) => {
        onMoveOrg({
          jetstreamOrganizationId: id,
          sfdcOrgUniqueId: item.uniqueId,
          action: 'add',
        });
      },
    },
    [id, onMoveOrg]
  );

  function handleActions(action: 'delete') {
    switch (action) {
      case 'delete':
        onDeleteOrg();
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
        testId={`organization-card-${organization.name}`}
        css={css`
          ${isActive
            ? `
            border: 1px solid var(--slds-g-color-border-brand-2, #1b96ff) !important;
            -webkit-box-shadow: 0 0 0 1px var(--slds-g-color-border-brand-2, #1b96ff) inset !important;
            ::after {
            content: '';
            position: absolute;
            top: 0;
            right: 0;
            border-radius: 0 0.25rem 0 0;
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
        className={classNames({ 'slds-drop-zone slds-drop-zone_drag': isOver && canDrop })}
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
            <button className="slds-button slds-button_neutral slds-button_middle" onClick={() => onEditOrg()}>
              Edit
            </button>
            <DropDown
              className="slds-button_last"
              dropDownClassName="slds-dropdown_actions"
              position="right"
              items={[{ id: 'delete', value: 'Delete', icon: { type: 'utility', icon: 'delete', description: 'Delete' } }]}
              onSelected={(action) => handleActions(action as 'delete')}
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
              <SalesforceOrgCardDraggable org={org} isActive={activeSalesforceOrgId === org.uniqueId} />
            </div>
          ))}
          {!orgs.length && <p className="slds-align_absolute-center">Drag and drop to move salesforce orgs between organizations.</p>}
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

export default OrganizationCard;
