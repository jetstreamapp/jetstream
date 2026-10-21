import { describe, expect, it } from 'vitest';
import { UpdateStripeCustomerProductionOrgIdRequestSchema } from '../admin-stripe.types';

describe('UpdateStripeCustomerProductionOrgIdRequestSchema', () => {
  it.each([
    ['00D000000000000', '00D000000000000'],
    ['00D5e000000AbCdEAA', '00D5e000000AbCdEAA'],
    ['  00D5e000000AbCdEAA  ', '00D5e000000AbCdEAA'],
  ])('accepts the org id %j', (input, expected) => {
    expect(UpdateStripeCustomerProductionOrgIdRequestSchema.parse({ productionOrgId: input })).toEqual({ productionOrgId: expected });
  });

  it.each([null, '', '   '])('treats %j as clearing the value', (input) => {
    expect(UpdateStripeCustomerProductionOrgIdRequestSchema.parse({ productionOrgId: input })).toEqual({ productionOrgId: null });
  });

  it.each(['abc', '00D5e000000AbCdE', '001000000000000', '00D000000000000AAAA'])('rejects %j', (input) => {
    const result = UpdateStripeCustomerProductionOrgIdRequestSchema.safeParse({ productionOrgId: input });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain('Salesforce org id');
    }
  });
});
