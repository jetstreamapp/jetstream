import Link from 'next/link';
import { TRUST_SIGNALS } from './landing-page-data';

export const TrustSignals = () => (
  <section>
    <div className="mx-auto max-w-4xl px-6 pb-24 sm:pb-32 lg:px-8">
      {/* Section header */}
      <div className="text-center">
        <p className="text-sm font-semibold uppercase tracking-wider text-cyan-400">Verified &amp; Reviewed</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">Vetted by people who aren&apos;t us</h2>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-gray-400">
          Jetstream connects to your production org, so we put it through the reviews your security team will ask about.
        </p>
      </div>

      {/* Trust cards */}
      <div className="mt-16 grid grid-cols-1 gap-8 md:grid-cols-2">
        {TRUST_SIGNALS.map(({ icon: Icon, title, description, cta, href }) => {
          const isExternal = href.startsWith('http');

          return (
            <div key={title} className="rounded-2xl bg-white/5 p-8 ring-1 ring-white/10 transition-all duration-200 hover:ring-white/20">
              <Icon className="h-10 w-10 text-teal-400" />
              <h3 className="mt-4 text-xl font-semibold text-white">{title}</h3>
              <p className="mt-2 text-base text-gray-400">{description}</p>
              {isExternal ? (
                <a
                  href={href}
                  className="mt-6 inline-flex items-center gap-1 text-sm font-semibold text-teal-400 transition hover:text-teal-300"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {cta} &rarr;
                </a>
              ) : (
                <Link
                  href={href}
                  className="mt-6 inline-flex items-center gap-1 text-sm font-semibold text-teal-400 transition hover:text-teal-300"
                >
                  {cta} &rarr;
                </Link>
              )}
            </div>
          );
        })}
      </div>
    </div>
  </section>
);

export default TrustSignals;
