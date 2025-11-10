import { SalesforceOrgUi } from '@jetstream/types';
import { useMemo } from 'react';

export interface OrgExpirationStatus {
  isExpiring: boolean;
  isExpired: boolean;
  expiryDate: string | null;
  daysUntilExpiration: number | null;
  severity: 'error' | 'warning' | 'info' | null;
}

export interface ExpiringOrgsSummary {
  total: number;
  expired: number;
  expiringSoon: number; // within 30 days
  expiringOrgs: Array<SalesforceOrgUi & { expiryDate: string; daysUntilExpiration: number }>;
}

const WARNING_THRESHOLD_DAYS = 30;

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

  const now = new Date();
  const expirationDate = new Date(org.expirationScheduledFor);
  const daysUntilExpiration = Math.ceil((expirationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  const isExpired = daysUntilExpiration <= 0;
  const isExpiring = true;

  let severity: 'error' | 'warning' | 'info' | null = null;
  if (isExpired) {
    severity = 'error';
  } else if (daysUntilExpiration <= 3) {
    severity = 'error';
  } else if (daysUntilExpiration <= 7) {
    severity = 'warning';
  } else if (isExpiring) {
    severity = 'info';
  }

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
