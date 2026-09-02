import { logger } from '@jetstream/shared/client-logger';
import { ANALYTICS_KEYS } from '@jetstream/shared/constants';
import { checkOrgHealth, getOrgs } from '@jetstream/shared/data';
import { ORG_INACTIVITY_EXPIRATION_DAYS, pluralizeFromNumber } from '@jetstream/shared/utils';
import { SalesforceOrgUi } from '@jetstream/types';
import { ariaDisabledButtonProps, AssistiveStatus, fireToast, Icon, Spinner, Tooltip } from '@jetstream/ui';
import { useAmplitude } from '@jetstream/ui-core';
import { fromAppState } from '@jetstream/ui/app-state';
import classNames from 'classnames';
import { useSetAtom } from 'jotai';
import PQueue from 'p-queue';
import { useState } from 'react';

/** Each health check is a round trip to Salesforce, so fan out enough to stay quick without flooding the user's orgs */
const REFRESH_CONCURRENCY = 2;

interface RefreshAllOrgsButtonProps {
  className?: string;
  orgs: SalesforceOrgUi[];
}

/**
 * Runs a connection health check against every org, which both surfaces broken connections and resets
 * Salesforce's inactivity clock (the server treats any org access as activity).
 */
export const RefreshAllOrgsButton = ({ className, orgs }: RefreshAllOrgsButtonProps) => {
  const { trackEvent } = useAmplitude();
  const setOrgs = useSetAtom(fromAppState.salesforceOrgsAsyncState);
  const [completedCount, setCompletedCount] = useState<number | null>(null);
  const isRefreshing = completedCount !== null;

  async function handleRefreshAllOrgs() {
    setCompletedCount(0);
    let successCount = 0;
    let errorCount = 0;

    try {
      const queue = new PQueue({ concurrency: REFRESH_CONCURRENCY });
      await queue.addAll(
        orgs.map((org) => async () => {
          try {
            await checkOrgHealth(org);
            successCount++;
          } catch (ex) {
            errorCount++;
            logger.warn('Error refreshing org connection', org.uniqueId, ex);
          } finally {
            setCompletedCount((prevValue) => (prevValue ?? 0) + 1);
          }
        }),
      );

      // The health check updates connection errors and clears expiration dates server-side, re-fetch to pick both up
      setOrgs(await getOrgs());

      if (errorCount === 0) {
        fireToast({
          type: 'success',
          message: `Refreshed ${successCount} ${pluralizeFromNumber('org', successCount)}. The ${ORG_INACTIVITY_EXPIRATION_DAYS}-day inactivity clock has been reset.`,
        });
      } else if (successCount === 0) {
        fireToast({
          type: 'error',
          message: `Unable to refresh ${errorCount} ${pluralizeFromNumber('org', errorCount)}. Reconnect the orgs with a connection error to continue using them.`,
        });
      } else {
        fireToast({
          type: 'warning',
          message: `Refreshed ${successCount} of ${orgs.length} orgs. The remaining ${errorCount} ${pluralizeFromNumber('org', errorCount)} must be reconnected.`,
        });
      }
    } catch (ex) {
      logger.error('Error refreshing all orgs', ex);
      fireToast({ type: 'error', message: 'There was a problem refreshing your orgs. Please try again.' });
    } finally {
      setCompletedCount(null);
      trackEvent(ANALYTICS_KEYS.sfdc_org_refresh_all, { orgCount: orgs.length, successCount, errorCount });
    }
  }

  return (
    <>
      <Tooltip
        content={`Salesforce ends a connection when an org has not been used for ${ORG_INACTIVITY_EXPIRATION_DAYS} days. Refreshing checks every connection and resets the ${ORG_INACTIVITY_EXPIRATION_DAYS}-day clock so your orgs stay connected.`}
      >
        {/* Stays focusable while its own click disables it — native disabled would drop focus to <body> */}
        <button
          className={classNames('slds-button slds-button_neutral slds-is-relative', className)}
          aria-busy={isRefreshing || undefined}
          {...ariaDisabledButtonProps(isRefreshing, () => handleRefreshAllOrgs())}
        >
          <Icon type="utility" icon="refresh" className="slds-button__icon slds-button__icon_left" omitContainer />
          {isRefreshing ? `Refreshing ${completedCount} of ${orgs.length}` : 'Refresh All Orgs'}
          {isRefreshing && <Spinner size="small" />}
        </button>
      </Tooltip>
      {/* The label swap above is not announced on its own; the completion toast announces the outcome */}
      <AssistiveStatus message={isRefreshing ? `Refreshing ${completedCount} of ${orgs.length} orgs` : ''} />
    </>
  );
};
