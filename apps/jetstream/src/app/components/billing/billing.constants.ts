import { PRICING_COPY } from '@jetstream/shared/constants';
import { StripeUserFacingSubscription } from '@jetstream/types';

export const ACTIVE_SUBSCRIPTION_STATUSES = new Set<StripeUserFacingSubscription['status']>([
  'ACTIVE',
  'PAST_DUE',
  'TRIALING',
  'PAUSED',
  'UNPAID',
]);
export const PAST_DUE_SUBSCRIPTION_STATUSES = new Set<StripeUserFacingSubscription['status']>(['PAST_DUE']);
export const UNPAID_SUBSCRIPTION_STATUSES = new Set<StripeUserFacingSubscription['status']>(['UNPAID']);

export const PRO_MONTHLY_KEY = 'PRO_MONTHLY';
export const PRO_ANNUAL_KEY = 'PRO_ANNUAL';
export const TEAM_MONTHLY_KEY = 'TEAM_MONTHLY';
export const TEAM_ANNUAL_KEY = 'TEAM_ANNUAL';

export const professionalFeatures = [
  'Desktop Application',
  'Browser Extensions (Chrome & Firefox)',
  'Save query history across devices',
  'Save downloads to Google Drive',
  'Load data from Google Drive',
  'Priority support',
];

export const teamFeatures = PRICING_COPY.TEAM.features;

export const teamFeaturesComingSoon = PRICING_COPY.TEAM.comingSoonFeatures;

export const enterpriseFeatures = [
  'Everything in Team',
  'SOC 2 Type II compliance',
  'Audit logs',
  'Single Sign-On (SSO)',
  'Custom agreements and terms',
  'Dedicated account manager',
  'Advanced security controls',
  'White-glove onboarding',
];

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
    comingSoonFeatures: teamFeaturesComingSoon,
  },
  [TEAM_ANNUAL_KEY]: {
    key: 'TEAM_ANNUAL',
    price: PRICING_COPY.TEAM.annual.pricePerUserMonth,
    priceSubtext: '/user/month, billed annually',
    description: PRICING_COPY.TEAM.description,
    pricingTiers: PRICING_COPY.TEAM.annual.tiers,
    features: teamFeatures,
    comingSoonFeatures: teamFeaturesComingSoon,
  },
  CUSTOM: {
    key: 'CUSTOM',
    price: 'Custom',
    priceSubtext: 'Contact us',
    description: PRICING_COPY.ENTERPRISE.description,
    features: enterpriseFeatures,
  },
} as const;
