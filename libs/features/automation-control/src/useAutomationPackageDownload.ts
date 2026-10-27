import { logger } from '@jetstream/shared/client-logger';
import { ANALYTICS_KEYS } from '@jetstream/shared/constants';
import { getErrorMessage } from '@jetstream/shared/utils';
import { SalesforceOrgUi } from '@jetstream/types';
import { useAnalytics } from '@jetstream/ui-core';
import { useCallback, useState } from 'react';
import {
  AutomationPackage,
  AutomationPackageItem,
  AutomationPackageVariant,
  buildActivationPackage,
} from './automation-control-package-utils';

const MAX_MISSING_REASONS_SHOWN = 3;

export type AutomationPackageDownload = AutomationPackage & { variant: AutomationPackageVariant };

/**
 * Builds a before/after activation package on demand. The caller renders the download modal for
 * `packageDownload` outside its own modal (and hides its modal meanwhile).
 */
export function useAutomationPackageDownload(selectedOrg: SalesforceOrgUi, apiVersion: string, source: 'review' | 'history') {
  const { trackEvent } = useAnalytics();
  const [preparingVariant, setPreparingVariant] = useState<AutomationPackageVariant | null>(null);
  const [packageDownload, setPackageDownload] = useState<AutomationPackageDownload | null>(null);
  /** Shown inside the caller's modal, a toast would render behind it */
  const [packageError, setPackageError] = useState<string | null>(null);

  const preparePackage = useCallback(
    async (items: AutomationPackageItem[], variant: AutomationPackageVariant) => {
      setPreparingVariant(variant);
      setPackageError(null);
      try {
        const automationPackage = await buildActivationPackage(selectedOrg, apiVersion, items);
        if (automationPackage.includedCount === 0) {
          const reasons = automationPackage.missingItems
            .slice(0, MAX_MISSING_REASONS_SHOWN)
            .map(({ label, reason }) => `${label} - ${reason}`);
          setPackageError(`None of these items could be found in Salesforce, so there is nothing to download. ${reasons.join(' ')}`);
          return;
        }
        setPackageDownload({ ...automationPackage, variant });
        trackEvent(ANALYTICS_KEYS.automation_export, { type: 'activation-package', variant, source, items: items.length });
      } catch (ex) {
        logger.warn('[AUTOMATION][PACKAGE] Error building package', ex);
        setPackageError(`There was a problem building the package. ${getErrorMessage(ex)}`);
      } finally {
        setPreparingVariant(null);
      }
    },
    [apiVersion, selectedOrg, source, trackEvent],
  );

  const closePackageDownload = useCallback(() => setPackageDownload(null), []);

  return { preparingVariant, packageDownload, packageError, preparePackage, closePackageDownload };
}
