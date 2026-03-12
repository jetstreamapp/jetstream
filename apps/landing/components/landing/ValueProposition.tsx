'use client';

import { CheckCircleIcon } from '@heroicons/react/20/solid';
import { VALUE_PILLARS } from './landing-page-data';

export const ValueProposition = () => {
  return (
    <section className="py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        {/* Section header */}
        <div className="text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-cyan-400">Why Jetstream</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">One tool. Every workflow.</h2>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-gray-400">
            From querying records to deploying metadata, Jetstream replaces a dozen Salesforce tools with one streamlined platform.
          </p>
        </div>

        {/* 3-column grid */}
        <div className="mt-16 grid grid-cols-1 gap-8 lg:grid-cols-3">
          {VALUE_PILLARS.map((pillar) => (
            <div key={pillar.title} className="rounded-xl p-6">
              {/* Icon container */}
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-teal-900/30">
                <pillar.icon className="h-6 w-6 text-teal-400" />
              </div>

              {/* Title */}
              <h3 className="mt-4 text-xl font-semibold text-white">{pillar.title}</h3>

              {/* Description */}
              <p className="mt-2 text-base text-gray-400">{pillar.description}</p>

              {/* Features list */}
              <ul className="mt-4 space-y-2">
                {pillar.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2">
                    <CheckCircleIcon className="mt-0.5 h-5 w-5 shrink-0 text-teal-500" />
                    <span className="text-sm text-gray-400">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
