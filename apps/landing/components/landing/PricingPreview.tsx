import { CheckIcon } from '@heroicons/react/20/solid';
import classNames from 'classnames';
import Link from 'next/link';
import { ROUTES } from '../../utils/environment';
import { PRICING_TIERS } from './landing-page-data';

export const PricingPreview = () => (
  <section>
    <div className="mx-auto max-w-7xl px-6 py-24 sm:py-32 lg:px-8">
      {/* Section header */}
      <div className="text-center">
        <p className="text-sm font-semibold uppercase tracking-wider text-cyan-400">Pricing</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">Simple, transparent pricing</h2>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-gray-400">Start free with all core features. Upgrade when you need more.</p>
      </div>

      {/* Pricing cards */}
      <div className="mx-auto mt-16 grid max-w-6xl grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {PRICING_TIERS.map((tier) => (
          <div
            key={tier.name}
            className={classNames('relative flex flex-col rounded-2xl p-8', {
              'bg-white/10 shadow-xl ring-2 ring-teal-500': tier.highlighted,
              'bg-white/5 ring-1 ring-white/10': !tier.highlighted,
            })}
          >
            {tier.highlighted && (
              <span className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-teal-500 to-cyan-600 px-4 py-1 text-xs font-semibold text-white shadow-md">
                Most popular
              </span>
            )}

            <p className="text-lg font-semibold text-white">{tier.name}</p>

            <div className="mt-4 flex items-baseline gap-1">
              <span className="text-4xl font-bold text-white">{tier.price}</span>
              <span className="text-sm text-gray-400">{tier.period}</span>
            </div>

            <p className="mt-4 text-sm text-gray-300">{tier.description}</p>

            <ul className="mt-6 mb-8 space-y-3">
              {tier.features.map((feature) => (
                <li key={feature} className="flex items-start gap-3">
                  <CheckIcon className="mt-0.5 h-5 w-5 shrink-0 text-teal-400" />
                  <span className="text-sm text-gray-300">{feature}</span>
                </li>
              ))}
            </ul>

            {tier.href.startsWith('mailto:') ? (
              <a
                href={tier.href}
                className="mt-auto block w-full rounded-lg bg-white/10 px-4 py-2.5 text-center text-sm font-semibold text-white ring-1 ring-white/10 transition-all duration-200 hover:bg-white/20"
              >
                {tier.cta}
              </a>
            ) : (
              <Link
                href={tier.href}
                className={classNames(
                  'mt-auto block w-full rounded-lg px-4 py-2.5 text-center text-sm font-semibold transition-all duration-200',
                  {
                    'bg-linear-to-r from-teal-500 to-cyan-600 text-white shadow-md hover:from-teal-600 hover:to-cyan-700': tier.highlighted,
                    'bg-white/10 text-white ring-1 ring-white/10 hover:bg-white/20': !tier.highlighted,
                  },
                )}
              >
                {tier.cta}
              </Link>
            )}
          </div>
        ))}
      </div>

      {/* View all plans link */}
      <div className="mt-10 text-center">
        <Link href={ROUTES.PRICING} className="text-sm font-semibold text-teal-400 hover:text-teal-300">
          View all plans and features &rarr;
        </Link>
      </div>
    </div>
  </section>
);

export default PricingPreview;
