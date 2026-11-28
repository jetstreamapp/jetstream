import type { DescribeSObjectResult } from '@jetstream/types';
import { describe, expect, it } from 'vitest';
import { FALLBACK_SCRATCH_ORG_INFO_PICKLISTS, getScratchOrgInfoPicklists } from '../scratch-org-picklists';

function picklistField(name: string, values: { value: string; label?: string; active?: boolean }[]) {
  return { name, picklistValues: values.map(({ value, label, active = true }) => ({ value, label: label ?? value, active })) };
}

function describeResult(fields: ReturnType<typeof picklistField>[]) {
  return { fields } as unknown as DescribeSObjectResult;
}

describe('getScratchOrgInfoPicklists', () => {
  it('uses the active values of the Dev Hub', () => {
    const picklists = getScratchOrgInfoPicklists(
      describeResult([
        picklistField('Edition', [{ value: 'Developer' }, { value: 'Group' }, { value: 'Retired', active: false }]),
        picklistField('Release', [{ value: 'Current' }, { value: 'Preview' }, { value: 'SomethingNew' }]),
        picklistField('Language', [
          { value: 'en_US', label: 'English' },
          { value: 'de', label: 'German' },
        ]),
      ]),
    );

    expect(picklists).toEqual({
      editions: ['Developer', 'Group'],
      releases: ['Current', 'Preview'],
      languages: [
        { value: 'en_US', label: 'English' },
        { value: 'de', label: 'German' },
      ],
    });
  });

  it('falls back to the documented values for a picklist that is missing or empty', () => {
    expect(getScratchOrgInfoPicklists(describeResult([picklistField('Edition', [])]))).toEqual(FALLBACK_SCRATCH_ORG_INFO_PICKLISTS);
  });
});
