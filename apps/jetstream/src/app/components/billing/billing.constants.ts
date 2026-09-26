import { PRICING_COPY } from '@jetstream/shared/constants';
import { StripeUserFacingSubscription } from '@jetstream/types';

export const ACTIVE_SUBSCRIPTION_STATUSES: Set<StripeUserFacingSubscription['status']> = new Set([
  'ACTIVE',
  'PAST_DUE',
  'TRIALING',
  'PAUSED',
  'UNPAID',
]);
export const PAST_DUE_SUBSCRIPTION_STATUSES: Set<StripeUserFacingSubscription['status']> = new Set(['PAST_DUE']);
export const UNPAID_SUBSCRIPTION_STATUSES: Set<StripeUserFacingSubscription['status']> = new Set(['UNPAID']);

export const PRO_MONTHLY_KEY = 'PRO_MONTHLY';
export const PRO_ANNUAL_KEY = 'PRO_ANNUAL';
export const TEAM_MONTHLY_KEY = 'TEAM_MONTHLY';
export const TEAM_ANNUAL_KEY = 'TEAM_ANNUAL';

export const professionalFeatures = [
  'Permission Analysis: audit profiles and permission sets',
  'Field Usage Analysis: find unused fields',
  'Desktop Application',
  'Browser Extensions (Chrome & Firefox)',
  'Save query history across devices',
  'Save downloads to Google Drive',
  'Load data from Google Drive',
  'Priority support',
];

export const teamFeatures = PRICING_COPY.TEAM.features;

export const enterpriseFeatures = PRICING_COPY.ENTERPRISE.features;

export const PLAN_DESCRIPTIONS = {
  [PRO_MONTHLY_KEY]: {
    key: 'PRO_MONTHLY',
    price: PRICING_COPY.PRO.monthly.pricePerMonth,
    priceSubtext: '/month',
    description: PRICING_COPY.PRO.description,
    features: professionalFeatures,
  },
  [PRO_ANNUAL_KEY]: {
    key: 'PRO_ANNUAL',
    price: PRICING_COPY.PRO.annual.pricePerMonth,
    priceSubtext: '/month, billed annually',
    description: PRICING_COPY.PRO.annualDescription,
    features: professionalFeatures,
  },
  [TEAM_MONTHLY_KEY]: {
    key: 'TEAM_MONTHLY',
    price: PRICING_COPY.TEAM.monthly.pricePerUserMonth,
    priceSubtext: '/user/month',
    description: PRICING_COPY.TEAM.description,
    pricingTiers: PRICING_COPY.TEAM.monthly.tiers,
    features: teamFeatures,
  },
  [TEAM_ANNUAL_KEY]: {
    key: 'TEAM_ANNUAL',
    price: PRICING_COPY.TEAM.annual.pricePerUserMonth,
    priceSubtext: '/user/month, billed annually',
    description: PRICING_COPY.TEAM.description,
    pricingTiers: PRICING_COPY.TEAM.annual.tiers,
    features: teamFeatures,
  },
  CUSTOM: {
    key: 'CUSTOM',
    price: PRICING_COPY.ENTERPRISE.price,
    priceSubtext: PRICING_COPY.ENTERPRISE.priceNote,
    description: PRICING_COPY.ENTERPRISE.description,
    features: enterpriseFeatures,
  },
} as const;
