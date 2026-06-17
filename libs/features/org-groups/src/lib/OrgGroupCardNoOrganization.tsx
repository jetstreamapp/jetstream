import { useDroppable } from '@dnd-kit/react';
import { css } from '@emotion/react';
import { formatNumber } from '@jetstream/shared/ui-utils';
import { AddOrgHandlerFn, SalesforceOrgUi } from '@jetstream/types';
import { Card, Grid, Icon } from '@jetstream/ui';
import classNames from 'classnames';
import { SalesforceOrgCardDraggable } from './SalesforceOrgCardDraggable';
import { DraggableSfdcCard, SfdcCardDropTarget } from './organization-group.types';

interface OrgGroupCardNoOrganizationProps {
  isActive: boolean;
  orgs: SalesforceOrgUi[];
  activeSalesforceOrgId?: string;
  onSelected: () => void;
  /**
   * If provided, this will be used instead of the default addOrg function.
   * This is used in the desktop app to open the browser for the login process.
   */
  onAddOrgHandlerFn?: AddOrgHandlerFn;
}

export function OrgGroupCardNoOrganization({
  isActive,
  orgs,
  activeSalesforceOrgId,
  onSelected,
  onAddOrgHandlerFn,
}: OrgGroupCardNoOrganizationProps) {
  // Only accept org cards that currently belong to a group (replaces react-dnd canDrop).
  const { ref: dropRef, isDropTarget } = useDroppable({
    id: 'unassigned',
    accept: (source) => !!(source.data as DraggableSfdcCard).organizationId,
    data: { action: 'remove' } satisfies SfdcCardDropTarget,
  });

  return (
    <div
      css={css`
        position: relative;
      `}
    >
      <Card
        ref={dropRef}
        testId={`org-group-card-empty`}
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
        actions={
          <div className="slds-m-right_medium">
            {!isActive && (
              <button className="slds-button slds-button_neutral" onClick={() => onSelected()}>
                Make Active
              </button>
            )}
          </div>
        }
        title={<Grid>Unassigned ({formatNumber(orgs.length)})</Grid>}
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
