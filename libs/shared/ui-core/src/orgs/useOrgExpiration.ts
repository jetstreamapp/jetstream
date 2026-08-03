import { getDaysUntilOrgExpiration } from '@jetstream/shared/utils';
import { SalesforceOrgUi } from '@jetstream/types';
import { useMemo } from 'react';

export interface OrgExpirationStatus {
  isExpiring: boolean;
  isExpired: boolean;
  expiryDate: string | null;
  daysUntilExpiration: number | null;
  severity: 'error' | 'warning' | null;
}

export interface ExpiringOrgsSummary {
  total: number;
  expired: number;
  expiringSoon: number;
  expiringOrgs: Array<SalesforceOrgUi & { expiryDate: string; daysUntilExpiration: number }>;
}

/**
 * Calculate expiration status for a single org
 */
export function calculateOrgExpiration(org: SalesforceOrgUi | null | undefined): OrgExpirationStatus {
  if (!org?.expirationScheduledFor) {
    return {
      isExpiring: false,
      isExpired: false,
      expiryDate: null,
      daysUntilExpiration: null,
      severity: null,
    };
  }

  const expirationDate = new Date(org.expirationScheduledFor);
  const daysUntilExpiration = getDaysUntilOrgExpiration(expirationDate, new Date());

  const isExpired = daysUntilExpiration <= 0;
  const isExpiring = true;

  /**
   * An org only has an expiration date once it is inside the warning window, so the range here is
   * capped at ORG_EXPIRATION_WARNING_WINDOW_DAYS - there is no "far off" band to represent.
   */
  const severity: 'error' | 'warning' = daysUntilExpiration <= 3 ? 'error' : 'warning';

  return {
    isExpiring,
    isExpired,
    expiryDate: expirationDate.toLocaleDateString(),
    daysUntilExpiration,
    severity,
  };
}

/**
 * Hook to get expiration status for a single org
 */
export function useOrgExpiration(org: SalesforceOrgUi | null | undefined): OrgExpirationStatus {
  return useMemo(() => calculateOrgExpiration(org), [org]);
}

/**
 * Hook to get summary of all expiring orgs
 */
export function useExpiringOrgs(orgs: SalesforceOrgUi[]): ExpiringOrgsSummary {
  return useMemo(() => {
    const expiringOrgs = orgs
      .map((org) => {
        const status = calculateOrgExpiration(org);
        if (status.isExpiring && status.expiryDate && status.daysUntilExpiration !== null) {
          return { ...org, expiryDate: status.expiryDate, daysUntilExpiration: status.daysUntilExpiration };
        }
        return null;
      })
      .filter((org): org is SalesforceOrgUi & { expiryDate: string; daysUntilExpiration: number } => org !== null)
      .sort((a, b) => a.daysUntilExpiration - b.daysUntilExpiration);

    const expired = expiringOrgs.filter(({ daysUntilExpiration }) => daysUntilExpiration <= 0).length;
    const expiringSoon = expiringOrgs.filter(({ daysUntilExpiration }) => daysUntilExpiration > 0).length;

    return {
      total: expiringOrgs.length,
      expired,
      expiringSoon,
      expiringOrgs,
    };
  }, [orgs]);
}
