import { css } from '@emotion/react';
import { formatNumber } from '@jetstream/shared/ui-utils';
import { SalesforceOrgUi } from '@jetstream/types';
import { Card, Grid, Icon } from '@jetstream/ui';
import classNames from 'classnames';
import { useDrop } from 'react-dnd';
import SalesforceOrgCardDraggable from './SalesforceOrgCardDraggable';
import { DraggableSfdcCard } from './organization.types';

interface OrganizationCardNoOrganizationProps {
  isActive: boolean;
  orgs: SalesforceOrgUi[];
  activeSalesforceOrgId?: string;
  onSelected: () => void;
  onMoveOrg: (data: { jetstreamOrganizationId: null; sfdcOrgUniqueId: string; action: 'remove' }) => void;
}

export function OrganizationCardNoOrganization({
  isActive,
  orgs,
  activeSalesforceOrgId,
  onSelected,
  onMoveOrg,
}: OrganizationCardNoOrganizationProps) {
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
        return !!item.organizationId && monitor.isOver();
      },
      drop: (item, monitor) => {
        onMoveOrg({
          jetstreamOrganizationId: null,
          sfdcOrgUniqueId: item.uniqueId,
          action: 'remove',
        });
      },
    },
    [onMoveOrg],
  );

  return (
    <div
      css={css`
        position: relative;
      `}
    >
      <Card
        ref={dropRef as any}
        testId={`organization-card-empty`}
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
        actions={
          <div className="slds-m-right_medium">
            {!isActive && (
              <button className="slds-button slds-button_neutral" onClick={() => onSelected()}>
                Make Active
              </button>
            )}
          </div>
        }
        title={<Grid>Salesforce Orgs Not Assigned to Organization ({formatNumber(orgs.length)})</Grid>}
        bodyClassName="slds-card__body"
      >
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
