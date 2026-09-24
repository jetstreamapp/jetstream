import { beforeEach, describe, expect, it, vi } from 'vitest';
import type * as StripeService from '../stripe.service';

const PRODUCTION_ORG_ID = '00D5e000000HEcBEAW';

const mocks = vi.hoisted(() => ({
  sessionsCreate: vi.fn(async (_params: Record<string, any>) => ({ id: 'cs_1', url: 'https://checkout.stripe.test/cs_1' })),
  sessionsRetrieve: vi.fn(),
  customersRetrieve: vi.fn(),
  customersSearch: vi.fn(async () => ({ data: [] as unknown[] })),
  customersCreate: vi.fn(async (_params: Record<string, any>) => ({ id: 'cus_new', metadata: {} as Record<string, string> })),
  customersUpdate: vi.fn(async (customerId: string, params: Record<string, any>) => ({
    id: customerId,
    metadata: { ...params?.metadata },
  })),
  loggerWarn: vi.fn(),
}));

vi.mock('stripe', () => ({
  default: class {
    checkout = { sessions: { create: mocks.sessionsCreate, retrieve: mocks.sessionsRetrieve } };
    customers = {
      retrieve: mocks.customersRetrieve,
      update: mocks.customersUpdate,
      createFundingInstructions: vi.fn(async () => ({})),
      search: mocks.customersSearch,
      create: mocks.customersCreate,
    };
    entitlements = { activeEntitlements: { list: vi.fn(async () => ({ data: [] })) } };
  },
}));

vi.mock('@jetstream/api-config', () => ({
  ENV: { STRIPE_API_KEY: 'sk_test_x', JETSTREAM_SERVER_URL: 'https://jetstream.test' },
  logger: { error: vi.fn(), warn: mocks.loggerWarn, info: vi.fn(), debug: vi.fn() },
  prisma: {},
}));
vi.mock('@jetstream/email', () => ({ sendWelcomeToProEmail: vi.fn(async () => undefined) }));

vi.mock('../../db/subscription.db', () => ({
  updateSubscriptionStateForCustomer: vi.fn(async () => ({})),
  updateUserEntitlements: vi.fn(async () => ({})),
}));
vi.mock('../../db/team.db', () => ({}));
vi.mock('../../db/user.db', () => ({
  findById: vi.fn(async () => ({ id: 'user_1', billingAccount: { customerId: 'cus_1' } })),
  claimBillingAccountForCustomer: vi.fn(async () => true),
  findBillingAccountWithSubscriptionsByUserId: vi.fn(async () => null),
  findBillingAccountByCustomerId: vi.fn(),
}));

const completedSession = (customFields: { key: string; text: { value: string | null } }[]) => ({
  id: 'cs_1',
  customer: 'cus_1',
  client_reference_id: 'user_1',
  metadata: { userId: 'user_1', type: 'USER' },
  subscription: { id: 'sub_1', items: { data: [{ price: { lookup_key: 'PRO_MONTHLY' } }] } },
  custom_fields: customFields,
});

describe('production org id collected at checkout', () => {
  let stripeService: typeof StripeService;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    mocks.customersRetrieve.mockResolvedValue({
      id: 'cus_1',
      metadata: { userId: 'user_1', type: 'USER' },
      subscriptions: { object: 'list', data: [] },
    });
    stripeService = await import('../stripe.service');
  });

  const customerWithMetadata = (metadata: Record<string, string>) => ({
    id: 'cus_1',
    metadata: { userId: 'user_1', type: 'USER', ...metadata },
    subscriptions: { object: 'list', data: [] },
  });

  const createSession = (productionOrgId?: string | null, { isNewCustomer = false } = {}) =>
    stripeService.createCheckoutSession({
      customerId: isNewCustomer ? undefined : 'cus_1',
      mode: 'subscription',
      priceId: 'price_1',
      user: { id: 'user_1', name: 'Test User', email: 'test@example.com' },
      type: 'USER',
      productionOrgId,
    });

  it('asks for the production org id as a required field within the label limit', async () => {
    await createSession();

    const [{ custom_fields: customFields, custom_text: customText }] = mocks.sessionsCreate.mock.calls[0];
    expect(customFields).toHaveLength(1);
    expect(customFields[0]).toMatchObject({ key: 'productionOrgId', type: 'text', optional: false });
    expect(customFields[0].text).toMatchObject({ minimum_length: 15, maximum_length: 18 });
    // Stripe rejects the session when these limits are exceeded
    expect(customFields[0].label.custom.length).toBeLessThanOrEqual(50);
    expect(customText.submit.message.length).toBeLessThanOrEqual(1200);
  });

  it('pre-fills the field with the production org found on the account', async () => {
    await createSession(PRODUCTION_ORG_ID);

    const [{ custom_fields: customFields }] = mocks.sessionsCreate.mock.calls[0];
    expect(customFields[0].text.default_value).toBe(PRODUCTION_ORG_ID);
  });

  it.each([null, undefined, '', 'not-an-org-id', '0015e000000HEcBEAW'])('leaves the field blank for %j', async (productionOrgId) => {
    await createSession(productionOrgId);

    const [{ custom_fields: customFields }] = mocks.sessionsCreate.mock.calls[0];
    expect(customFields[0].text.default_value).toBeUndefined();
  });

  it('does not ask a returning customer who already has an org id on file', async () => {
    mocks.customersRetrieve.mockResolvedValue(customerWithMetadata({ productionOrgId: PRODUCTION_ORG_ID }));

    await createSession('00D7F000001aBcDUAU');

    const [sessionParams] = mocks.sessionsCreate.mock.calls[0];
    expect(sessionParams).not.toHaveProperty('custom_fields');
    expect(sessionParams).not.toHaveProperty('custom_text');
  });

  it('asks a returning customer again when the org id on file is not a valid org id', async () => {
    mocks.customersRetrieve.mockResolvedValue(customerWithMetadata({ productionOrgId: 'aaaaaaaaaaaaaaa' }));

    await createSession();

    const [{ custom_fields: customFields }] = mocks.sessionsCreate.mock.calls[0];
    expect(customFields[0].key).toBe('productionOrgId');
  });

  it('still creates the session, and asks, when the org id on file cannot be looked up', async () => {
    mocks.customersRetrieve.mockRejectedValue(new Error('Stripe is unavailable'));

    await createSession(PRODUCTION_ORG_ID);

    const [{ custom_fields: customFields }] = mocks.sessionsCreate.mock.calls[0];
    expect(customFields[0].key).toBe('productionOrgId');
    expect(mocks.loggerWarn).toHaveBeenCalled();
  });

  it('asks a brand new customer without looking anything up', async () => {
    await createSession(PRODUCTION_ORG_ID, { isNewCustomer: true });

    const [{ customer, custom_fields: customFields }] = mocks.sessionsCreate.mock.calls[0];
    expect(customer).toBe('cus_new');
    expect(customFields[0].text.default_value).toBe(PRODUCTION_ORG_ID);
    expect(mocks.customersRetrieve).not.toHaveBeenCalled();
  });

  it('does not ask when the customer resolved for checkout already has an org id on file', async () => {
    const existingCustomer = { ...customerWithMetadata({ productionOrgId: PRODUCTION_ORG_ID }), id: 'cus_existing' };
    mocks.customersSearch.mockResolvedValueOnce({ data: [existingCustomer] });
    // Stripe returns the whole customer from an update, metadata included
    mocks.customersUpdate.mockResolvedValueOnce(existingCustomer);

    await createSession(undefined, { isNewCustomer: true });

    const [sessionParams] = mocks.sessionsCreate.mock.calls[0];
    expect(sessionParams).not.toHaveProperty('custom_fields');
    expect(mocks.customersRetrieve).not.toHaveBeenCalled();
  });

  it('saves the entered org id on the stripe customer', async () => {
    mocks.sessionsRetrieve.mockResolvedValue(completedSession([{ key: 'productionOrgId', text: { value: ` ${PRODUCTION_ORG_ID} ` } }]));

    await stripeService.saveSubscriptionFromCompletedSession({ sessionId: 'cs_1' });

    expect(mocks.customersUpdate).toHaveBeenCalledWith('cus_1', {
      metadata: { userId: 'user_1', teamId: null, type: 'USER', productionOrgId: PRODUCTION_ORG_ID },
    });
    expect(mocks.loggerWarn).not.toHaveBeenCalled();
  });

  it('keeps an entry that does not look like an org id, and flags it', async () => {
    mocks.sessionsRetrieve.mockResolvedValue(completedSession([{ key: 'productionOrgId', text: { value: 'aaaaaaaaaaaaaaa' } }]));

    await stripeService.saveSubscriptionFromCompletedSession({ sessionId: 'cs_1' });

    expect(mocks.customersUpdate).toHaveBeenCalledWith('cus_1', {
      metadata: expect.objectContaining({ productionOrgId: 'aaaaaaaaaaaaaaa' }),
    });
    expect(mocks.loggerWarn).toHaveBeenCalledWith(expect.objectContaining({ productionOrgId: 'aaaaaaaaaaaaaaa' }), expect.any(String));
  });

  it('flags an entry of only spaces without clearing a previously collected org id', async () => {
    mocks.sessionsRetrieve.mockResolvedValue(completedSession([{ key: 'productionOrgId', text: { value: ' '.repeat(15) } }]));

    await stripeService.saveSubscriptionFromCompletedSession({ sessionId: 'cs_1' });

    const [, { metadata }] = mocks.customersUpdate.mock.calls[0];
    expect(metadata.productionOrgId).toBeUndefined();
    expect(mocks.loggerWarn).toHaveBeenCalledWith(expect.objectContaining({ sessionId: 'cs_1', productionOrgId: '' }), expect.any(String));
  });

  it('does not clear a previously collected org id when the session has none', async () => {
    mocks.sessionsRetrieve.mockResolvedValue(completedSession([]));

    await stripeService.saveSubscriptionFromCompletedSession({ sessionId: 'cs_1' });

    const [, { metadata }] = mocks.customersUpdate.mock.calls[0];
    expect(metadata).toEqual({ userId: 'user_1', teamId: null, type: 'USER' });
    // `toEqual` ignores undefined keys, while a null would be sent to Stripe and clear the stored value
    expect(metadata.productionOrgId).toBeUndefined();
  });
});
