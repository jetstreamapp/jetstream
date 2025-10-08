#!/usr/bin/env node
import 'dotenv/config';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Stripe from 'stripe';

const stripeKey = process.env.STRIPE_API_KEY;

if (!stripeKey) {
  throw new Error('No STRIPE_API_KEY found in env vars');
}

// SANDBOX
const stripe = new Stripe(stripeKey);

async function run() {
  console.log('Updating billing portal configurations...');

  const pricesByLookupKey = await stripe.prices
    .list({ lookup_keys: ['TEAM_ANNUAL', 'TEAM_MONTHLY', 'PRO_ANNUAL', 'PRO_MONTHLY'], expand: ['data.product'] })
    .then((res) => {
      return res.data.reduce((acc, price) => {
        if (price.lookup_key) {
          acc[price.lookup_key] = price;
        }
        return acc;
      }, {});
    });

  const teamProductId = pricesByLookupKey['TEAM_ANNUAL']?.product?.id;
  const teamPriceIds = [pricesByLookupKey['TEAM_ANNUAL']?.id, pricesByLookupKey['TEAM_MONTHLY']?.id].filter(Boolean);

  const proProductId = pricesByLookupKey['PRO_ANNUAL']?.product?.id;
  const proPriceIds = [pricesByLookupKey['PRO_ANNUAL']?.id, pricesByLookupKey['PRO_MONTHLY']?.id].filter(Boolean);

  if (!teamProductId || teamPriceIds.length !== 2) {
    throw new Error('No team product or price IDs found');
  }

  if (!proProductId || proPriceIds.length !== 2) {
    throw new Error('No pro product or price IDs found');
  }

  const portals = await stripe.billingPortal.configurations.list({ active: true, expand: ['data.features.subscription_update.products'] });

  let defaultBillingPortal = portals.data.find((portal) => portal.is_default && portal.active);
  let teamBillingPortal = portals.data.find((portal) => portal.metadata?.type === 'TEAM');
  let manualBillingPortal = portals.data.find((portal) => portal.metadata?.type === 'MANUAL');

  // UPDATE STANDARD BILLING PORTAL
  if (!defaultBillingPortal?.id) {
    throw new Error('No default billing portal found');
  }

  defaultBillingPortal = await upsertProBillingPortal(defaultBillingPortal?.id, proPriceIds, proProductId, teamPriceIds, teamProductId);
  console.log('Updated main billing portal configuration', defaultBillingPortal.id);

  teamBillingPortal = await upsertTeamBillingPortal(teamBillingPortal?.id, teamPriceIds, teamProductId);
  console.log('Updated team billing portal configuration', teamBillingPortal.id);

  manualBillingPortal = await upsertManualBillingPortal(manualBillingPortal?.id);
  console.log('Updated manual billing portal configuration', manualBillingPortal.id);

  const billingPortalConfig = await stripe.billingPortal.configurations.list({
    expand: ['data.features.subscription_update.products'],
  });
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const filename = join(__dirname, '../tmp/billing-portal-config.json');
  writeFileSync(filename, JSON.stringify(billingPortalConfig, null, 2));
  writeFileSync(filename, JSON.stringify(billingPortalConfig, null, 2));

  console.log(`Saved billing portal config to ${filename}`);
}

/**
 * Upsert the team billing portal configuration.
 * @param {string | undefined} existingPortalId
 * @param {string[]} proPriceIds
 * @param {string} proProductId
 * @param {string[]} teamPriceIds
 * @param {string} teamProductId
 */
async function upsertProBillingPortal(existingPortalId, proPriceIds, proProductId, teamPriceIds, teamProductId) {
  /**
   * @type {Parameters<typeof stripe.billingPortal.configurations.create>[0]}
   */
  const config = {
    // active: true,
    business_profile: {
      headline: 'Jetstream partners with Stripe for billing',
      privacy_policy_url: 'https://getjetstream.app/privacy/',
      terms_of_service_url: 'https://getjetstream.app/terms-of-service/',
    },
    default_return_url: null,
    features: {
      customer_update: {
        allowed_updates: ['name', 'email', 'address', 'shipping', 'phone'],
        enabled: true,
      },
      invoice_history: { enabled: true },
      payment_method_update: { enabled: true },
      subscription_cancel: {
        cancellation_reason: {
          enabled: true,
          options: ['too_expensive', 'switched_service', 'unused', 'other'],
        },
        enabled: true,
        mode: 'at_period_end',
        proration_behavior: 'none',
      },
      subscription_update: {
        default_allowed_updates: ['price', 'promotion_code'],
        enabled: true,
        products: [
          {
            prices: proPriceIds,
            product: proProductId,
          },
          {
            prices: teamPriceIds,
            product: teamProductId,
          },
        ],
        proration_behavior: 'always_invoice',
        schedule_at_period_end: {
          conditions: [{ type: 'decreasing_item_amount' }, { type: 'shortening_interval' }],
        },
      },
    },
    login_page: { enabled: false },
    metadata: {
      type: 'USER',
    },
  };

  if (existingPortalId) {
    await stripe.billingPortal.configurations.update(existingPortalId, config);
  } else {
    const newPortal = await stripe.billingPortal.configurations.create(config);
    existingPortalId = newPortal.id;
  }

  // make sure the portal is active (not sure if they create as active since that property is not allowed)
  return await stripe.billingPortal.configurations.update(existingPortalId, { active: true });
}

/**
 * Upsert the team billing portal configuration.
 * @param {string | undefined} existingPortalId
 * @param {string[]} teamPriceIds
 * @param {string} teamProductId
 */
async function upsertTeamBillingPortal(existingPortalId, teamPriceIds, teamProductId) {
  /**
   * @type {Parameters<typeof stripe.billingPortal.configurations.create>[0]}
   */
  const config = {
    // active: true,
    business_profile: {
      headline: 'Jetstream partners with Stripe for billing',
      privacy_policy_url: 'https://getjetstream.app/privacy/',
      terms_of_service_url: 'https://getjetstream.app/terms-of-service/',
    },
    default_return_url: null,
    features: {
      customer_update: {
        allowed_updates: ['name', 'email', 'address', 'shipping', 'phone'],
        enabled: true,
      },
      invoice_history: { enabled: true },
      payment_method_update: { enabled: true },
      // Disabled for now - we need to figure out the cancellation flow for teams
      subscription_cancel: { enabled: false },
      subscription_update: {
        default_allowed_updates: ['price', 'promotion_code'],
        enabled: true,
        products: [
          {
            prices: teamPriceIds,
            product: teamProductId,
          },
        ],
        proration_behavior: 'always_invoice',
        schedule_at_period_end: {
          conditions: [{ type: 'decreasing_item_amount' }, { type: 'shortening_interval' }],
        },
      },
    },
    login_page: { enabled: false },
    metadata: {
      type: 'TEAM',
    },
  };

  if (existingPortalId) {
    await stripe.billingPortal.configurations.update(existingPortalId, config);
  } else {
    const newPortal = await stripe.billingPortal.configurations.create(config);
    existingPortalId = newPortal.id;
  }

  // make sure the portal is active (not sure if they create as active since that property is not allowed)
  return await stripe.billingPortal.configurations.update(existingPortalId, { active: true });
}

/**
 * Upsert the team billing portal configuration.
 * @param {string | undefined} existingPortalId
 */
async function upsertManualBillingPortal(existingPortalId) {
  /**
   * @type {Parameters<typeof stripe.billingPortal.configurations.create>[0]}
   */
  const config = {
    // active: true,
    business_profile: {
      headline: 'Jetstream partners with Stripe for billing',
      privacy_policy_url: 'https://getjetstream.app/privacy/',
      terms_of_service_url: 'https://getjetstream.app/terms-of-service/',
    },
    default_return_url: null,
    features: {
      customer_update: {
        allowed_updates: ['name', 'email', 'address', 'shipping', 'phone'],
        enabled: true,
      },
      invoice_history: { enabled: true },
      payment_method_update: { enabled: true },
      // Disabled for now - we need to figure out the cancellation flow for teams
      subscription_cancel: {
        cancellation_reason: {
          enabled: true,
          options: ['too_expensive', 'switched_service', 'unused', 'other'],
        },
        enabled: false,
        mode: 'at_period_end',
        proration_behavior: 'none',
      },
      subscription_update: { enabled: false },
    },
    login_page: { enabled: false },
    metadata: {
      type: 'MANUAL',
    },
  };

  if (existingPortalId) {
    await stripe.billingPortal.configurations.update(existingPortalId, config);
  } else {
    const newPortal = await stripe.billingPortal.configurations.create(config);
    existingPortalId = newPortal.id;
  }

  // make sure the portal is active
  return await stripe.billingPortal.configurations.update(existingPortalId, { active: true });
}

run().catch((err) => {
  console.error('Error updating billing portal configurations:', err);
});
