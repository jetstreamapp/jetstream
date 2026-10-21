import { logger } from '@jetstream/shared/client-logger';
import { ANALYTICS_KEYS } from '@jetstream/shared/constants';
import { getErrorMessage } from '@jetstream/shared/utils';
import { SalesforceOrgUi } from '@jetstream/types';
import { fireToast } from '@jetstream/ui';
import { useAmplitude } from '@jetstream/ui-core';
import { useCallback, useState } from 'react';
import {
  AutomationPackage,
  AutomationPackageItem,
  AutomationPackageVariant,
  buildActivationPackage,
} from './automation-control-package-utils';

export type AutomationPackageDownload = AutomationPackage & { variant: AutomationPackageVariant };

/**
 * Builds a before/after activation package on demand. The caller renders the download modal for
 * `packageDownload` outside its own modal (and hides its modal meanwhile).
 */
export function useAutomationPackageDownload(selectedOrg: SalesforceOrgUi, apiVersion: string, source: 'review' | 'history') {
  const { trackEvent } = useAmplitude();
  const [preparingVariant, setPreparingVariant] = useState<AutomationPackageVariant | null>(null);
  const [packageDownload, setPackageDownload] = useState<AutomationPackageDownload | null>(null);

  const preparePackage = useCallback(
    async (items: AutomationPackageItem[], variant: AutomationPackageVariant) => {
      setPreparingVariant(variant);
      try {
        const automationPackage = await buildActivationPackage(selectedOrg, apiVersion, items);
        if (automationPackage.includedCount === 0) {
          fireToast({ type: 'error', message: 'None of these items could be found in Salesforce, so there is nothing to download.' });
          return;
        }
        setPackageDownload({ ...automationPackage, variant });
        trackEvent(ANALYTICS_KEYS.automation_export, { type: 'activation-package', variant, source, items: items.length });
      } catch (ex) {
        logger.warn('[AUTOMATION][PACKAGE] Error building package', ex);
        fireToast({ type: 'error', message: `There was a problem building the package. ${getErrorMessage(ex)}` });
      } finally {
        setPreparingVariant(null);
      }
    },
    [apiVersion, selectedOrg, source, trackEvent],
  );

  const closePackageDownload = useCallback(() => setPackageDownload(null), []);

  return { preparingVariant, packageDownload, preparePackage, closePackageDownload };
}
