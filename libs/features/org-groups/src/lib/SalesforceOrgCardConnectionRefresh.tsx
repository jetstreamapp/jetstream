import { logger } from '@jetstream/shared/client-logger';
import { ANALYTICS_KEYS } from '@jetstream/shared/constants';
import { checkOrgHealth, getOrgs } from '@jetstream/shared/data';
import { ORG_INACTIVITY_EXPIRATION_DAYS, pluralizeFromNumber } from '@jetstream/shared/utils';
import { AddOrgHandlerFn, BadgeType, Maybe, SalesforceOrgUi } from '@jetstream/types';
import { ariaDisabledButtonProps, Badge, ConfirmationModalPromise, fireToast, Grid, Icon, Spinner, Tooltip } from '@jetstream/ui';
import { AddOrg, OrgExpirationStatus, useAmplitude, useOrgExpiration, useUpdateOrgs } from '@jetstream/ui-core';
import { fromAppState } from '@jetstream/ui/app-state';
import { useSetAtom } from 'jotai';
import { useEffect, useRef, useState } from 'react';

/** Id of an org card's heading — the focus target when the card's connection controls disappear under the user */
export function getOrgCardHeadingId(orgUniqueId: string) {
  return `org-card-heading-${orgUniqueId}`;
}

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

function getConnectionState(orgExpiration: OrgExpirationStatus, connectionError: Maybe<string>) {
  const hasConnectionError = !!connectionError;
  const connectionState = {
    badge: {
      isVisible: !!orgExpiration.isExpiring,
      label: orgExpiration.isExpired ? 'Disconnected' : `Ends ${orgExpiration.expiryDate}`,
      tooltip: orgExpiration.isExpired
        ? `Salesforce ended this connection because the org was not used in Jetstream for ${ORG_INACTIVITY_EXPIRATION_DAYS} days. Reconnect the org to continue using it, or remove it if you no longer need it.`
        : `Salesforce will end this connection in ${orgExpiration.daysUntilExpiration} ${pluralizeFromNumber('day', orgExpiration.daysUntilExpiration || 0)} unless the org is used. Open or refresh the org in Jetstream to keep it connected.`,
      badgeType: (orgExpiration.severity === 'error' ? 'error' : 'warning') as BadgeType,
    },
    refreshIcon: {
      isVisible: (hasConnectionError && !orgExpiration.isExpired) || orgExpiration.isExpiring,
      tooltip: orgExpiration.isExpiring
        ? `Refresh the connection now to reset the ${ORG_INACTIVITY_EXPIRATION_DAYS}-day inactivity clock`
        : `There was an error connecting to this org. You can try refreshing the connection otherwise you will need to reconnect the org. Error: ${connectionError}`,
    },
    reconnectOrg: {
      isVisible: hasConnectionError || orgExpiration.isExpired,
    },
  };

  if (!connectionState.badge.isVisible && hasConnectionError) {
    connectionState.badge.isVisible = true;
    connectionState.badge.label = 'Connection Error';
    connectionState.badge.tooltip = `There was an error connecting to this org. You can try refreshing the connection otherwise you will need to reconnect the org. Error: ${connectionError}`;
    connectionState.badge.badgeType = 'error';
  }

  return connectionState;
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

  const showsConnectionControls = !!orgExpiration.isExpiring || !!org.connectionError;

  // A successful refresh clears the expiry / error state, which removes this whole block — and the
  // Refresh button the keyboard user just activated — so land focus on the card heading instead of
  // letting it fall to <body>
  const previouslyShowedControlsRef = useRef(showsConnectionControls);
  useEffect(() => {
    const controlsDisappeared = previouslyShowedControlsRef.current && !showsConnectionControls;
    previouslyShowedControlsRef.current = showsConnectionControls;
    if (controlsDisappeared && document.activeElement === document.body) {
      document.getElementById(getOrgCardHeadingId(org.uniqueId))?.focus();
    }
  }, [showsConnectionControls, org.uniqueId]);

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
        isExpiring: orgExpiration.isExpiring,
        isExpired: orgExpiration.isExpired,
        hadConnectionError: !!org.connectionError,
      });
    }
  };

  const handleRemoveOrg = async () => {
    if (await ConfirmationModalPromise({ content: 'Are you sure you want to remove this org from Jetstream?', confirm: 'Remove Org' })) {
      trackEvent(ANALYTICS_KEYS.sfdc_org_removed, { source: 'org-groups-card', isExpired: orgExpiration.isExpired });
      onRemoveOrg(org);
    }
  };

  if (!showsConnectionControls) {
    return null;
  }

  const { badge, refreshIcon, reconnectOrg } = getConnectionState(orgExpiration, org.connectionError);

  return (
    <Grid verticalAlign="center" className="slds-m-top_xx-small">
      {isRefreshing && <Spinner />}
      {badge.isVisible && (
        <Grid verticalAlign="center">
          <Tooltip content={badge.tooltip}>
            <Badge type={badge.badgeType}>
              {badge.label}
              {/* The explanation is otherwise tooltip-only on an element that cannot take focus */}
              <span className="slds-assistive-text"> {badge.tooltip}</span>
            </Badge>
          </Tooltip>
        </Grid>
      )}

      {refreshIcon.isVisible && (
        <Tooltip content={refreshIcon.tooltip}>
          {/* Stays focusable while its own click disables it — native disabled would drop focus to <body> */}
          <button
            className="slds-button slds-button_icon slds-button_icon-container slds-m-left_xx-small"
            {...ariaDisabledButtonProps(isRefreshing, () => handleRefreshOrg())}
          >
            <Icon
              type="utility"
              icon="refresh"
              description={`Refresh ${org.label} connection`}
              className="slds-button__icon"
              omitContainer
            />
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
            title={`Remove ${org.label}`}
            onClick={handleRemoveOrg}
          >
            <Icon type="utility" icon="delete" className="slds-button__icon" omitContainer />
            <span className="slds-assistive-text">Remove {org.label}</span>
          </button>
        </>
      )}
    </Grid>
  );
}
