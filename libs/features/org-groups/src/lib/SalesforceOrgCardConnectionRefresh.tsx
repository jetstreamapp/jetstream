import { logger } from '@jetstream/shared/client-logger';
import { ANALYTICS_KEYS } from '@jetstream/shared/constants';
import { checkOrgHealth, getOrgs } from '@jetstream/shared/data';
import { ORG_INACTIVITY_EXPIRATION_DAYS } from '@jetstream/shared/utils';
import { AddOrgHandlerFn, Maybe, SalesforceOrgUi } from '@jetstream/types';
import { Badge, ConfirmationModalPromise, Grid, Icon, Spinner, Tooltip, fireToast } from '@jetstream/ui';
import {
  AddOrg,
  OrgExpirationStatus,
  getOrgExpirationBadge,
  getOrgExpirationTooltip,
  useAmplitude,
  useOrgExpiration,
  useUpdateOrgs,
} from '@jetstream/ui-core';
import { fromAppState } from '@jetstream/ui/app-state';
import { useSetAtom } from 'jotai';
import { useState } from 'react';

interface SalesforceOrgCardConnectionRefreshProps {
  org: SalesforceOrgUi;
  /**
   * If provided, this will be used instead of the default addOrg function.
   * This is used in the desktop app to open the browser for the login process.
   */
  onAddOrgHandlerFn?: AddOrgHandlerFn;
  onAddOrg: ReturnType<typeof useUpdateOrgs>['handleAddOrg'];
  onRemoveOrg: ReturnType<typeof useUpdateOrgs>['handleRemoveOrg'];
}

/**
 * An org inside the warning window still works and only needs to be used, so it gets amber, a clock and
 * a refresh action. One that has already been cut off gets red, a ban icon and a reconnect action -
 * different at a glance rather than differing only in the tense of a date.
 */
function getConnectionState(orgExpiration: OrgExpirationStatus, connectionError: Maybe<string>) {
  const { status } = orgExpiration;
  const isStillUsable = status === 'expiring';
  return {
    badge: getOrgExpirationBadge(orgExpiration),
    tooltip: getOrgExpirationTooltip(orgExpiration, connectionError) ?? '',
    refreshIcon: {
      isVisible: status === 'expiring' || status === 'error',
      tooltip: isStillUsable
        ? `Refresh the connection now to reset the ${ORG_INACTIVITY_EXPIRATION_DAYS}-day inactivity clock`
        : `There was an error connecting to this org. You can try refreshing the connection otherwise you will need to reconnect the org. Error: ${connectionError}`,
    },
    reconnectOrg: {
      isVisible: status === 'disconnected' || status === 'error',
    },
  };
}

export function SalesforceOrgCardConnectionRefresh({
  org,
  onAddOrgHandlerFn,
  onAddOrg,
  onRemoveOrg,
}: SalesforceOrgCardConnectionRefreshProps) {
  const orgExpiration = useOrgExpiration(org);
  const { trackEvent } = useAmplitude();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const setOrgs = useSetAtom(fromAppState.salesforceOrgsAsyncState);

  const handleRefreshOrg = async () => {
    setIsRefreshing(true);
    let success = true;
    try {
      await checkOrgHealth(org);
      fireToast({
        type: 'success',
        message: 'Org connection refreshed successfully',
      });
    } catch (error) {
      success = false;
      logger.error('Error refreshing org', error);
      fireToast({
        type: 'error',
        message: 'Failed to refresh org connection. Reconnect the org to continue using it.',
      });
    } finally {
      /**
       * Re-fetch on failure as well as success - a failed health check is exactly when the server records the
       * connection error, and without this the card keeps showing stale status until the page is reloaded.
       */
      try {
        setOrgs(await getOrgs());
      } catch (error) {
        logger.error('Error re-fetching orgs after refresh', error);
      }
      setIsRefreshing(false);
      trackEvent(ANALYTICS_KEYS.sfdc_org_refresh_connection, {
        success,
        status: orgExpiration.status,
        hadConnectionError: !!org.connectionError,
      });
    }
  };

  const handleRemoveOrg = async () => {
    if (await ConfirmationModalPromise({ content: 'Are you sure you want to remove this org from Jetstream?', confirm: 'Remove Org' })) {
      trackEvent(ANALYTICS_KEYS.sfdc_org_removed, { source: 'org-groups-card', status: orgExpiration.status });
      onRemoveOrg(org);
    }
  };

  if (orgExpiration.status === 'connected') {
    return null;
  }

  const { badge, tooltip, refreshIcon, reconnectOrg } = getConnectionState(orgExpiration, org.connectionError);

  return (
    <Grid verticalAlign="center" className="slds-m-top_xx-small">
      {isRefreshing && <Spinner />}
      {badge && (
        <Grid verticalAlign="center">
          <Tooltip content={tooltip}>
            <Badge type={badge.badgeType}>
              <Icon
                type="utility"
                icon={badge.icon}
                className="slds-icon_xx-small slds-m-right_xx-small"
                containerClassname="slds-icon_container slds-current-color"
              />
              {badge.label}
            </Badge>
          </Tooltip>
        </Grid>
      )}

      {refreshIcon.isVisible && (
        <Tooltip content={refreshIcon.tooltip}>
          <button
            className="slds-button slds-button_icon slds-button_icon-container slds-m-left_xx-small"
            onClick={handleRefreshOrg}
            disabled={isRefreshing}
          >
            <Icon type="utility" icon="refresh" description="Refresh org connection" className="slds-button__icon" omitContainer />
          </button>
        </Tooltip>
      )}

      {reconnectOrg.isVisible && (
        <>
          <AddOrg
            omitIcon
            className="slds-button_neutral"
            existingOrg={org}
            label="Reconnect Org"
            popoverLabel="Reconnect Org"
            onAddOrg={onAddOrg}
            onAddOrgHandlerFn={onAddOrgHandlerFn}
          />
          <button
            className="slds-button slds-button_icon slds-button_icon-border slds-button_icon-error slds-m-left_xx-small"
            title="Remove Org"
            onClick={handleRemoveOrg}
          >
            <Icon type="utility" icon="delete" className="slds-button__icon" omitContainer />
            <span className="slds-assistive-text">Remove Org</span>
          </button>
        </>
      )}
    </Grid>
  );
}
