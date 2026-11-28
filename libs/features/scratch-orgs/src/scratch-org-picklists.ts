import { SCRATCH_ORG_EDITIONS, SCRATCH_ORG_RELEASES } from '@jetstream/api-types';
import type { DescribeSObjectResult } from '@jetstream/types';

export interface ScratchOrgPicklistValue {
  value: string;
  label: string;
}

/** Values the Dev Hub accepts on ScratchOrgInfo, they differ per Dev Hub (e.g. only partner orgs have the partner editions) */
export interface ScratchOrgInfoPicklists {
  editions: string[];
  releases: string[];
  /** null when the Dev Hub did not tell us, the language is then entered as text */
  languages: ScratchOrgPicklistValue[] | null;
}

/** Used until the Dev Hub has been described, and when describing it fails */
export const FALLBACK_SCRATCH_ORG_INFO_PICKLISTS: ScratchOrgInfoPicklists = {
  editions: [...SCRATCH_ORG_EDITIONS],
  releases: [...SCRATCH_ORG_RELEASES],
  languages: null,
};

function getActivePicklistValues({ fields }: DescribeSObjectResult, fieldName: string): ScratchOrgPicklistValue[] {
  return (fields.find(({ name }) => name === fieldName)?.picklistValues ?? [])
    .filter(({ active }) => active)
    .map(({ value, label }) => ({ value, label: label || value }));
}

/**
 * Read the picklists of the create form from the Dev Hub's ScratchOrgInfo describe.
 * A picklist the Dev Hub does not return falls back to what Salesforce documents.
 */
export function getScratchOrgInfoPicklists(describe: DescribeSObjectResult): ScratchOrgInfoPicklists {
  const editions = getActivePicklistValues(describe, 'Edition').map(({ value }) => value);
  const describedReleases = new Set(getActivePicklistValues(describe, 'Release').map(({ value }) => value));
  // The api only accepts the releases it knows, so a release Salesforce adds later is not offered until it does
  const releases = SCRATCH_ORG_RELEASES.filter((release) => describedReleases.has(release));
  const languages = getActivePicklistValues(describe, 'Language');
  return {
    editions: editions.length ? editions : FALLBACK_SCRATCH_ORG_INFO_PICKLISTS.editions,
    releases: releases.length ? releases : FALLBACK_SCRATCH_ORG_INFO_PICKLISTS.releases,
    languages: languages.length ? languages : null,
  };
}
