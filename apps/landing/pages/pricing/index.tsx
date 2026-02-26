import { CheckIcon } from '@heroicons/react/20/solid';
import classNames from 'classnames';
import Link from 'next/link';
import { useState } from 'react';
import Layout from '../../components/layouts/Layout';
import { ROUTES } from '../../utils/environment';

const frequencies = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'annually', label: 'Annually' },
];

const tiers = [
  {
    name: 'Free',
    id: 'tier-free',
    href: '#',
    price: {
      monthly: {
        price: 'Free',
        suffix: 'forever',
      },
      annually: { price: 'Free', suffix: 'forever' },
    },
    description: 'Access to all core features.',
    features: [
      'Unlimited Salesforce Org Connections',
      'Query Builder',
      'Data Loader',
      'Metadata Tools',
      'Salesforce API Tools',
      'Developer Tools',
    ],
    mostPopular: false,
  },
  {
    name: 'Professional',
    id: 'tier-professional',
    href: '#',
    price: { monthly: { price: '$25', suffix: 'month' }, annually: { price: '$250', suffix: 'year' } },
    description: 'Perfect for individual users',
    features: [
      'Everything in Free plan',
      <Link href={ROUTES.DESKTOP} className="text-cyan-500 hover:underline">
        Desktop Application
      </Link>,
      <Link href={ROUTES.BROWSER_EXTENSIONS} className="text-cyan-500 hover:underline">
        Browser Extensions (Chrome & Firefox)
      </Link>,
      'Save query history across devices',
      'Save downloads to Google Drive',
      'Load data from Google Drive',
      'Priority support',
    ],
    mostPopular: true,
  },
  {
    name: 'Team',
    id: 'tier-team',
    href: '#',
    price: { monthly: { price: '$125', suffix: 'month' }, annually: { price: '$1,100', suffix: 'year' } },
    description: { monthly: `Includes 5 users ($25/user/month)`, annually: `Includes 5 users ($22/user/month)` },
    features: [
      'Everything in Professional',
      'Manage team members',
      'Up to 20 team members',
      'SSO via OIDC and SAML',
      'View & Manage team member session activity',
      'Role-based access control',
    ],
    comingSoonFeatures: ['SOC 2 compliance (in-progress)', 'Share orgs between team members', 'Audit logs'],
    mostPopular: false,
  },
  {
    name: 'Enterprise',
    id: 'tier-enterprise',
    href: 'mailto:sales@getjetstream.app?subject=Enterprise Plan Inquiry',
    price: { monthly: { price: 'Custom', suffix: null }, annually: { price: 'Custom', suffix: null } },
    description: 'Advanced features for large teams',
    features: [
      'Everything in Team',
      'Unlimited team members',
      'Custom agreements and terms',
      'Dedicated account manager',
      'White-glove onboarding',
    ],
    mostPopular: false,
    isEnterprise: true,
  },
];

export default function Page() {
  const [frequency, setFrequency] = useState(frequencies[0]);

  return (
    <div className="bg-gray-900 py-24 sm:pt-16 sm:pb-64">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="text-base/7 font-semibold text-cyan-500">Pricing</h2>
          <p className="mt-2 text-balance text-5xl font-semibold tracking-tight text-white sm:text-6xl">Simple Plans, No Surprises</p>
        </div>
        <p className="mx-auto mt-6 max-w-2xl text-pretty text-center text-lg font-medium text-gray-400 sm:text-xl/8">
          Find the perfect fit with our transparent pricing options.
        </p>
        <div className="mt-16 flex justify-center">
          <fieldset aria-label="Payment frequency">
            <div className="grid grid-cols-2 gap-x-1 rounded-full bg-white/5 p-1 text-center text-xs/5 font-semibold text-white">
              {frequencies.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setFrequency(option)}
                  className={classNames(
                    'cursor-pointer rounded-full px-2.5 py-1 transition-colors',
                    frequency.value === option.value ? 'bg-cyan-500' : 'hover:bg-white/10',
                  )}
                  role="radio"
                  aria-checked={frequency.value === option.value}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </fieldset>
        </div>
        <div className="isolate mx-auto mt-10 grid max-w-md grid-cols-1 gap-8 lg:mx-0 lg:max-w-none lg:grid-cols-2 xl:grid-cols-4">
          {tiers.map((tier) => (
            <div
              key={tier.id}
              className={classNames(
                tier.mostPopular ? 'bg-white/5 ring-2 ring-cyan-500' : 'ring-1 ring-white/10',
                'rounded-3xl p-8 xl:p-10',
              )}
            >
              <div className="flex items-center justify-between gap-x-4">
                <h3 id={tier.id} className="text-lg/8 font-semibold text-white">
                  {tier.name}
                </h3>
              </div>
              <p className="mt-4 text-sm/6 text-gray-300">
                {typeof tier.description === 'string' ? tier.description : tier.description[frequency.value]}
              </p>
              <p className="mt-6 flex items-baseline gap-x-1">
                <span className="text-4xl font-semibold tracking-tight text-white">{tier.price[frequency.value].price}</span>
                {tier.price[frequency.value]?.suffix && (
                  <span className="text-sm/6 font-semibold text-gray-300">{tier.price[frequency.value].suffix}</span>
                )}
              </p>
              <div className="mt-6 min-h-10">
                <Link
                  href={
                    tier.isEnterprise
                      ? tier.href
                      : `${ROUTES.AUTH.signup}?plan=${tier.name.toLowerCase()}&frequency=${frequency.value.toLowerCase()}`
                  }
                  aria-describedby={tier.id}
                  className={classNames(
                    tier.mostPopular
                      ? 'bg-cyan-500 text-white shadow-xs hover:bg-cyan-500 focus-visible:outline-cyan-500'
                      : 'bg-white/10 text-white hover:bg-white/20 focus-visible:outline-white',
                    'block rounded-md px-3 py-2 text-center text-sm/6 font-semibold focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2',
                  )}
                >
                  {tier.isEnterprise ? 'Contact Sales' : 'Start Free'}
                </Link>
              </div>
              <ul className="mt-8 space-y-3 text-sm/6 text-gray-300 xl:mt-10">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex gap-x-3">
                    <CheckIcon aria-hidden="true" className="h-6 w-5 flex-none text-white" />
                    {feature}
                  </li>
                ))}
              </ul>
              {tier.comingSoonFeatures && (
                <>
                  <p className="mt-6 text-sm/6 font-semibold text-gray-400 uppercase tracking-wide">Coming Soon</p>
                  <ul className="mt-3 space-y-3 text-sm/6 text-gray-400">
                    {tier.comingSoonFeatures.map((feature) => (
                      <li key={feature} className="flex gap-x-3">
                        <CheckIcon aria-hidden="true" className="h-6 w-5 flex-none text-gray-500" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

Page.getLayout = function getLayout(page) {
  return (
    <Layout title="Pricing | Jetstream" isInverse>
      {page}
    </Layout>
  );
};
