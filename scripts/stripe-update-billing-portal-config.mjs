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

console.log('Stripe Key', stripeKey.substring(0, 10) + '...');

// SANDBOX
const stripe = new Stripe(stripeKey);

// DEVELOPMENT IDS
const mainPortalId = 'bpc_1QidlsIN98MQf3Vtmratv2FR';
const proProductId = 'prod_RbrlX3GRZj1huZ';
const proPriceIds = ['price_1Qie2PIN98MQf3VtWrUynJYK', 'price_1Qie3AIN98MQf3VtQiWSjYAE'];

const teamBillingPortalId = 'bpc_1Qvi0pIN98MQf3Vtztyo6Yzu';
const teamProductId = 'prod_RpLgej2oORpkA9';
const teamPriceIds = ['price_1RwP6OIN98MQf3VtAe29t2s9', 'price_1RwP89IN98MQf3Vt5Mb0GjIB'];

const manualBillingPortalId = 'bpc_1RwngEIN98MQf3VtI1dOiBNi';

async function run() {
  console.log('Updating billing portal configurations...');

  // UPDATE STANDARD BILLING PORTAL
  await stripe.billingPortal.configurations.update(mainPortalId, {
    active: true,
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
      invoice_history: {
        enabled: true,
      },
      payment_method_update: {
        enabled: true,
      },
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
        ],
        proration_behavior: 'always_invoice',
        schedule_at_period_end: {
          conditions: [
            {
              type: 'decreasing_item_amount',
            },
            {
              type: 'shortening_interval',
            },
          ],
        },
      },
    },
    login_page: {
      enabled: false,
    },
    metadata: {
      type: 'USER',
    },
  });

  console.log('Updated main billing portal configuration');
  // UPDATE TEAM BILLING PORTAL
  await stripe.billingPortal.configurations.update(teamBillingPortalId, {
    active: true,
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
      invoice_history: {
        enabled: true,
      },
      payment_method_update: {
        enabled: true,
      },
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
          conditions: [
            {
              type: 'decreasing_item_amount',
            },
            {
              type: 'shortening_interval',
            },
          ],
        },
      },
    },
    login_page: {
      enabled: false,
    },
    metadata: {
      type: 'TEAM',
    },
  });

  console.log('Updated team billing portal configuration');
  // UPDATE MANUAL BILLING PORTAL
  await stripe.billingPortal.configurations.update(manualBillingPortalId, {
    active: true,
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
      invoice_history: {
        enabled: true,
      },
      payment_method_update: {
        enabled: true,
      },
      subscription_cancel: {
        enabled: false,
      },
      subscription_update: {
        enabled: false,
      },
    },
    login_page: {
      enabled: false,
    },
    metadata: {
      type: 'MANUAL',
    },
  });

  console.log('Updated manual billing portal configuration');

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

run().catch((err) => {
  console.error('Error updating billing portal configurations:', err);
});
