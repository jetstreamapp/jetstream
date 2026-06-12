/**
 * Customer-facing pricing copy shared by the Jetstream app billing page
 * (apps/jetstream/src/app/components/billing) and the landing site pricing page
 * (apps/landing/pages/pricing) so the two surfaces cannot drift apart.
 *
 * IMPORTANT: These are display values only — checkout charges whatever Stripe price
 * holds the corresponding lookup key, so any change here must ship together with
 * matching Stripe price configuration (and a server restart to bust the price cache).
 *
 * Feature lists that intentionally differ per surface (e.g. Professional and Enterprise,
 * where the landing page links to marketing pages) live with their respective pages.
 */
export const PRICING_COPY = {
  PRO: {
    description: 'Perfect for individual users',
    annualDescription: 'Save 2 months with annual billing',
    monthly: { pricePerMonth: '$25' },
    annual: { pricePerMonth: '$21' },
  },
  TEAM: {
    description: 'Per-user pricing — save with 6+ seats',
    monthly: {
      pricePerUserMonth: '$30',
      tiers: [
        { seats: '1–5', perUser: '$30/user/month' },
        { seats: '6+', perUser: '$25/user/month' },
      ],
    },
    annual: {
      pricePerUserMonth: '$25',
      tiers: [
        { seats: '1–5', perUser: '$25/user/month' },
        { seats: '6+', perUser: '$21/user/month' },
      ],
    },
    features: [
      'Everything in Professional',
      'Manage team members',
      'Unlimited team members',
      'SSO via OIDC and SAML',
      'View & Manage team member session activity',
      'Role-based access control',
    ],
    comingSoonFeatures: ['Share orgs between team members'],
  },
  ENTERPRISE: {
    description: 'SOC 2 compliance, custom terms, and dedicated support',
  },
} as const;
