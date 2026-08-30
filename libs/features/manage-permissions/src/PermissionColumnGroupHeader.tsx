import { css } from '@emotion/react';
import { getManagedPermissionSetSource, isManagedPermissionSet } from '@jetstream/shared/ui-utils';
import { Icon, ProfileOrPermSetPopover, Tooltip } from '@jetstream/ui';
import { fromPermissionsState, useAnalytics } from '@jetstream/ui-core';
import { applicationCookieState, selectedOrgState, selectSkipFrontdoorAuth, useCanPerformOperation } from '@jetstream/ui/app-state';
import { useAtomValue } from 'jotai';

export interface PermissionColumnGroupHeaderProps {
  /** PermissionSet id — for profiles this is the id of the profile-owned permission set. */
  id: string;
  label: string;
  type: 'Profile' | 'Permission Set';
}

/**
 * Header for the column group that spans every permission of one profile / permission set. Shows the name
 * and a popover with the assigned users; permission sets can also manage their assignments from there.
 *
 * Reads org/config from state rather than taking them as props so the four `get*Columns` builders — which
 * are also used by the CSV/xlsx export paths — don't have to know about org connection details.
 */
export function PermissionColumnGroupHeader({ id, label, type }: PermissionColumnGroupHeaderProps) {
  const selectedOrg = useAtomValue(selectedOrgState);
  const { serverUrl } = useAtomValue(applicationCookieState);
  const skipFrontDoorAuth = useAtomValue(selectSkipFrontdoorAuth);
  const profilesById = useAtomValue(fromPermissionsState.profilesByIdSelector);
  const permissionSetsById = useAtomValue(fromPermissionsState.permissionSetsByIdSelector);
  const canDeployMetadata = useCanPerformOperation('metadata.deploy');
  const { trackEvent } = useAnalytics();

  const isPermissionSet = type === 'Permission Set';
  const meta = isPermissionSet ? permissionSetsById[id] : profilesById[id];
  const isReadOnly = isManagedPermissionSet(meta, selectedOrg.orgNamespacePrefix);
  const fullLabel = isReadOnly ? `${label} (${type}) — Managed, read-only` : `${label} (${type})`;

  return (
    <span
      className="slds-grid slds-grid_vertical-align-center"
      css={css`
        gap: 0.25rem;
        min-width: 0;
        max-width: 100%;
      `}
    >
      {isReadOnly && (
        <Tooltip content={`Provided by ${getManagedPermissionSetSource(meta)}. Salesforce does not allow these permissions to be changed.`}>
          <Icon
            type="utility"
            icon="lock"
            className="slds-icon slds-icon-text-default slds-icon_xx-small slds-shrink-none"
            omitContainer
            description="Managed, read-only"
          />
        </Tooltip>
      )}
      <span className="slds-truncate" title={fullLabel}>
        {fullLabel}
      </span>
      {/*
        Keep clicks off the header cell so they can't trigger sort/keyboard-cell handling. `mousedown` is
        deliberately NOT stopped — React forwards stopPropagation to the native event, which would keep the
        document-level listener that dismisses other open popovers from ever firing.
      */}
      <span
        className="slds-shrink-none"
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
      >
        <ProfileOrPermSetPopover
          keepGridTabStop
          org={selectedOrg}
          serverUrl={serverUrl}
          skipFrontDoorAuth={skipFrontDoorAuth}
          recordId={id}
          recordType={isPermissionSet ? 'PermissionSet' : 'Profile'}
          meta={meta}
          allowManageAssignments={isPermissionSet && canDeployMetadata}
          buttonTitle={`View ${fullLabel} details`}
          trackEvent={trackEvent}
        />
      </span>
    </span>
  );
}

export default PermissionColumnGroupHeader;
