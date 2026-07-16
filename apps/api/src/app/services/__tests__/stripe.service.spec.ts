import type Stripe from 'stripe';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// stripe.service instantiates a Stripe client and pulls in db/email modules at import — stub the config
// (no STRIPE_API_KEY → the client becomes an empty object) and email so the module loads in isolation.
vi.mock('@jetstream/api-config', () => ({
  ENV: {},
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
  prisma: {},
}));

vi.mock('@jetstream/email', () => ({
  sendWelcomeToProEmail: vi.fn(),
}));

// The db modules pull in the full data layer (and controllers that instantiate caches at import). Stub
// them — the pure resolver under test never touches them — so the module loads without that graph.
vi.mock('../../db/subscription.db', () => ({}));
vi.mock('../../db/team.db', () => ({}));
vi.mock('../../db/user.db', () => ({}));

const entitlement = (lookup_key: string) => ({ lookup_key }) as Stripe.Entitlements.ActiveEntitlement;

const NONE = {
  googleDrive: false,
  chromeExtension: false,
  recordSync: false,
  desktop: false,
  analysisTools: false,
  salesforceCanvas: false,
};

describe('resolveEntitlementAccessFromStripe', () => {
  let resolveEntitlementAccessFromStripe: typeof import('../stripe.service').resolveEntitlementAccessFromStripe;

  beforeEach(async () => {
    vi.resetModules();
    ({ resolveEntitlementAccessFromStripe } = await import('../stripe.service'));
  });

  it('grants analysisTools to paid (chromeExtension) customers even without a Stripe analysisTools key', () => {
    // This is the regression: the reducer seeds analysisTools:false and Stripe has no analysisTools
    // lookup_key, so without the derivation a paid customer's backfilled grant would be reset to false.
    const result = resolveEntitlementAccessFromStripe([entitlement('chromeExtension')]);
    expect(result.chromeExtension).toBe(true);
    expect(result.analysisTools).toBe(true);
  });

  it('does not grant analysisTools to customers with no paid entitlement', () => {
    expect(resolveEntitlementAccessFromStripe([])).toEqual(NONE);
  });

  it('keeps analysisTools true when Stripe returns it directly', () => {
    expect(resolveEntitlementAccessFromStripe([entitlement('analysisTools')]).analysisTools).toBe(true);
  });

  it('ignores unknown lookup_keys', () => {
    expect(resolveEntitlementAccessFromStripe([entitlement('somethingElse')])).toEqual(NONE);
  });

  it('preserves other entitlements alongside the derived analysisTools grant', () => {
    const result = resolveEntitlementAccessFromStripe([entitlement('chromeExtension'), entitlement('googleDrive')]);
    expect(result).toEqual({ ...NONE, chromeExtension: true, googleDrive: true, analysisTools: true });
  });
});
