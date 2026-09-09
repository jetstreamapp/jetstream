/**
 * Customer-facing pricing copy shared by the Jetstream app billing page
 * (apps/jetstream/src/app/components/billing) and the landing site pricing page
 * (apps/landing/pages/pricing) so the two surfaces cannot drift apart.
 *
 * IMPORTANT: These are display values only — checkout charges whatever Stripe price
 * holds the corresponding lookup key, so any change here must ship together with
 * matching Stripe price configuration (and a server restart to bust the price cache).
 *
 * Feature lists that intentionally differ per surface (e.g. Professional, where the landing
 * page links to marketing pages) live with their respective pages.
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
      'SOC 2 Type II report available under NDA',
    ],
  },
  /**
   * Enterprise is not a separate product tier: it is the negotiated procurement path for
   * organizations that need custom contracts or a formal vendor review, priced at Team rates
   * plus a fee when a custom agreement is required.
   */
  ENTERPRISE: {
    description: 'For organizations that need custom contracts or a formal vendor review',
    price: 'Custom',
    priceNote: 'Team pricing, plus $1,000/yr for custom agreements',
    features: [
      'Everything in Team',
      'Custom agreements and redlines',
      'Security questionnaire and vendor review support',
      'Invoice or purchase order billing',
      'Named point of contact',
    ],
  },
} as const;
