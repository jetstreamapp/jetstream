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

export const teamFeatures = [
  'Everything in Professional',
  'Manage team members',
  'Unlimited team members',
  'SSO via OIDC and SAML',
  'View & Manage team member session activity',
  'Role-based access control',
];

export const teamFeaturesComingSoon = ['Share orgs between team members'];

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
    price: '$25',
    priceSubtext: '/month',
    description: 'Perfect for individual users',
    features: professionalFeatures,
  },
  [PRO_ANNUAL_KEY]: {
    key: 'PRO_ANNUAL',
    price: '$21',
    priceSubtext: '/month, billed annually',
    description: 'Save 2 months with annual billing',
    features: professionalFeatures,
  },
  [TEAM_MONTHLY_KEY]: {
    key: 'TEAM_MONTHLY',
    price: '$30',
    priceSubtext: '/user/month',
    description: 'Per-user pricing — save with 6+ seats',
    pricingTiers: [
      { seats: '1–5', perUser: '$30/user/month' },
      { seats: '6+', perUser: '$25/user/month' },
    ],
    features: teamFeatures,
    comingSoonFeatures: teamFeaturesComingSoon,
  },
  [TEAM_ANNUAL_KEY]: {
    key: 'TEAM_ANNUAL',
    price: '$25',
    priceSubtext: '/user/month, billed annually',
    description: 'Per-user pricing — save with 6+ seats',
    pricingTiers: [
      { seats: '1–5', perUser: '$25/user/month' },
      { seats: '6+', perUser: '$21/user/month' },
    ],
    features: teamFeatures,
    comingSoonFeatures: teamFeaturesComingSoon,
  },
  CUSTOM: {
    key: 'CUSTOM',
    price: 'Custom',
    priceSubtext: 'Contact us',
    description: 'SOC 2 compliance, custom terms, and dedicated support',
    features: enterpriseFeatures,
  },
} as const;
