import Link from 'next/link';
import { PLATFORM_OPTIONS } from './landing-page-data';

export const PlatformSection = () => (
  <section>
    <div className="mx-auto max-w-7xl px-6 py-24 sm:py-32 lg:px-8">
      {/* Section header */}
      <div className="text-center">
        <p className="text-sm font-semibold uppercase tracking-wider text-cyan-400">Available Everywhere</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">Jetstream runs where you do</h2>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-gray-400">
          Use the web app, install the desktop app, or add the browser extension.
        </p>
      </div>

      {/* Platform cards */}
      <div className="mt-16 grid grid-cols-1 gap-8 md:grid-cols-3">
        {PLATFORM_OPTIONS.map(({ icon: Icon, name, description, cta, href }) => {
          const isExternal = href.startsWith('http');

          return (
            <div key={name} className="rounded-2xl bg-white/5 p-8 ring-1 ring-white/10 transition-all duration-200 hover:ring-white/20">
              <Icon className="h-10 w-10 text-teal-400" />
              <h3 className="mt-4 text-xl font-semibold text-white">{name}</h3>
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

export default PlatformSection;
