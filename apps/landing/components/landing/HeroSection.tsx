import Link from 'next/link';
import { ROUTES } from '../../utils/environment';

export const HeroSection = () => (
  <div className="pt-14 pb-16 sm:pt-28 sm:pb-20" data-testid="home-hero-container">
    <div className="mx-auto max-w-7xl px-6 lg:px-8 text-center">
      {/* Announcement pill */}
      <div className="flex justify-center">
        <Link
          href={ROUTES.blogPost('jetstream-sso')}
          className="inline-flex items-center gap-x-2 rounded-full bg-white/5 px-4 py-1.5 text-sm text-gray-300 ring-1 ring-white/10 transition hover:ring-white/20"
        >
          Now with <span className="font-semibold text-cyan-400">SSO</span> support
          <span aria-hidden="true">&rarr;</span>
        </Link>
      </div>

      {/* Heading and subtitle */}
      <h1 className="mt-8 text-5xl font-semibold tracking-tight text-white text-balance sm:text-7xl">
        A simpler way to build on Salesforce
      </h1>
      <p className="mx-auto mt-8 max-w-2xl text-lg text-gray-400 sm:text-xl">
        Streamline Salesforce management and speed up your day-to-day workflow with Jetstream
      </p>

      {/* CTAs */}
      <div className="mt-10 flex items-center justify-center gap-x-6">
        <Link
          href={ROUTES.AUTH.signup}
          className="rounded-md bg-linear-to-r from-teal-500 to-cyan-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:from-teal-600 hover:to-cyan-700 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2 focus:ring-offset-gray-900"
        >
          Get started for free
        </Link>
      </div>
    </div>
  </div>
);

export default HeroSection;
