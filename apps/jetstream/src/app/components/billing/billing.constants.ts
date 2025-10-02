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
  'Up to 20 team members',
  'View & Manage team member session activity',
  'Role-based access control',
];

export const teamFeaturesComingSoon = ['SOC 2', 'SSO via Okta', 'Share orgs between team members', 'Audit logs'];

export const enterpriseFeatures = [
  'Everything in Team',
  'Unlimited team members',
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
    price: '$250',
    priceSubtext: '/year',
    description: 'Save 2 months with annual billing',
    features: professionalFeatures,
  },
  [TEAM_MONTHLY_KEY]: {
    key: 'TEAM_MONTHLY',
    price: '$125',
    priceSubtext: '/month (includes 5 users)',
    description: '$25/user/month with 5-user minimum',
    features: teamFeatures,
    comingSoonFeatures: teamFeaturesComingSoon,
  },
  [TEAM_ANNUAL_KEY]: {
    key: 'TEAM_ANNUAL',
    price: '$1,100',
    priceSubtext: '/year (includes 5 users)',
    description: '$220/user/year with 5-user minimum',
    features: teamFeatures,
    comingSoonFeatures: teamFeaturesComingSoon,
  },
  CUSTOM: {
    key: 'CUSTOM',
    price: 'Custom',
    priceSubtext: 'Contact us',
    description: 'Advanced features for large teams',
    features: enterpriseFeatures,
  },
} as const;
