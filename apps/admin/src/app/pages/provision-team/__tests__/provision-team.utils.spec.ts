import { describe, expect, it } from 'vitest';
import { buildProvisionRequest, DEFAULT_ENTITLEMENTS, INITIAL_TEAM_FORM } from '../provision-team.utils';

const CUSTOMER_ID = 'cus_TestCustomer123';

describe('buildProvisionRequest', () => {
  it('builds a Stripe-billed request without entitlements', () => {
    const { request, errors } = buildProvisionRequest({
      customerId: CUSTOMER_ID,
      quoteId: 'qt_TestQuote123',
      form: { ...INITIAL_TEAM_FORM, name: '  Acme  ', licenseCountLimit: '10' },
    });

    expect(errors).toEqual({});
    expect(request).toMatchObject({
      customerId: CUSTOMER_ID,
      quoteId: 'qt_TestQuote123',
      name: 'Acme',
      billingMode: 'STRIPE',
      licenseCountLimit: 10,
      entitlements: null,
    });
  });

  it('treats an empty seat limit as uncapped for Stripe billing', () => {
    const { request } = buildProvisionRequest({ customerId: CUSTOMER_ID, quoteId: null, form: { ...INITIAL_TEAM_FORM, name: 'Acme' } });

    expect(request?.licenseCountLimit).toBeNull();
  });

  it('requires a seat limit for manual billing', () => {
    const { request, errors } = buildProvisionRequest({
      customerId: CUSTOMER_ID,
      quoteId: null,
      form: { ...INITIAL_TEAM_FORM, name: 'Acme', billingMode: 'MANUAL' },
    });

    expect(request).toBeNull();
    expect(errors.licenseCountLimit).toBeTruthy();
  });

  it('sends entitlements only for manual billing', () => {
    const entitlements = { ...DEFAULT_ENTITLEMENTS, chromeExtension: true };
    const { request } = buildProvisionRequest({
      customerId: CUSTOMER_ID,
      quoteId: null,
      form: { name: 'Acme', billingMode: 'MANUAL', licenseCountLimit: '5', entitlements },
    });

    expect(request?.entitlements).toEqual(entitlements);
  });

  it('reports a missing team name', () => {
    const { request, errors } = buildProvisionRequest({ customerId: CUSTOMER_ID, quoteId: null, form: INITIAL_TEAM_FORM });

    expect(request).toBeNull();
    expect(errors.name).toBeTruthy();
  });
});
