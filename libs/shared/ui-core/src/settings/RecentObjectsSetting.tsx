import { logger } from '@jetstream/shared/client-logger';
import { ariaDisabledButtonProps, fireToast, Spinner } from '@jetstream/ui';
import { selectedOrgStateWithoutPlaceholder } from '@jetstream/ui/app-state';
import { recentHistoryItemsDb } from '@jetstream/ui/db';
import { useAtomValue } from 'jotai';
import { useState } from 'react';
import { SettingsRow } from './layout/SettingsSection';

type ClearScope = 'current' | 'all';

export const RecentObjectsSetting = () => {
  const selectedOrg = useAtomValue(selectedOrgStateWithoutPlaceholder);
  const [clearingScope, setClearingScope] = useState<ClearScope | null>(null);

  async function clearRecentObjects(scope: ClearScope) {
    try {
      setClearingScope(scope);
      if (scope === 'current' && selectedOrg) {
        await recentHistoryItemsDb.clearRecentHistoryItemsForCurrentOrg(selectedOrg.uniqueId);
      } else if (scope === 'all') {
        await recentHistoryItemsDb.clearRecentHistoryItemsForAllOrgs();
      }
      fireToast({ message: 'Recent objects cleared', type: 'success' });
    } catch (ex) {
      logger.error('[DB] Error clearing recent objects', ex);
      fireToast({
        message: 'There was a problem clearing your recent objects. Try again or file a support ticket for assistance.',
        type: 'warning',
      });
    } finally {
      setClearingScope(null);
    }
  }

  return (
    <SettingsRow
      id="setting-recent-objects"
      title="Recent objects"
      description="Clear the recently used objects that Jetstream lists first when you choose an object. Nothing in Salesforce is changed."
    >
      {/* aria-disabled rather than disabled: a button that disables itself while it runs would drop focus to <body> */}
      <button
        className="slds-button slds-button_neutral slds-is-relative"
        title={selectedOrg ? undefined : 'Select an org to clear its recent objects'}
        {...ariaDisabledButtonProps(!selectedOrg || !!clearingScope, () => clearRecentObjects('current'))}
      >
        {clearingScope === 'current' && <Spinner size="x-small" />}
        Clear for Current Org
      </button>
      <button
        className="slds-button slds-button_neutral slds-is-relative"
        {...ariaDisabledButtonProps(!!clearingScope, () => clearRecentObjects('all'))}
      >
        {clearingScope === 'all' && <Spinner size="x-small" />}
        Clear for All Orgs
      </button>
    </SettingsRow>
  );
};
