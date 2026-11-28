import { logger } from '@jetstream/shared/client-logger';
import { describeSObject } from '@jetstream/shared/data';
import type { SalesforceOrgUi } from '@jetstream/types';
import { useEffect, useState } from 'react';
import { FALLBACK_SCRATCH_ORG_INFO_PICKLISTS, getScratchOrgInfoPicklists, ScratchOrgInfoPicklists } from './scratch-org-picklists';

/**
 * Editions, releases and languages the Dev Hub accepts for a scratch org.
 * The documented values are returned while loading and when the Dev Hub cannot be described, so the form always works.
 */
export function useScratchOrgInfoPicklists(devHubOrg: SalesforceOrgUi): { picklists: ScratchOrgInfoPicklists; loading: boolean } {
  const [picklists, setPicklists] = useState(FALLBACK_SCRATCH_ORG_INFO_PICKLISTS);
  const [loading, setLoading] = useState(true);

  // The org object is replaced whenever the list of orgs is refetched, the Dev Hub is only described again when it changes
  useEffect(() => {
    let isCurrent = true;
    setLoading(true);
    describeSObject(devHubOrg, 'ScratchOrgInfo')
      .then(({ data }) => {
        if (isCurrent) {
          setPicklists(getScratchOrgInfoPicklists(data));
        }
      })
      .catch((ex) => {
        logger.warn('[SCRATCH ORG] Could not describe ScratchOrgInfo, using the documented picklist values', ex);
        if (isCurrent) {
          setPicklists(FALLBACK_SCRATCH_ORG_INFO_PICKLISTS);
        }
      })
      .finally(() => {
        if (isCurrent) {
          setLoading(false);
        }
      });
    return () => {
      isCurrent = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [devHubOrg.uniqueId]);

  return { picklists, loading };
}
