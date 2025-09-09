import { css } from '@emotion/react';
import { SalesforceOrgUi } from '@jetstream/types';
import { Grid, Icon } from '@jetstream/ui';
import { OrgInfoPopover, useUpdateOrgs } from '@jetstream/ui-core';
import { useDrag } from 'react-dnd';
import { DraggableSfdcCard } from './organization.types';

interface SalesforceOrgCardDraggableProps {
  org: SalesforceOrgUi;
  isActive: boolean;
}

export function SalesforceOrgCardDraggable({ org, isActive }: SalesforceOrgCardDraggableProps) {
  const { actionInProgress, orgLoading, handleAddOrg, handleRemoveOrg, handleUpdateOrg } = useUpdateOrgs();

  const [{ opacity }, dragRef] = useDrag<DraggableSfdcCard, any, any>(
    () => ({
      type: 'SalesforceOrg',
      item: { uniqueId: org.uniqueId, organizationId: org.jetstreamOrganizationId ?? null },
      collect: (monitor) => ({
        opacity: monitor.isDragging() ? 0.5 : 1,
      }),
    }),
    [org.jetstreamOrganizationId],
  );

  return (
    <div
      ref={dragRef as any}
      data-testid={`salesforce-organization-${org.label}`}
      style={{ opacity }}
      css={css`
        width: 24rem;
        position: relative;
      `}
    >
      <div
        css={css`
          height: 113px;
          cursor: grabbing;
          ${isActive
            ? `::after {
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
        className="slds-box slds-box_link slds-box_x-small slds-media"
      >
        <div
          className="slds-media__body slds-p-around_xx-small"
          css={css`
            cursor: grabbing;
          `}
        >
          <Grid align="spread" className="slds-m-right_medium">
            <h2 className="slds-truncate slds-text-heading_small">{org.label}</h2>
            <Grid>
              {org.color && (
                <div
                  className="slds-swatch slds-m-right_x-small"
                  css={css`
                    background: ${org.color};
                  `}
                />
              )}
              <OrgInfoPopover
                org={org}
                loading={orgLoading}
                disableOrgActions={actionInProgress}
                iconButtonClassName="slds-button slds-button_icon slds-button_icon-border-filled slds-button_icon-x-small"
                onAddOrg={handleAddOrg}
                onRemoveOrg={handleRemoveOrg}
                onUpdateOrg={handleUpdateOrg}
              />
            </Grid>
          </Grid>
          <p className="slds-m-top_small">{org.organizationId}</p>
          <p className="slds-truncate" title={org.instanceUrl}>
            {org.instanceUrl}
          </p>
        </div>
      </div>
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

export default SalesforceOrgCardDraggable;
