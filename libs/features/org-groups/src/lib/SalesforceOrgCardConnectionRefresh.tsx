import { logger } from '@jetstream/shared/client-logger';
import { checkOrgHealth, getOrgs } from '@jetstream/shared/data';
import { pluralizeFromNumber } from '@jetstream/shared/utils';
import { AddOrgHandlerFn, BadgeType, SalesforceOrgUi } from '@jetstream/types';
import { Badge, Grid, Icon, Spinner, Tooltip, fireToast } from '@jetstream/ui';
import { AddOrg, OrgExpirationStatus, useOrgExpiration, useUpdateOrgs } from '@jetstream/ui-core';
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
}

function getConnectionState(orgExpiration: OrgExpirationStatus, hasConnectionError: boolean) {
  const connectionState = {
    badge: {
      isVisible: !!orgExpiration.isExpiring,
      label: orgExpiration.isExpired ? 'Expired' : `Expires ${orgExpiration.expiryDate}`,
      tooltip: orgExpiration.isExpired
        ? 'This org expired due to 90 days of inactivity. Reconnect the org to continue using it or delete it if it is no longer needed.'
        : `This org will expire in ${orgExpiration.daysUntilExpiration} ${pluralizeFromNumber('day', orgExpiration.daysUntilExpiration || 0)} due to inactivity. Refresh it or use it to prevent expiration.`,
      badgeType: (orgExpiration.severity === 'error' ? 'error' : 'warning') as BadgeType,
    },
    refreshIcon: {
      isVisible: (hasConnectionError && !orgExpiration.isExpired) || orgExpiration.isExpiring,
      tooltip: orgExpiration.isExpiring
        ? 'Refresh the connection to remove the pending expiration'
        : 'There was an error connecting to this org. You can try refreshing the connection otherwise you will need to reconnect the org.',
    },
    reconnectOrg: {
      isVisible: hasConnectionError || orgExpiration.isExpired,
    },
  };

  if (!connectionState.badge.isVisible && hasConnectionError) {
    connectionState.badge.isVisible = true;
    connectionState.badge.label = 'Connection Error';
    connectionState.badge.tooltip =
      'There was an error connecting to this org. You can try refreshing the connection otherwise you will need to reconnect the org.';
    connectionState.badge.badgeType = 'error';
  }

  return connectionState;
}

export function SalesforceOrgCardConnectionRefresh({ org, onAddOrgHandlerFn, onAddOrg }: SalesforceOrgCardConnectionRefreshProps) {
  const orgExpiration = useOrgExpiration(org);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const setOrgs = useSetAtom(fromAppState.salesforceOrgsAsyncState);

  const handleRefreshOrg = async () => {
    setIsRefreshing(true);
    try {
      await checkOrgHealth(org);
      // Re-fetch orgs to update state
      const updatedOrgs = await getOrgs();
      setOrgs(updatedOrgs);
      fireToast({
        type: 'success',
        message: 'Org connection refreshed successfully',
      });
    } catch (error) {
      logger.error('Error refreshing org', error);
      fireToast({
        type: 'error',
        message: 'Failed to refresh org connection. Reconnect the org to continue using it.',
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  if (!orgExpiration.isExpiring && !org.connectionError) {
    return null;
  }

  const { badge, refreshIcon, reconnectOrg } = getConnectionState(orgExpiration, !!org.connectionError);

  return (
    <Grid verticalAlign="center" className="slds-m-top_xx-small">
      {isRefreshing && <Spinner />}
      {badge.isVisible && (
        <Grid verticalAlign="center">
          <Tooltip content={badge.tooltip}>
            <Badge type={badge.badgeType}>{badge.label}</Badge>
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
        <AddOrg
          omitIcon
          className="slds-button_neutral"
          existingOrg={org}
          label="Reconnect Org"
          popoverLabel="Reconnect Org"
          onAddOrg={onAddOrg}
          onAddOrgHandlerFn={onAddOrgHandlerFn}
        />
      )}
    </Grid>
  );
}
